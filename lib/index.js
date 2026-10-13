/* ============================================================================
 * dsh-curtain — 宿主半边（Host half）
 * ----------------------------------------------------------------------------
 * 这一半只做两件事：
 *   1) 提供四条路由  /dsh-curtain/boot.css · boot.js · asset/* · config
 *   2) 把配置持久化到 $DSH_HOME/dsh-curtain.json
 *
 * 刻意「不做」index.html 注入，理由：
 *   官方桌面版的 index.html 由 Electron 外壳从打包好的 dist 直接吐出，
 *   `webServer.tapIndex()` 永远不会执行；而结构化注入行（webserver/index-inject）
 *   虽然能到达页面，却要额外承担一个致命风险 —— 注入行里的 script-src 一旦加载失败，
 *   会 reject `__DSH_BOOT_READY__`，而应用主体第一行就是 await 它，
 *   结果是「应用起不来」。第一版只服务桌面端，所以整块注入省掉。
 *
 * 覆盖层与动画由浏览器半边自举（见 lib/client.js 的 selfBoot）。
 * 以后想加「真正的第一帧」，只需在下面 apply() 里补一个
 * `ctx.on('webserver/index-inject', rows => rows.push(...))` 订阅，
 * 并且只推内联 script 行 / html 行（绝不用 script-src），其它代码不用动。
 * ========================================================================== */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DSH_HOME = process.env.DSH_HOME || path.join(os.homedir(), '.dsh')
const CONFIG_FILE = path.join(DSH_HOME, 'dsh-curtain.json')

const NS = 'dsh-curtain'
const ROUTE_BASE = '/dsh-curtain'

/* ── 配置 ──────────────────────────────────────────────────────────────────
 * 字段与 lib/boot.js 顶部的 DEFAULTS 一一对应（两边都改才生效）。
 * 配置刻意不走 DSH 的 settings 命名空间，而是自带一份 JSON + 自建 HTTP 路由：
 * 这样不受 dsh-settings 的版本变更影响（社区插件在这里栽过 —— 宿主侧
 * settings.register 被删掉之后，设置卡整张消失，控制台一个字都没有）。
 * ------------------------------------------------------------------------ */
const DEFAULTS = {
  enabled: true,
  mode: 'session',            // always | session | daily
  speed: 1,                   // 0.35 – 3
  requireInteraction: true,   // 中央圆钮 / 带 gate 的节拍是否等用户确认
  allowSkip: true,
  sound: true,
  soundVolume: 0.5,
  forceMotion: false,         // true = 无视系统「减少动态效果」
  brand: 'DEEPSEEK',
  title: 'HARNESS',
  subtitle: 'SYNTHESIZE INTELLIGENCE',
  footer: 'POWERED BY DEEPSEEK',
  bgm: '',                      // 背景音乐文件名（存在 lib/assets/ 下），空 = 没有
  accent: '#f2c21c',
  bg: '#0b0e11',
  fg: '#e6ecf2'
}

const ENUMS = {
  mode: ['always', 'session', 'daily']
}
const BOOL_KEYS = ['enabled', 'requireInteraction', 'allowSkip', 'sound', 'forceMotion']
const TEXT_KEYS = ['brand', 'title', 'subtitle', 'footer']
const COLOR_KEYS = ['accent', 'bg', 'fg']
const RANGES = {
  speed: [0.35, 3],
  soundVolume: [0, 1]
}

/** 把任意输入夹成一份合法配置：枚举回退、区间夹取、颜色校验、文本截断。 */
function normalize(input) {
  const out = { ...DEFAULTS }
  const src = input && typeof input === 'object' ? input : {}
  for (const key of Object.keys(DEFAULTS)) {
    if (!(key in src) || src[key] === undefined || src[key] === null) continue
    const value = src[key]
    if (BOOL_KEYS.includes(key)) {
      out[key] = value === true || value === 'true' || value === 1 || value === '1'
    } else if (ENUMS[key]) {
      out[key] = ENUMS[key].includes(value) ? value : DEFAULTS[key]
    } else if (RANGES[key]) {
      const [lo, hi] = RANGES[key]
      const n = Number(value)
      out[key] = Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : DEFAULTS[key]
    } else if (COLOR_KEYS.includes(key)) {
      const s = String(value).trim()
      out[key] = /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : DEFAULTS[key]
    } else if (TEXT_KEYS.includes(key)) {
      out[key] = String(value).slice(0, 64)
    } else if (key === 'bgm') {
      // 只认「字母数字点横线下划线」，杜绝路径穿越
      const s = String(value).trim()
      out[key] = /^[A-Za-z0-9._-]{1,64}$/.test(s) ? s : ''
    } else {
      out[key] = value
    }
  }
  return out
}

/* ── 背景音乐：路径与白名单 ──────────────────────────────────────────────
   放在模块作用域：readConfig() 也要用（自动识别目录里已有的 bgm.*）。 */
const BGM_DIR = path.join(PACKAGE_ROOT, 'lib', 'assets')
const BGM_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.wav']
const BGM_MAX = 10 * 1024 * 1024          // 10 MB
const BGM_RX = /^bgm\.[A-Za-z0-9]+$/

/** 配置里的名字优先；为空就看看目录里有没有现成的 bgm.*
    —— 这样「手动把文件丢进 lib/assets/」的老用法照旧成立。 */
function resolveBgmName(name) {
  const s = String(name || '')
  if (BGM_RX.test(s)) {
    try { fs.statSync(path.join(BGM_DIR, s)); return s } catch (err) { /* 文件没了，往下找 */ }
  }
  try {
    const hit = fs.readdirSync(BGM_DIR).filter((f) => BGM_RX.test(f)).sort()[0]
    return hit || ''
  } catch (err) { return '' }
}

function readConfig() {
  try {
    const cfg = normalize(JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')))
    return { ...cfg, bgm: resolveBgmName(cfg.bgm) }
  } catch (err) {
    return { ...DEFAULTS, bgm: resolveBgmName('') }
  }
}

/** 原子写：先写临时文件再 rename，避免半截文件把配置读挂。 */
function writeConfig(next) {
  const cfg = normalize(next)
  fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true })
  const tmp = CONFIG_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(cfg, null, 2), 'utf8')
  fs.renameSync(tmp, CONFIG_FILE)
  return cfg
}

/* ── 静态资源：按 mtime 缓存，改完刷新页面即生效，不用重启宿主 ───────────── */
function makeReader(rel) {
  let cache = null
  return function read() {
    const file = path.join(PACKAGE_ROOT, rel)
    try {
      const st = fs.statSync(file)
      if (!cache || cache.mtimeMs !== st.mtimeMs) {
        cache = { mtimeMs: st.mtimeMs, text: fs.readFileSync(file, 'utf8') }
      }
      return cache.text
    } catch (err) {
      return ''
    }
  }
}
const readBootCss = makeReader('lib/boot.css')
const readBootJs = makeReader('lib/boot.js')

/* ── 素材白名单：只读、无子路径、按扩展名给 MIME ─────────────────────────── */
const ASSET_MIME = {
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif'
}

/* ── 插件导出形状 ──────────────────────────────────────────────────────────
 * 只给具名 name / inject / apply。两个刻意的「不做」：
 *   1) 不导出 default —— cordis-plugin-loader 的取法是 `exports.default ?? exports`，
 *      一旦有 default 就只认 default，两边都写反而多一个「改一处忘一处」的坑；
 *   2) 不导出 Config —— Cordis 约定 Config 是 schemastery schema，
 *      上面那份只是普通默认值对象，当 schema 用会炸。本插件也不吃 profile 配置。
 * ------------------------------------------------------------------------ */
export const name = NS

/** 用 inject 数组「等」服务就绪，而不是用 ctx.get 去抢跑 ——
 *  服务迟到和服务不存在会返回同一个值，抢跑失败是完全静默的。 */
export const inject = ['webServer', 'connection']

export function apply(ctx) {
  const disposers = []

  /* 取 HTTP 载体。取不到就只打 warn、跳过路由，插件本身仍然 APPLIED，
     绝不把一颗 fiber 炸掉（那会让整个插件全灭）。 */
  let webServer
  try {
    webServer = typeof ctx.get === 'function' ? ctx.get('webServer') : undefined
  } catch (err) {
    webServer = undefined
  }
  if (!webServer) webServer = ctx.webServer

  if (!webServer || typeof webServer.register !== 'function') {
    try {
      ctx.logger?.warn?.(`[${NS}] 当前 profile 没有可用的 webServer，宿主半边跳过路由注册；页面不会出现开机动画。`)
    } catch (err) { /* 日志失败不影响加载 */ }
    return
  }

  /* 浏览器信任栅栏：自定义路由必须过一遍，否则同机任意网页都能读写它。
     不带 token 直接访问这些路由返回 401 —— 那是正常的，也是「装好了」的判据。 */
  function rejected(req, res) {
    try {
      let conn
      try {
        conn = typeof ctx.get === 'function' ? ctx.get('connection') : undefined
      } catch (err) {
        conn = undefined
      }
      if (!conn) conn = ctx.connection
      if (!conn || typeof conn.requestRejection !== 'function') return false
      const code = conn.requestRejection(req)
      if (code === undefined || code === null || code === false) return false
      res.statusCode = typeof code === 'number' ? code : 403
      res.end()
      return true
    } catch (err) {
      return false
    }
  }

  function registerRoute(route) {
    const inner = route.handler
    return webServer.register({
      ...route,
      handler: async (req, res) => {
        if (rejected(req, res)) return
        return inner(req, res)
      }
    })
  }

  function sendText(res, type, text) {
    const body = Buffer.from(text, 'utf8')
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function sendJson(res, code, payload) {
    const body = Buffer.from(JSON.stringify(payload), 'utf8')
    res.writeHead(code, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Length': String(body.length)
    })
    res.end(body)
  }

  function readBody(req, limit = 64 * 1024) {
    return new Promise((resolve) => {
      let size = 0
      const chunks = []
      req.on('data', (c) => {
        size += c.length
        if (size > limit) { req.destroy(); resolve(''); return }
        chunks.push(c)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', () => resolve(''))
    })
  }

  /** 收二进制 body（上传用）。超限返回 null。 */
  function readBinary(req, limit) {
    return new Promise((resolve) => {
      let size = 0
      let dead = false
      const chunks = []
      req.on('data', (c) => {
        if (dead) return
        size += c.length
        if (size > limit) { dead = true; req.destroy(); resolve(null); return }
        chunks.push(c)
      })
      req.on('end', () => { if (!dead) resolve(Buffer.concat(chunks)) })
      req.on('error', () => resolve(null))
    })
  }

  /* ── 路由 ① 样式 ──────────────────────────────────────────────────────── */
  disposers.push(registerRoute({
    kind: 'exact',
    path: `${ROUTE_BASE}/boot.css`,
    handler: (req, res) => sendText(res, 'text/css; charset=utf-8', readBootCss())
  }))

  /* ── 路由 ② 动画运行时 ────────────────────────────────────────────────── */
  disposers.push(registerRoute({
    kind: 'exact',
    path: `${ROUTE_BASE}/boot.js`,
    handler: (req, res) => sendText(res, 'application/javascript; charset=utf-8', readBootJs())
  }))

  /* ── 路由 ③ 素材（美术素材放这里：lib/assets/）───────────────────────────
     只读、白名单、basename 化 —— 杜绝目录穿越。 */
  disposers.push(registerRoute({
    kind: 'prefix',
    path: `${ROUTE_BASE}/asset`,
    handler: (req, res) => {
      const raw = (req.url || '').split('?')[0]
      const name = path.basename(decodeURIComponent(raw))
      const ext = path.extname(name).toLowerCase()
      if (!name || name.includes('..') || !ASSET_MIME[ext] || !/^[A-Za-z0-9._-]+$/.test(name)) {
        res.writeHead(404); res.end(); return
      }
      let bytes
      try {
        bytes = fs.readFileSync(path.join(PACKAGE_ROOT, 'lib', 'assets', name))
      } catch (err) {
        res.writeHead(404); res.end(); return
      }
      res.writeHead(200, {
        'Content-Type': ASSET_MIME[ext],
        'Cache-Control': 'public, max-age=86400',
        'Content-Length': String(bytes.length)
      })
      res.end(bytes)
    }
  }))

  /* ── 背景音乐：文件管理 ────────────────────────────────────────────────
     设置页选一个本地音频 → 前端把 File 当 body POST 过来 → 落到 lib/assets/。
     文件名统一成 bgm<扩展名>，扩展名走白名单，绝不接受用户传来的路径。
     同一时刻只留一个：写新的之前先把旧的 bgm.* 删掉。 */
  function bgmTarget(rawName) {
    const base = path.basename(String(rawName || ''))
    const ext = path.extname(base).toLowerCase()
    if (!BGM_EXT.includes(ext)) return null
    return { name: 'bgm' + ext, file: path.join(BGM_DIR, 'bgm' + ext) }
  }

  function bgmInfo() {
    const name = readConfig().bgm
    if (!name) return null
    try { return { name, size: fs.statSync(path.join(BGM_DIR, name)).size } } catch (err) { return null }
  }

  function bgmRemoveAll(keep) {
    let removed = []
    try {
      for (const f of fs.readdirSync(BGM_DIR)) {
        if (!BGM_RX.test(f) || f === keep) continue
        try { fs.unlinkSync(path.join(BGM_DIR, f)); removed.push(f) } catch (err) {}
      }
    } catch (err) { /* 目录还不存在，正常 */ }
    return removed
  }

  /* ── 路由 ④ 配置读写 ──────────────────────────────────────────────────── */
  disposers.push(registerRoute({
    kind: 'exact',
    path: `${ROUTE_BASE}/config`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()

      if (method === 'GET') {
        sendJson(res, 200, {
          ok: true, config: readConfig(), defaults: DEFAULTS, file: CONFIG_FILE,
          bgm: bgmInfo(), bgmMax: BGM_MAX, bgmExt: BGM_EXT
        })
        return
      }
      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }

      const text = await readBody(req)
      let payload = {}
      try {
        payload = text ? JSON.parse(text) : {}
      } catch (err) {
        sendJson(res, 400, { ok: false, error: 'invalid json' })
        return
      }

      try {
        if (payload && payload.action === 'reset') {
          sendJson(res, 200, { ok: true, config: writeConfig(DEFAULTS), defaults: DEFAULTS })
          return
        }
        // 允许 {patch:{...}} 和裸对象两种形状
        const patch = payload && typeof payload.patch === 'object' && payload.patch ? payload.patch : payload
        sendJson(res, 200, { ok: true, config: writeConfig({ ...readConfig(), ...patch }), defaults: DEFAULTS })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* ── 路由 ⑤ 背景音乐上传 / 删除 ──────────────────────────────────────── */
  disposers.push(registerRoute({
    kind: 'exact',
    path: `${ROUTE_BASE}/bgm`,
    handler: async (req, res) => {
      const method = (req.method || 'GET').toUpperCase()

      if (method === 'GET') {
        sendJson(res, 200, { ok: true, bgm: bgmInfo(), max: BGM_MAX })
        return
      }

      if (method === 'DELETE') {
        const removed = bgmRemoveAll(null)
        const config = writeConfig({ ...readConfig(), bgm: '' })
        sendJson(res, 200, { ok: true, removed, config, defaults: DEFAULTS, bgm: null })
        return
      }

      if (method !== 'POST') {
        sendJson(res, 405, { ok: false, error: 'method not allowed' })
        return
      }

      // 文件名走 query：/dsh-curtain/bgm?name=foo.mp3
      const q = (req.url || '').split('?')[1] || ''
      const m = /(?:^|&)name=([^&]*)/.exec(q)
      let raw = ''
      try { raw = decodeURIComponent(m ? m[1] : '') } catch (err) { raw = '' }

      const target = bgmTarget(raw)
      if (!target) {
        sendJson(res, 400, { ok: false, error: '不支持的格式（只收 ' + BGM_EXT.join(' / ') + '）' })
        return
      }

      const buf = await readBinary(req, BGM_MAX)
      if (!buf || !buf.length) {
        sendJson(res, 413, { ok: false, error: '文件是空的，或者超过了 10 MB' })
        return
      }

      try {
        fs.mkdirSync(BGM_DIR, { recursive: true })
        bgmRemoveAll(target.name)
        fs.writeFileSync(target.file, buf)
        const config = writeConfig({ ...readConfig(), bgm: target.name })
        sendJson(res, 200, { ok: true, config, defaults: DEFAULTS, bgm: bgmInfo() })
      } catch (err) {
        sendJson(res, 500, { ok: false, error: String((err && err.message) || err) })
      }
    }
  }))

  /* 插件卸载/停用时的清理 */
  ctx.effect(() => () => {
    for (const dispose of disposers) {
      try { dispose() } catch (err) { /* noop */ }
    }
  })
}
