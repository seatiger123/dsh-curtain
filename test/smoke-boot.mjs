/* ============================================================================
 * test/smoke-boot.mjs —— 把 lib/boot.js 丢进一个最小 DOM 桩里真跑一遍
 * ----------------------------------------------------------------------------
 * 为什么需要它：boot.js 是给浏览器写的，Node 里跑不起来；但「改完直接重启 DSH
 * 才知道坏没坏」的反馈太慢。这个桩实现 boot.js 真正用到的那部分 DOM，
 * 于是能在 5 秒内验证：
 *   · 模板里的 class 和代码里 q('.xxx') 的选择器对得上
 *   · 整条时间线能走完，不抛异常
 *   · finish() 会摘掉滚动锁、移除根节点
 *   · 双击加载不会重复跑（__DSH_CURTAIN_LOADED__ 守卫）
 *   · 9 秒兜底不会误伤
 *
 * 用法： node test/smoke-boot.mjs
 * ========================================================================== */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BOOT_JS = path.join(HERE, '..', 'lib', 'boot.js')

let pass = 0
let fail = 0
const failures = []

function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name) }
  else {
    fail++
    failures.push(name + (extra ? ' :: ' + extra : ''))
    console.log('  FAIL ' + name + (extra ? ' :: ' + extra : ''))
  }
}

/* ── 最小 HTML 解析：只为了还原「哪些 class 存在」这一件事 ───────────────── */
function parseHtml(html) {
  const root = { tag: '#frag', className: '', children: [], text: '' }
  const stack = [root]
  const re = /<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g
  let m
  while ((m = re.exec(html)) !== null) {
    const [, closing, tag, attrs, selfClose, text] = m
    if (text !== undefined) {
      if (text.trim()) stack[stack.length - 1].text += text
      continue
    }
    if (closing) {
      if (stack.length > 1) stack.pop()
      continue
    }
    const cm = /class\s*=\s*"([^"]*)"/.exec(attrs || '')
    const node = { tag, className: cm ? cm[1] : '', children: [], text: '' }
    stack[stack.length - 1].children.push(node)
    if (!selfClose) stack.push(node)
  }
  return root
}

function descendants(node, out = []) {
  for (const c of node.children) { out.push(c); descendants(c, out) }
  return out
}

function matches(node, part) {
  if (part.startsWith('.')) return node.className.split(/\s+/).includes(part.slice(1))
  return node.tag === part
}

/* ── DOM 桩 ─────────────────────────────────────────────────────────────── */
/* 节点移除时必须同步清掉 id 索引，否则 getElementById 还能查到已摘掉的节点 —— 
   第一版桩就栽在这里（误报成「时间线没跑完」）。 */
const ID_MAP = new Map()

function makeStyle() {
  const props = {}
  return {
    setProperty: (k, v) => { props[k] = v },
    getPropertyValue: (k) => props[k] ?? '',
    removeProperty: (k) => { delete props[k] },
    _props: props
  }
}

class El {
  constructor(tag) {
    this.tag = tag
    this._className = ''
    this.children = []
    this.parentNode = null
    this.textContent = ''
    this._html = ''
    this._parsed = null
    this.style = makeStyle()
    this.dataset = {}
    this.hidden = false
    this.offsetWidth = 0
    this._listeners = {}
    const self = this
    this.classList = {
      add: (...cs) => { const s = new Set(self._cls()); cs.forEach((c) => s.add(c)); self._className = [...s].join(' ') },
      remove: (...cs) => { const s = new Set(self._cls()); cs.forEach((c) => s.delete(c)); self._className = [...s].join(' ') },
      toggle: (c, on) => { const has = self._cls().includes(c); const want = on === undefined ? !has : !!on; want ? self.classList.add(c) : self.classList.remove(c); return want },
      contains: (c) => self._cls().includes(c)
    }
  }
  _cls() { return this._className.split(/\s+/).filter(Boolean) }
  get className() { return this._className }
  set className(v) { this._className = String(v || '') }
  get id() { return this.dataset._id || '' }
  set id(v) { this.dataset._id = v }
  get innerHTML() { return this._html }
  set innerHTML(v) {
    this._html = String(v)
    this._parsed = parseHtml(this._html)
    for (const c of this._parsed.children) { c.parentNode = this }
  }
  get childNodes() { return this.children }
  appendChild(node) {
    if (node && node.__fragment) { for (const c of node.children) this.appendChild(c); return node }
    this.children.push(node)
    if (node) node.parentNode = this
    return node
  }
  append(...nodes) { nodes.forEach((n) => this.appendChild(n)) }
  removeChild(node) {
    const i = this.children.indexOf(node)
    if (i >= 0) this.children.splice(i, 1)
    if (node) {
      node.parentNode = null
      if (node.dataset && node.dataset._id) ID_MAP.delete(node.dataset._id)
    }
    return node
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this) }
  replaceChildren(...nodes) { this.children.length = 0; nodes.forEach((n) => this.appendChild(n)) }
  setAttribute(k, v) { this.dataset['attr_' + k] = v }
  getAttribute(k) { return this.dataset['attr_' + k] }
  addEventListener(type, fn) { (this._listeners[type] ||= []).push(fn) }
  removeEventListener(type, fn) {
    const l = this._listeners[type]
    if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1) }
  }
  dispatch(type, ev) { for (const fn of this._listeners[type] || []) fn(ev || {}) }
  querySelector(sel) {
    const parts = sel.trim().split(/\s+/)
    let pool = this._parsed ? descendants(this._parsed) : this.children
    let found = null
    for (let i = 0; i < parts.length; i++) {
      found = pool.find((n) => matches(n, parts[i]))
      if (!found) return null
      pool = descendants(found)
    }
    // 把解析出来的普通节点升级成 El 才能用（顶层直接子节点除外）
    return this.children.find((c) => c.__sel === sel) || wrapParsed(found)
  }
}

const wrapped = new WeakMap()
function wrapParsed(node) {
  if (!node) return null
  if (wrapped.has(node)) return wrapped.get(node)
  const el = new El(node.tag)
  el.className = node.className
  el.textContent = node.text
  el._parsed = node
  wrapped.set(node, el)
  return el
}

function makeDocument() {
  const docEl = new El('html')
  const body = new El('body')
  const head = new El('head')
  const byId = ID_MAP
  const doc = {
    readyState: 'complete',
    documentElement: docEl,
    body,
    head,
    _byId: byId,
    createElement: (t) => new El(t),
    createElementNS: (_ns, t) => new El(t),
    createTextNode: (t) => { const e = new El('#text'); e.textContent = t; return e },
    createDocumentFragment: () => { const f = new El('#frag'); f.__fragment = true; return f },
    getElementById: (id) => byId.get(id) || null,
    querySelector: () => null,
    addEventListener: (t, fn) => { (doc._l ||= {})[t] = (doc._l[t] || []).concat(fn) },
    removeEventListener: () => {}
  }
  void head
  const origAppend = body.appendChild.bind(body)
  body.appendChild = (node) => { const r = origAppend(node); if (node && node.dataset && node.dataset._id) byId.set(node.dataset._id, node); return r }
  return doc
}

/* ── 装配环境 ───────────────────────────────────────────────────────────── */
const document = makeDocument()

/* 统计活着的 setInterval —— 用来验证「重播不会让旧实例的时钟继续跑」。
   必须在加载 boot.js 之前装好，否则抓不到它建的那些。 */
const liveIntervals = new Set()
const _setInterval = globalThis.setInterval
const _clearInterval = globalThis.clearInterval
globalThis.setInterval = (fn, ms) => { const id = _setInterval(fn, ms); liveIntervals.add(id); return id }
globalThis.clearInterval = (id) => { liveIntervals.delete(id); return _clearInterval(id) }

const listeners = {}
const window = {
  document,
  setTimeout, clearTimeout, setInterval, clearInterval,
  requestAnimationFrame: (cb) => setTimeout(() => cb(Date.now()), 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  AudioContext: undefined,          // 刻意不提供：验证音频缺失时不影响画面
  webkitAudioContext: undefined,
  addEventListener: (t, fn) => { (listeners[t] ||= []).push(fn) },
  removeEventListener: () => {}
}
globalThis.window = window
globalThis.document = document
globalThis.requestAnimationFrame = window.requestAnimationFrame

window.__DSH_CURTAIN__ = {
  enabled: true, mode: 'always', speed: 3,
  requireInteraction: false, allowSkip: true,
  sound: true, soundVolume: 0.5, forceMotion: false,
  brand: 'DEEPSET', title: 'HARNESS',
  subtitle: 'SYNTHESIZE INTELLIGENCE', footer: 'POWERED BY DEEPSEEK',
  accent: '#ff7500', bg: '#07080a', fg: '#e8e8ea'
}

/* ── 开跑 ───────────────────────────────────────────────────────────────── */
console.log('\n=== dsh-curtain · boot.js 冒烟测试 ===\n')

const src = fs.readFileSync(BOOT_JS, 'utf8')

console.log('[1] 语法与静态检查')
ok('boot.js 不是空的', src.length > 2000, src.length + ' bytes')

/* 把代码里 q('.xxx') / querySelector('.xxx') 的选择器全抓出来，逐个核对模板里有没有 */
const selRe = /q\(\s*'([^']+)'\s*\)/g
const sels = []
let sm
while ((sm = selRe.exec(src)) !== null) sels.push(sm[1])
ok('抓到若干选择器', sels.length >= 15, sels.length + ' 个')

/* 模板：从 root.innerHTML = ... 那一段里取。
   ⚠️ 不能图省事写成 /root\.innerHTML\s*=([\s\S]*?)\n\n/ —— 模板里会留空行分组，
   那样会在第一个空行处截断，后面所有元素都被判成"模板里没有"。
   正确判据：模板是一串用 + 连接的字符串，所以取到第一行不以 + 结尾为止。 */
const tplLines = src.slice(src.indexOf('root.innerHTML')).split('\n')
let tplEnd = 1
let inComment = false                       // 注释可能跨多行，必须跟踪状态
for (let i = 1; i < tplLines.length; i++) {
  const t = tplLines[i].trim()
  if (inComment) {
    if (t.includes('*/')) inComment = false
    continue
  }
  if (t === '' || t.startsWith('//')) continue
  if (t.startsWith('/*')) {
    if (!t.includes('*/')) inComment = true
    continue
  }
  if (!/\+\s*$/.test(t)) { tplEnd = i; break }
}
const tpl = tplLines.slice(0, tplEnd + 1).join('\n')
ok('找到 DOM 模板', tpl.includes('dc-root') || tpl.includes('dc-stage'), tpl.length + ' chars')
/* 注意：不要把这里的模板再去做 `replace(/^[\s\S]*?=/, '')` 之类的"去前缀" ——
   模板第一个标签里就有 `class=`，那个 `=` 会被当成前缀终点，把第一个元素切坏。
   （这个坑真踩过：`.dc-stage` 因此一直报"模板里没有"。） */
const tplClasses = parseHtml(tpl.replace(/'\s*\+\s*'/g, ''))

console.log('\n[2] 选择器与模板对账')
for (const sel of sels) {
  const parts = sel.trim().split(/\s+/)
  let pool = descendants(tplClasses)
  let found = null
  for (const part of parts) {
    found = pool.find((n) => matches(n, part))
    if (!found) break
    pool = descendants(found)
  }
  ok('模板里有 ' + sel, !!found)
}

console.log('\n[3] 真实执行')
let threw = null
try {
  await import('file://' + BOOT_JS.replace(/\\/g, '/'))
} catch (e) {
  threw = e
}
ok('加载 boot.js 不抛异常', threw === null, threw ? threw.message : '')
await new Promise((r) => setTimeout(r, 80))

const root = document.getElementById('dsh-curtain-root')
ok('根节点已建好', !!root)
ok('根节点带 dc-root 类', !!root && root.classList.contains('dc-root'))
ok('滚动锁已加', document.documentElement.classList.contains('dc-lock'))
ok('根节点挂到 body 上', !!root && root.parentNode === document.body)
ok('配置写进了 CSS 变量', !!root && root.style.getPropertyValue('--dc-accent') === '#ff7500')
ok('速度写进了 CSS 变量', !!root && root.style.getPropertyValue('--dc-speed') === '3')
ok('对外 API 已暴露', !!window.__DSH_CURTAIN_API__ && typeof window.__DSH_CURTAIN_API__.replay === 'function')
ok('单次加载守卫已置位', window.__DSH_CURTAIN_LOADED__ === true)

console.log('\n[4] 等时间线跑完（3 倍速，约 4 秒）…')
const t0 = Date.now()
while (!window.__DSH_CURTAIN_API__?.config) { await new Promise((r) => setTimeout(r, 50)); break }
/* 等 finish：根节点被摘掉 或 超时 */
let finished = false
const deadline = Date.now() + 14000
while (Date.now() < deadline) {
  if (document.getElementById('dsh-curtain-root') === null) { finished = true; break }
  await new Promise((r) => setTimeout(r, 120))
}
const elapsed = Date.now() - t0

ok('时间线跑完并摘掉了覆盖层', finished, '耗时 ' + elapsed + 'ms')
ok('滚动锁已摘除（主界面能滚了）', !document.documentElement.classList.contains('dc-lock'))
ok('没有触发 9 秒兜底', window.__DSH_CURTAIN_FAILED__ !== true)

console.log('\n[5] 跳过路径')
/* 重开一次，立刻 skip */
window.__DSH_CURTAIN_LOADED__ = false
delete window.__DSH_CURTAIN_API__
const doc2 = document
let skipErr = null
try {
  const mod = await import('file://' + BOOT_JS.replace(/\\/g, '/') + '?v=2')
  void mod
} catch (e) { skipErr = e }
await new Promise((r) => setTimeout(r, 100))
const root2 = doc2.getElementById('dsh-curtain-root')
if (root2 && window.__DSH_CURTAIN_API__) {
  try { window.__DSH_CURTAIN_API__.skip() } catch (e) { skipErr = e }
  await new Promise((r) => setTimeout(r, 400))
  ok('跳过不抛异常', skipErr === null, skipErr ? skipErr.message : '')
  ok('跳过之后覆盖层被摘掉', doc2.getElementById('dsh-curtain-root') === null)
} else {
  ok('第二轮能重新挂载', false, 'root2=' + !!root2)
}

console.log('\n[6] 中止不留残留（修过的真 bug 的回归守卫）')
/* 第三轮：跑到"加载/时钟都在跳"的阶段，再 destroy。
   原始 bug 是：中止后那条 Promise 链继续冲到底，重新建定时器、重新加滚动锁。
   现在设计上已不用 setInterval（改成 wait() 自续期），所以这里守两件事：
     ① 全程不出现 setInterval
     ② destroy 之后再等一会儿，那条链不许复活任何东西 */
window.__DSH_CURTAIN_TEARDOWN__ = null
window.__DSH_CURTAIN_LOADED__ = false
delete window.__DSH_CURTAIN_API__
try {
  await import('file://' + BOOT_JS.replace(/\\/g, '/') + '?v=3')
} catch (e) { ok('第三轮加载', false, e.message) }

/* 3 倍速下 clock / load / log 三条自续期链此时都在跑 */
await new Promise((r) => setTimeout(r, 1500))
ok('第三轮确实挂载了', document.getElementById('dsh-curtain-root') !== null)
ok('设计上不使用 setInterval', liveIntervals.size === 0, 'live=' + liveIntervals.size)

try { window.__DSH_CURTAIN_API__.destroy() } catch (e) { ok('destroy 不抛异常', false, e.message) }
await new Promise((r) => setTimeout(r, 80))
ok('destroy 之后 interval 仍为 0', liveIntervals.size === 0, 'live=' + liveIntervals.size)
ok('destroy 之后根节点已移除', document.getElementById('dsh-curtain-root') === null)
ok('destroy 之后滚动锁已摘', !document.documentElement.classList.contains('dc-lock'))
ok('destroy 之后接管权已交回', window.__DSH_CURTAIN_TEARDOWN__ === null)

/* 关键回归：被中止的链如果还在跑，这一段时间足够它把根节点和滚动锁加回来 */
await new Promise((r) => setTimeout(r, 900))
ok('destroy 后 900ms：根节点没有复活', document.getElementById('dsh-curtain-root') === null)
ok('destroy 后 900ms：滚动锁没有被重新加上', !document.documentElement.classList.contains('dc-lock'))
ok('destroy 后 900ms：没有新的 interval', liveIntervals.size === 0, 'live=' + liveIntervals.size)

console.log('\n============================')
console.log(`  通过 ${pass} / 失败 ${fail}`)
console.log('============================\n')
if (fail) {
  console.log('失败项：')
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
