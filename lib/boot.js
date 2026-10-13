/* ============================================================================
 * dsh-curtain · boot.js —— 开机动画运行时（浏览器端，零依赖、无构建）
 * ----------------------------------------------------------------------------
 * 视觉基调：参考《明日方舟：终末地》—— 高亮白底、精密细线、大量留白、
 *           克制的科技工业细节（刻度环、角标、等宽小字）。
 *
 * 职责划分：
 *   【美术区】本文件顶部的常量块 + lib/boot.css       ← 只改这里
 *   【技术区】下面的时间线引擎、DOM 装配、演出流程、音频
 *
 * 两条必须守住的纪律（改了会出真问题）：
 *   ① 所有延时都必须走 wait()，不要散落 setTimeout
 *      —— 它们是「随时跳过、不留残影」的唯一实现基础
 *   ② 任何异常都要落到 finish()，绝不许把用户留在白幕里
 * ========================================================================== */
(function () {
  'use strict'

  /* 接管：如果已经有一个实例在跑，先让它彻底退出。
     ─────────────────────────────────────────────────────────────────────────
     否则「重播」会让两个实例同时跑 —— 旧实例的 setTimeout / setInterval
     没有任何人清理，而且它走到结尾时还会去解锁滚动条、操作自己那棵
     已经脱离文档的 DOM 树，把新实例的动画搅乱。
     这里刻意「不早退」（早退会让重播失效），改成「谁后加载谁接管」。 */
  if (typeof window.__DSH_CURTAIN_TEARDOWN__ === 'function') {
    try { window.__DSH_CURTAIN_TEARDOWN__() } catch (e) { /* 旧实例清理失败不阻塞新实例 */ }
  }
  window.__DSH_CURTAIN_LOADED__ = true

  var ROOT_ID = 'dsh-curtain-root'

  /* ═════════════════════════════════════════════════════════════════════════
     ▼▼▼ 美术区 ① · 鲸鱼标识 ▼▼▼
     ─────────────────────────────────────────────────────────────────────────
     路径数据取自 DSH 自带的 favicon.svg（官方鲸鱼标识，viewBox 0 0 50 50）。
     这里只描边不填充 —— 用「线条图标」的形式呈现。
     ═════════════════════════════════════════════════════════════════════════ */
  var WHALE_PATH =
    'M48.8354 10.0479C48.3232 9.79199 48.1025 10.2798 47.8032 10.5278C47.7007 10.6079 ' +
    '47.6143 10.7119 47.5273 10.8076C46.7793 11.624 45.9048 12.1597 44.7622 12.0957C43.0923 ' +
    '12 41.666 12.5356 40.4058 13.8398C40.1377 12.2319 39.2476 11.272 37.8926 10.6558C37.1836 ' +
    '10.3359 36.4668 10.0156 35.9702 9.31982C35.6235 8.82373 35.5293 8.27197 35.356 ' +
    '7.72754C35.2456 7.3999 35.1353 7.06396 34.7651 7.00781C34.3633 6.94385 34.2056 7.2876 ' +
    '34.0479 7.57568C33.418 8.75195 33.1733 10.0479 33.1973 11.3599C33.2524 14.312 34.4736 ' +
    '16.6641 36.8999 18.3359C37.1758 18.5278 37.2466 18.7197 37.1597 19C36.9946 19.5757 ' +
    '36.7974 20.1357 36.624 20.7119C36.5137 21.0801 36.3486 21.1597 35.9624 21C34.6309 ' +
    '20.4321 33.481 19.5918 32.4644 18.5757C30.7393 16.8721 29.1792 14.9917 27.2334 ' +
    '13.52C26.7764 13.1758 26.3193 12.856 25.8467 12.5518C23.8618 10.584 26.1069 8.96777 ' +
    '26.627 8.77588C27.1704 8.57568 26.8159 7.8877 25.0591 7.896C23.3022 7.90381 21.6953 ' +
    '8.50391 19.647 9.30371C19.3477 9.42383 19.0322 9.51172 18.7095 9.58398C16.8501 9.22363 ' +
    '14.9199 9.14355 12.9033 9.37598C9.10596 9.80762 6.07275 11.6396 3.84326 14.7681C1.16455 ' +
    '18.5278 0.53418 22.7998 1.30664 27.2559C2.11768 31.9521 4.46582 35.8398 8.07373 ' +
    '38.8799C11.8159 42.0322 16.1255 43.5762 21.041 43.2803C24.0269 43.104 27.3516 42.6963 ' +
    '31.1016 39.4561C32.0469 39.936 33.0396 40.1279 34.686 40.272C35.9546 40.3921 37.1758 ' +
    '40.208 38.1211 40.0078C39.6021 39.688 39.4995 38.2881 38.9639 38.0322C34.623 35.9678 ' +
    '35.5762 36.8081 34.71 36.1279C36.9155 33.4639 40.2402 30.6958 41.54 21.728C41.6426 ' +
    '21.0161 41.5557 20.5679 41.54 19.9917C41.5322 19.6396 41.6108 19.5039 42.0049 ' +
    '19.4639C43.0923 19.3359 44.1479 19.0317 45.1167 18.4878C47.9292 16.9199 49.064 14.3438 ' +
    '49.3315 11.2559C49.3711 10.7837 49.3237 10.2959 48.8354 10.0479ZM24.3262 ' +
    '37.8398C20.1196 34.4639 18.0791 33.3521 17.2358 33.3999C16.4482 33.4482 16.5898 ' +
    '34.3682 16.7632 34.9678C16.9443 35.5601 17.1812 35.9683 17.5117 36.4878C17.7402 ' +
    '36.832 17.8979 37.3442 17.2832 37.728C15.9282 38.584 13.5728 37.4399 13.4624 ' +
    '37.3838C10.7207 35.7358 8.42822 33.5601 6.81348 30.584C5.25342 27.7197 4.34766 ' +
    '24.6479 4.19775 21.3677C4.1582 20.5757 4.38672 20.2959 5.15869 20.1519C6.17529 ' +
    '19.96 7.22314 19.9199 8.23926 20.0718C12.5327 20.7119 16.1885 22.6719 19.2529 ' +
    '25.7759C21.002 27.5439 22.3252 29.6558 23.6885 31.7202C25.1377 33.9121 26.6978 36 ' +
    '28.6831 37.7119C29.3843 38.312 29.9434 38.7681 30.479 39.104C28.8643 39.2881 26.1699 ' +
    '39.3281 24.3262 37.8398ZM26.3433 24.6001C26.3433 24.248 26.6191 23.9678 26.9658 ' +
    '23.9678C27.0444 23.9678 27.1152 23.9839 27.1782 24.0078C27.2651 24.04 27.3438 ' +
    '24.0879 27.4067 24.1602C27.5171 24.272 27.5801 24.4321 27.5801 24.6001C27.5801 ' +
    '24.9521 27.3042 25.2319 26.9575 25.2319C26.6108 25.2319 26.3433 24.9521 26.3433 ' +
    '24.6001ZM32.6064 27.8799C32.2046 28.0479 31.8027 28.1919 31.4165 28.208C30.8179 ' +
    '28.2397 30.1641 27.9922 29.8096 27.688C29.2583 27.2158 28.8643 26.9521 28.6987 ' +
    '26.1279C28.6279 25.7759 28.6675 25.2319 28.7305 24.9199C28.8721 24.248 28.7144 ' +
    '23.8159 28.2495 23.4238C27.8716 23.104 27.3911 23.0161 26.8633 23.0161C26.666 ' +
    '23.0161 26.4849 22.9277 26.3511 22.856C26.1304 22.7441 25.9492 22.4639 26.1226 ' +
    '22.1201C26.1777 22.0078 26.4458 21.7358 26.5088 21.688C27.2256 21.272 28.0527 ' +
    '21.4077 28.8169 21.7197C29.5259 22.0161 30.0615 22.5601 30.834 23.3281C31.6216 ' +
    '24.2559 31.7632 24.5117 32.2124 25.208C32.5669 25.752 32.8901 26.312 33.1104 ' +
    '26.9521C33.2446 27.3521 33.0713 27.6802 32.6064 27.8799Z'

  /* ═════════════════════════════════════════════════════════════════════════
     ▼▼▼ 美术区 ② · 中央按钮（圆形刻度盘）▼▼▼
     ─────────────────────────────────────────────────────────────────────────
     第一幕的主角：一个圆形按钮，中间是灰色线条鲸鱼。
     点击后鲸鱼用「一笔画」的方式变成蓝色。
     ═════════════════════════════════════════════════════════════════════════ */
  var DIAL = {
    caption: 'TAP TO INITIALIZE',   // 圆环下方的提示文字
    captionArmed: 'ACCESS GRANTED', // 点击之后的文字
    label: 'SYSTEM GATE',           // 圆环上方的极小字
    drawMs: 1300,                   // 「一笔画」的时长（会被 speed 除）
    idleAutoMs: 2200                // 关掉「需要人工确认」时，多久自动按下
  }

  /* ═════════════════════════════════════════════════════════════════════════
     ▼▼▼ 美术区 ③ · 左上角加载文字 ▼▼▼
     ─────────────────────────────────────────────────────────────────────────
     纯等宽大写 + 宽字距，和 HUD 其它文字同一套语言。
     ═════════════════════════════════════════════════════════════════════════ */
  var LOADING = {
    label: 'LOADING SYSTEM MODULES',
    cap: 0.72,                      // 点击前最多爬到 72%（留一个"卡在等待"的暗示）
    logs: [
      'MOUNTING CORE …',
      'INDEXING WORKSPACE …',
      'VERIFYING SIGNATURE …',
      'AWAITING OPERATOR …'
    ],
    logEveryMs: 1400
  }

  /* ═════════════════════════════════════════════════════════════════════════
     ▼▼▼ 美术区 ④ · 协议场景 ▼▼▼
     ─────────────────────────────────────────────────────────────────────────
     点击圆钮之后的下一幕：左半是「用户协议」面板，右半是机械百叶展开后
     露出的欢迎字。背景是滚动的终端日志。
     ═════════════════════════════════════════════════════════════════════════ */
  var AGREEMENT = {
    tag: 'USER AGREEMENT',
    docId: 'DSH-UI-AGREEMENT',
    title: '用户协议',
    accept: '同意',
    acceptSub: 'AGREE',
    accepted: '已同意',
    acceptedSub: 'ACCEPTED',
    /* 正文。alien = true 时改用自动生成的"外星文"条款（省得写内容）。
       false 时用下面的 paragraphs，每条一个 <p>，可以用 <b> 标重点。 */
    alien: false,
    paragraphs: [
      '<b>▪</b>欢迎使用 DSH 服务',
      '在使用本产品及相关服务前，请务必仔细阅读并理解《DSH 用户协议》的全部条款。',
      '本协议是您与 DSH 之间就使用本产品所订立的约定。您对本产品的安装、启动或使用行为，均视为已阅读并同意接受本协议各项条款的约束。',
      '我们可能会不时更新本协议。更新后的协议将在本产品内公布；若您在协议变更后继续使用，即视为您已接受变更后的内容。',
      '点击「同意」即表示您已阅读并同意遵守本协议的全部内容。'
    ],
    clauses: 6,            // alien=true 时生成几条条款
    seed: 20261012,        // 固定种子 → 每次生成的"外星文"完全一样
    idleAutoMs: 3000       // 关掉「需要人工确认」时，多久自动同意
  }

  var CODEBG = {
    lines: 58,             // 生成多少行（会复制一份做无缝循环）
    seed: 771,
    rollMs: 21000,         // 一屏滚完的时间
    gap: 5                // 行间距（px，需与 CSS 的 gap 一致）
  }

  /* ═════════════════════════════════════════════════════════════════════════
     ▼▼▼ 美术区 ⑤ · 节拍表 ▼▼▼
     ─────────────────────────────────────────────────────────────────────────
     这是动画后半段的"剧本"。每一条是一个节拍：
       zh       中文主字
       en       英文副标（等宽小字）
       hold     至少停多久（毫秒，会被 speed 除）
       progress 进度条走到哪（0–1）
       gate     true = 需要用户确认才继续
     ═════════════════════════════════════════════════════════════════════════ */
  /* ── 协议卡左侧那枚单体标（DSH 徽记）───────────────────────────────────
     三片带 45° 切角的竖列，中间那片更高。viewBox 是 "0 0 100 126"。
     想换成自己的标：只改这一条路径就行，外面那圈刻度环是 CSS 画的。 */
  var EMBLEM_PATH =
    'M 6 42 L 24 24 L 24 118 L 6 118 Z' +
    'M 41 26 L 59 8 L 59 118 L 41 118 Z' +
    'M 76 42 L 94 24 L 94 118 L 76 118 Z'

  /* ── 英雄屏中央的字标「dsh」─────────────────────────────────────────────
     手工画的三个小写字母，全部用 45° 切角 —— 现成字体里没有这个形。
     viewBox 是 "0 0 290 100"。笔画 22、切角 6（偏细，所以放大也不糊）。
       d  x 0..84     碗 + 通到顶的竖，碗里那圈反白靠 fill-rule: evenodd 挖出来
       s  x 104..180  只占 x-height（24..100）—— 全高的话就变成大写 S
       h  x 200..284  左竖通到顶，右竖只到 x-height，**两竖之间必须有一圈镂空**
     ⚠️ h 的那个镂空（第二条 M 222 50 …）删掉的话，它就渲染成大写 H 了 —— 踩过。
     想换成自己的字：改这两条路径就行（第二条是压在 h 上的黄色斜块）。 */
  var HERO_MARK =
    'M 62 24 L 6 24 L 0 30 L 0 94 L 6 100 L 78 100 L 84 94 L 84 6 L 78 0 L 68 0 L 62 6 Z' +
    'M 13 37 L 49 37 L 49 87 L 13 87 Z' +
    'M 109 24 L 175 24 L 180 29 L 180 37 L 175 42 L 130 42 L 130 53 L 175 53 L 180 58 ' +
    'L 180 95 L 175 100 L 109 100 L 104 95 L 104 87 L 109 82 L 154 82 L 154 71 ' +
    'L 109 71 L 104 66 L 104 29 Z' +
    'M 200 6 L 206 0 L 216 0 L 222 6 L 222 24 L 278 24 L 284 30 L 284 94 L 278 100 ' +
    'L 206 100 L 200 94 Z' +
    'M 222 50 L 262 50 L 262 100 L 222 100 Z'
  var HERO_MARK_ACCENT = 'M 250 0 L 272 0 L 256 30 L 234 30 Z'

  /* ── 音色配方 ────────────────────────────────────────────────────────────
     每条 = 若干层叠加 + 一个混响量。层的字段：
       f     起始频率(Hz)
       to    滑到的频率（省略＝不滑音）
       dur   时长(秒)
       type  波形 sine/triangle/sawtooth/square
       g     峰值音量
       atk   起音时间(秒) —— 大 = 慢慢涌起来，小 = 一记撞击
       noise true = 用过滤后的白噪声（撞击 / 风声），配 lp 设低通截止
       delay 相对起始延后多少秒
     调音色只改这张表。 */
  var CUE = {
    /* 开场：低频从 34Hz 涌到 58Hz，叠高频微光 —— 像巨型机组启动 */
    rise: { verb: 0.7, layers: [
      { f: 34,   to: 58,   dur: 2.8, type: 'sine',     g: 0.80, atk: 0.6 },
      { f: 51,   to: 87,   dur: 2.6, type: 'sine',     g: 0.34, atk: 0.7 },
      { f: 68,   to: 116,  dur: 2.6, type: 'triangle', g: 0.24, atk: 0.5 },
      { f: 1400, to: 2400, dur: 3.0, type: 'sine',     g: 0.05, atk: 1.3 },
      { noise: true, dur: 2.8, lp: 900, g: 0.12, atk: 1.2 }
    ] },

    /* 机械展开：一记低频冲击 + 金属噪声 + 长混响尾巴 */
    deploy: { verb: 0.85, layers: [
      { f: 62, to: 30, dur: 1.6, type: 'sine',     g: 0.5,  atk: 0.006 },
      { noise: true, dur: 0.55, lp: 1100, g: 0.22, atk: 0.004 },
      { f: 150, to: 74, dur: 1.1, type: 'sawtooth', g: 0.1,  atk: 0.012 },
      { f: 420, dur: 1.4, type: 'triangle', g: 0.05, atk: 0.01, delay: 0.06 },
      { f: 1880, dur: 1.8, type: 'sine', g: 0.022, atk: 0.02 }
    ] },

    /* 按下「同意」：扎实的低频撞击 + 短促亮音 */
    confirm: { verb: 0.5, layers: [
      { f: 128, to: 58, dur: 0.5, type: 'sine',     g: 0.4,  atk: 0.004 },
      { noise: true, dur: 0.16, lp: 2600, g: 0.18, atk: 0.002 },
      { f: 720, to: 420, dur: 0.34, type: 'triangle', g: 0.14, atk: 0.005 }
    ] },

    /* 一笔画 */
    draw: { verb: 0.7, layers: [
      { f: 180, to: 760,  dur: 1.5, type: 'sine',     g: 0.16, atk: 0.08 },
      { f: 360, to: 1520, dur: 1.4, type: 'triangle', g: 0.06, atk: 0.12 },
      { noise: true, dur: 1.5, lp: 3000, g: 0.05, atk: 0.35 }
    ] },

    /* 节拍 tick —— 刻意克制，别抢戏 */
    tick: { verb: 0.2, layers: [
      { f: 1720, dur: 0.05, type: 'square', g: 0.03, atk: 0.002 }
    ] },

    /* 揭幕：低频铺底 + 一个大三和弦 */
    chime: { verb: 1, layers: [
      { f: 58,  dur: 2.6, type: 'sine',     g: 0.36, atk: 0.03 },
      { f: 233, dur: 2.4, type: 'triangle', g: 0.1,  atk: 0.012 },
      { f: 349, dur: 2.2, type: 'triangle', g: 0.085, atk: 0.014 },
      { f: 466, dur: 2.0, type: 'triangle', g: 0.07, atk: 0.016 },
      { f: 932, dur: 1.8, type: 'sine',     g: 0.035, atk: 0.012 },
      { noise: true, dur: 2.2, lp: 1400, g: 0.06, atk: 0.5 }
    ] }
  }

  /* ═════════════════════════════════════════════════════════════════════════
     ═══════════════════════════ 以下为技术区 ═══════════════════════════════
     ═════════════════════════════════════════════════════════════════════════ */

  /* ── 路径：DSH 里走 /dsh-curtain，离线预览页会覆盖这几个全局变量 ───────── */
  var BASE = typeof window.__DSH_CURTAIN_BASE__ === 'string' ? window.__DSH_CURTAIN_BASE__ : '/dsh-curtain'
  var ASSET_BASE = typeof window.__DSH_CURTAIN_ASSET_BASE__ === 'string'
    ? window.__DSH_CURTAIN_ASSET_BASE__
    : BASE + '/asset'
  function asset(name) { return ASSET_BASE + '/' + name }

  /* ── 配置合并（与宿主半边 lib/index.js 的 DEFAULTS 保持一致）───────────── */
  var DEFAULTS = {
    enabled: true,
    mode: 'session',
    speed: 1,
    requireInteraction: true,
    allowSkip: true,
    sound: true,
    soundVolume: 0.5,
    forceMotion: false,
    brand: 'DEEPSEEK',
    title: 'HARNESS',
    subtitle: 'SYNTHESIZE INTELLIGENCE',
    footer: 'POWERED BY DEEPSEEK',
    accent: '#f2c21c',
    bg: '#0b0e11',
    fg: '#e6ecf2'
  }

  function cfg() {
    var raw = (window.__DSH_CURTAIN__ && typeof window.__DSH_CURTAIN__ === 'object') ? window.__DSH_CURTAIN__ : {}
    var out = {}
    for (var k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k)) out[k] = DEFAULTS[k]
    }
    for (var k2 in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, k2) && raw[k2] !== undefined && raw[k2] !== null) {
        out[k2] = raw[k2]
      }
    }
    out.speed = Math.min(3, Math.max(0.35, Number(out.speed) || 1))
    return out
  }

  var C = cfg()

  /* ── 小工具 ────────────────────────────────────────────────────────────── */
  function el(tag, cls, text) {
    var n = document.createElement(tag)
    if (cls) n.className = cls
    if (text != null) n.textContent = text
    return n
  }
  function warn(msg) {
    try { if (typeof console !== 'undefined' && console.warn) console.warn('[dsh-curtain] ' + msg) } catch (e) {}
  }

  /* ── 内容生成：协议"外星文" + 背景终端日志 ──────────────────────────────
     两者都用固定种子的伪随机 —— 同一份种子结果永远一样，
     不会每帧变，也不会刷新一次换一套。想换文案就改 AGREEMENT.seed / CODEBG.seed。 */
  function rngOf(seed) {
    var s = seed >>> 0
    return function () {
      s = (s + 0x6D2B79F5) >>> 0
      var t = Math.imul(s ^ (s >>> 15), 1 | s)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }
  function pick(rnd, arr) { return arr[(rnd() * arr.length) | 0] }
  function pad2(n) { return (n < 10 ? '0' : '') + n }
  function pad3(n) { return n < 10 ? '00' + n : (n < 100 ? '0' + n : '' + n) }

  /* 外星文用「希腊 + 西里尔」字母：所有系统字体都覆盖这两个区段，不会出豆腐块。 */
  var ALIEN_UP = 'ΛΞΔΦΨΩΘΣΓΠΡΤΥΒΝΜЖЦЩЭЮЯӐӖҊҌӀ'
  var ALIEN_LO = 'λξδφψωθσγπρτυβνμжцщэюяӑӗҋҍ'
  function alienWord(rnd, min, max) {
    var n = min + ((rnd() * (max - min + 1)) | 0)
    var s = ''
    for (var i = 0; i < n; i++) {
      s += (i === 0 || rnd() < 0.55)
        ? ALIEN_UP.charAt((rnd() * ALIEN_UP.length) | 0)
        : ALIEN_LO.charAt((rnd() * ALIEN_LO.length) | 0)
    }
    return s
  }
  function alienSentence(rnd) {
    var words = 5 + ((rnd() * 8) | 0)
    var out = []
    for (var i = 0; i < words; i++) out.push(alienWord(rnd, 3, 9))
    return out.join(' ') + '.'
  }
  function alienClauses() {
    var rnd = rngOf(AGREEMENT.seed)
    var out = []
    for (var i = 0; i < AGREEMENT.clauses; i++) {
      var paras = 1 + ((rnd() * 3) | 0)
      var text = []
      for (var j = 0; j < paras; j++) text.push(alienSentence(rnd))
      out.push({ no: '\u00a7 ' + pad2(i + 1), text: text.join(' ') })
    }
    return out
  }

  var CODE_TAGS = ['SYS', 'NET', 'CORE', 'MEM', 'TLS', 'IDX', 'AUTH', 'SYNC', 'DISK', 'HEAP', 'GPU', 'IO']
  var CODE_VERB = ['mount', 'bind', 'probe', 'flush', 'commit', 'resolve', 'attach', 'rekey',
                   'drain', 'seal', 'verify', 'index', 'merge', 'trim', 'lock', 'spawn']
  var CODE_OBJ = ['module', 'sector', 'header', 'buffer', 'manifest', 'payload', 'signature',
                  'channel', 'ledger', 'kernel', 'shard', 'cursor', 'vector', 'digest']
  var CODE_OK = ['OK', 'DONE', 'SEALED', 'READY', 'ACK', 'PASS']
  function hex(rnd, n) {
    var h = '0123456789ABCDEF', s = ''
    for (var i = 0; i < n; i++) s += h.charAt((rnd() * 16) | 0)
    return s
  }
  function codeLines(seed) {
    var rnd = rngOf(seed)
    var out = []
    for (var i = 0; i < CODEBG.lines; i++) {
      var t = pad2((rnd() * 24) | 0) + ':' + pad2((rnd() * 60) | 0) + ':' + pad2((rnd() * 60) | 0) +
              '.' + pad3((rnd() * 1000) | 0)
      var text = t + '  [' + pick(rnd, CODE_TAGS) + ']  ' +
                 pick(rnd, CODE_VERB) + ' ' + pick(rnd, CODE_OBJ) + '/' + hex(rnd, 6) +
                 '  0x' + hex(rnd, 8) + '  ' + pick(rnd, CODE_OK)
      var r = rnd()
      out.push({ text: text, kind: r < 0.12 ? 'hi' : (r < 0.34 ? 'dim' : '') })
    }
    return out
  }

  /* ── 时间线引擎 ────────────────────────────────────────────────────────── */
  /* 设计要点（这里踩过一次坑，别改回去）：
     跳过/结束后，挂起的等待必须「保持 pending」而不是 resolve ——
     如果 resolve，那条 Promise 链会一路冲到底，把后面的 setInterval、
     DOM 操作全跑一遍，而此时 finish() 已经执行过，没人再清理它们，
     结果是定时器在后台空转到页面关闭。
     所以用 cancellers：中止时只「取消」（清定时器 / 摘监听），不 resolve。 */
  var timers = []
  var cancellers = []
  var skipped = false
  var finished = false
  var awaitingUser = false        // 正在等用户操作（此时绝不兜底放行）
  var failsafe = null

  /** 看门狗：只在「长时间没有任何进展」时才兜底放行。
      ─────────────────────────────────────────────────────────────────────
      绝对不能在「等用户操作」时开火 —— 用户读一会儿协议、或者盯着圆钮
      犹豫一下，整个动画就被拆掉了。所以：
        · 每次 wait() 正常走完 = 有进展 → 重新计时
        · 等用户期间只是复检，不拆
      等用户时唯一的兜底出口是 Esc / SKIP。 */
  function armFailsafe(ms) {
    if (failsafe) clearTimeout(failsafe)
    failsafe = setTimeout(function () {
      failsafe = null
      if (finished) return
      if (awaitingUser) { armFailsafe(4000); return }
      warn('看门狗：长时间没有进展，兜底放行')
      window.__DSH_CURTAIN_FAILED__ = true
      finish()
    }, ms)
  }
  function stopFailsafe() {
    if (failsafe) { clearTimeout(failsafe); failsafe = null }
  }

  /** 毫秒换算：所有时长都过这一层，改 speed 就是整体快慢。 */
  function ms(base) { return Math.round(base / C.speed) }

  /** 登记式延时：可被 abort() 一键取消。 */
  function wait(base) {
    return new Promise(function (resolve) {
      if (skipped || finished) return          // 已中止：永不 resolve，这条链就此停住
      var done = false
      var timer = setTimeout(function () {
        if (done) return
        done = true
        drop(cancel)
        armFailsafe(9000)               // 有进展 → 看门狗重新计时
        resolve()
      }, Math.max(0, ms(base)))
      function cancel() {
        if (done) return
        done = true
        clearTimeout(timer)
        drop(cancel)
      }
      timers.push(timer)
      cancellers.push(cancel)
    })
  }

  function drop(fn) {
    var i = cancellers.indexOf(fn)
    if (i >= 0) cancellers.splice(i, 1)
  }

  /* 右上角的实时时钟。 */
  function paintClock() {
    if (!ui.meta1) return
    var t = new Date()
    function two(n) { return (n < 10 ? '0' : '') + n }
    ui.meta1.textContent = 'REV ' + (typeof REV === 'string' ? REV : '0.1.0') + ' \u00b7 ' +
      two(t.getHours()) + ':' + two(t.getMinutes()) + ':' + two(t.getSeconds())
  }

  /** 一键取消所有登记过的定时器，并跑掉所有 canceller（监听、Observer 等）。
      这是 finish() / destroy() / 跳过 的共同出口。 */
  function abort() {
    var i
    for (i = 0; i < timers.length; i++) {
      try { clearTimeout(timers[i]) } catch (e) {}
    }
    timers.length = 0
    var list = cancellers.slice()
    cancellers.length = 0
    for (i = 0; i < list.length; i++) {
      try { list[i]() } catch (e) {}
    }
  }

  /* ── 音频 ────────────────────────────────────────────────────────────────
     不是"单个振荡器响一下"，而是一套小合成器：
       · 总线挂压缩器 —— 低频冲击才有份量而不爆音
       · 挂一个卷积混响（脉冲响应现场生成）—— 这是"大气磅礴"的主要来源，
         没有它所有声音都是干瘪的蜂鸣
       · 每条 CUE 是"分层配方"：低频下潜 + 噪声撞击 + 中频体 + 高频微光
     想调音色就改下面的 CUE 表，不用碰引擎。 */
  var audio = (function () {
    var actx = null
    var master = null
    var verbIn = null
    var noiseBuf = null
    var dead = false

    function vol() {
      var v = C.soundVolume == null ? 0.5 : C.soundVolume
      return Math.max(0, Math.min(1, v)) * 0.9
    }

    /** 一段衰减噪声，当混响脉冲响应用（左右声道略有差异 → 有空间感） */
    function makeImpulse(sec, decay) {
      var n = Math.max(1, Math.floor(actx.sampleRate * sec))
      var buf = actx.createBuffer(2, n, actx.sampleRate)
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch)
        for (var i = 0; i < n; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay)
        }
      }
      return buf
    }

    function ac() {
      if (actx || dead || !C.sound) return actx
      try {
        var Impl = window.AudioContext || window.webkitAudioContext
        if (!Impl) { dead = true; return null }
        actx = new Impl()

        master = actx.createGain()
        master.gain.value = vol()
        var comp = actx.createDynamicsCompressor()
        comp.threshold.value = -14
        comp.knee.value = 20
        comp.ratio.value = 4
        comp.attack.value = 0.004
        comp.release.value = 0.22
        master.connect(comp)
        comp.connect(actx.destination)

        var conv = actx.createConvolver()
        conv.buffer = makeImpulse(3.2, 2.4)
        var wet = actx.createGain()
        wet.gain.value = 0.85
        conv.connect(wet)
        wet.connect(master)
        verbIn = actx.createGain()
        verbIn.gain.value = 1
        verbIn.connect(conv)

        /* 白噪声源，撞击 / 风声类音色复用这一条 */
        var n = Math.floor(actx.sampleRate * 1.2)
        noiseBuf = actx.createBuffer(1, n, actx.sampleRate)
        var nd = noiseBuf.getChannelData(0)
        for (var i = 0; i < n; i++) nd[i] = Math.random() * 2 - 1
      } catch (e) { actx = null; dead = true }
      return actx
    }

    /** 播一层：要么是振荡器（可滑音），要么是过滤后的噪声 */
    function layer(sp, t, k, verb) {
      var dur = sp.dur || 0.5
      var atk = Math.min(sp.atk == null ? 0.02 : sp.atk, dur * 0.85)
      var peak = Math.max(0.0002, (sp.g || 0.1) * k)

      var g = actx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.linearRampToValueAtTime(peak, t + atk)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
      g.connect(master)

      if (verb > 0) {
        var vs = actx.createGain()
        vs.gain.value = verb
        g.connect(vs)
        vs.connect(verbIn)
      }

      var i
      if (sp.noise) {
        var src = actx.createBufferSource()
        src.buffer = noiseBuf
        src.loop = true
        var f = actx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = sp.lp || 1200
        f.Q.value = sp.q == null ? 0.7 : sp.q
        src.connect(f)
        f.connect(g)
        src.start(t)
        src.stop(t + dur + 0.03)
      } else {
        var osc = actx.createOscillator()
        osc.type = sp.type || 'sine'
        osc.frequency.setValueAtTime(sp.f, t)
        if (sp.to) {
          osc.frequency.exponentialRampToValueAtTime(sp.to, t + dur * (sp.glide == null ? 0.8 : sp.glide))
        }
        osc.connect(g)
        osc.start(t)
        osc.stop(t + dur + 0.03)
      }
    }

    function play(name, k) {
      var c = ac()
      if (!c) return
      var cue = CUE[name]
      if (!cue) return
      if (c.state === 'suspended') { try { c.resume() } catch (e) {} }
      var t0 = c.currentTime + 0.01
      var scale = k == null ? 1 : k
      var verb = cue.verb == null ? 0.5 : cue.verb
      var i
      for (i = 0; i < cue.layers.length; i++) {
        var sp = cue.layers[i]
        layer(sp, t0 + (sp.delay || 0), scale, verb)
      }
    }

    return {
      resume: function () {
        var c = ac()
        if (c && c.state === 'suspended') { try { c.resume() } catch (e) {} }
      },
      play: play
    }
  })()

  /* ── 英文报幕（Web Speech）───────────────────────────────────────────────
     用 Chromium 内置的 speechSynthesis，**不需要任何音频素材**。
     检测不到引擎、或者系统里没有英文嗓音，就整段静默跳过 —— 不报错、不影响动画。
     想改文案只动下面 NARRATION 这张表。 */
  var NARRATION = {
    standby:  'System standby. Awaiting operator input.',
    protocol: 'Access protocol. Acknowledgement required.',
    welcome:  'Welcome to D S H. Heavy industry systems online.',
    proceed:  'Initialization sequence engaged.'
  }

  /* ── 英文报幕 ────────────────────────────────────────────────────────────
     播的是 lib/assets/voice-<key>.aac 四个真人录音（裸 ADTS AAC，
     Chromium 能直接解码，实测 canPlayType('audio/aac') = probably）。
     键名就是 NARRATION 的键：standby / protocol / welcome / proceed。

     两个要点：
       ① 四个 <audio> 挂在 <body> 上，**不能挂 root 里** ——
          揭幕时 root 会被整个删掉，最后一句「proceed」会被当场掐断。
       ② 和语音合成一样，浏览器要求先有一次用户操作才允许出声，
          所以没解锁时先攒着最后一条，用户一点就补念。 */
  var narrator = (function () {
    var clips = {}              // key -> <audio>
    var ready = false
    var built = false
    var unlocked = false
    var pending = null
    var why = '尚未初始化'
    var moaned = false
    var spokeOnce = false
    var playing = null           // 当前正在念的那个 <audio>
    var gen = 0                  // 代数：cancel() 时 +1，作废所有排队中的句子

    function vol() {
      return Math.max(0, Math.min(1, C.soundVolume == null ? 0.5 : C.soundVolume))
    }

    function build() {
      if (built) return
      built = true
      if (!C.sound) { why = '设置里关掉了声音'; return }
      var body = document.body
      if (!body) { why = 'document.body 还不存在'; return }
      for (var k in NARRATION) {
        if (!NARRATION.hasOwnProperty(k)) continue
        try {
          var a = document.createElement('audio')
          a.preload = 'auto'
          a.src = asset('voice-' + k + '.aac')
          a.style.display = 'none'
          body.appendChild(a)
          clips[k] = a
        } catch (e) { /* 单个建不起来不影响其它 */
        }
      }
      ready = false
      for (var k2 in clips) { if (clips.hasOwnProperty(k2)) { ready = true; break } }
      why = ready ? '' : '四个语音文件一个都没建起来'
    }

    function moan() {
      if (moaned) return
      moaned = true
      warn('英文报幕没启用 —— ' + why)
    }

    /* ── 字幕 ──────────────────────────────────────────────────────────
       挂在音频事件上：playing → 显示，ended/error → 隐藏。
       好处是不用为每句话算时长，也不会和语音错位。 */
    function showCaption(key) {
      if (!ui.caption || !ui.captionText) return
      ui.captionText.textContent = NARRATION[key] || ''
      try { ui.caption.classList.add('dc-in') } catch (e) {}
    }

    function hideCaption() {
      if (!ui.caption) return
      try { ui.caption.classList.remove('dc-in') } catch (e) {}
    }

    function wire(a, key) {
      if (a.dataset.wired === '1') return
      a.dataset.wired = '1'
      /* 刻意**不动 BGM 的音量** —— 语音和音乐各放各的，不闪避。 */
      a.addEventListener('playing', function () {
        spokeOnce = true
        playing = a
        showCaption(key)          // 字幕挂在音频事件上，天然同步，不用另排定时器
      })
      a.addEventListener('ended', function () {
        if (playing === a) playing = null
        hideCaption()
      })
      a.addEventListener('error', function () {
        if (playing === a) playing = null
        hideCaption()
        why = '语音文件播不出来：voice-' + key + '.aac'
        moan()
      })
      a.addEventListener('pause', function () {
        if (a.ended) hideCaption()
      })
    }

    /** 真正开始放某一句。 */
    function fire(key, a) {
      try { a.currentTime = 0 } catch (e) {}
      a.volume = vol()
      wire(a, key)
      playing = a
      /* ⚠️ 必须包 try/catch：出声失败绝不能把时间线带崩。
         在没有真正 Audio 元素的环境里 a.play 根本不存在，会直接抛 TypeError。 */
      var p = null
      try { p = a.play() } catch (e) { p = null; playing = null; why = '这个环境不能播音频'; moan() }
      if (p && p.catch) {
        p.catch(function () {
          if (playing === a) playing = null
          /* 被自动播放策略拦下了 —— 攒着，等第一次用户操作再补念 */
          pending = key
          why = '还没拿到用户操作，已攒着等解锁'
        })
      }
    }

    function play(key) {
      build()
      if (!ready) { moan(); return }
      var a = clips[key]
      if (!a) { why = '没有这一条：' + key; moan(); return }

      /* ⚠️ 正在念别的就**不打断** —— 等它念完再接着念。
         之前是「抢断式」的：点圆钮才开始念第一句（2.88 秒），
         而协议卡在点击后约 2.9 秒就到了，第一句正好被切掉尾巴。
         现在改成启动即播 + 不打断，两句话各念各的、都念完整。
         （这里刻意不用 setInterval —— 靠 ended 事件推进，没定时器残留。） */
      if (playing && playing !== a && !playing.paused && !playing.ended) {
        var prev = playing
        var myGen = gen
        var once = function () {
          prev.removeEventListener('ended', once)
          prev.removeEventListener('error', once)
          /* ⚠️ 这里**不能**再判 finished。
             第四句排队时，第三句念完往往已经揭幕了 —— 加了 finished 判断，
             排队的第四句就会被这道闸门丢掉（真踩过）。
             跳过（skipped）和实例被拆（gen 变了）才该丢。 */
          if (skipped || myGen !== gen) return
          fire(key, a)
        }
        prev.addEventListener('ended', once)
        prev.addEventListener('error', once)
        return
      }
      fire(key, a)
    }

    return {
      /** 念一句。还没解锁就先攒着 —— 只留最后一条，过时的直接丢掉。 */
      say: function (key) {
        if (!C.sound || !key) return
        /* 容错：允许误传「文案」而不是「键名」。
           这个坑真踩过 —— 传了 NARRATION.standby 那串文字，而播放器是按
           voice-<键名>.aac 找文件的，查不到就静默跳过，四句全哑。
           现在只要文案对得上，就自动换回键名。 */
        if (!NARRATION.hasOwnProperty(key)) {
          var hit = null
          for (var k in NARRATION) {
            if (NARRATION.hasOwnProperty(k) && NARRATION[k] === key) { hit = k; break }
          }
          if (!hit) { why = '未知的报幕键：' + key; moan(); return }
          key = hit
        }
        /* 刻意**不**先攒着 —— 启动就直接试播第一句。
           只有被自动播放策略真的拦下来时（play() 被 reject）才转成 pending，
           等第一次用户操作再补念。这样第一句能拿到完整的场景时长。 */
        play(key)
      },
      /** 第一次用户操作时调用：这时才允许出声。 */
      unlock: function () {
        unlocked = true
        if (pending) { var k = pending; pending = null; play(k) }
      },
      report: function () {
        var names = []
        for (var k in clips) { if (clips.hasOwnProperty(k)) names.push(k) }
        return {
          mode: 'audio-file',
          ready: ready,
          clips: names,
          unlocked: unlocked,
          spoken: spokeOnce,
          why: why || '正常'
        }
      },
      cancel: function () {
        pending = null
        for (var k in clips) {
          if (!clips.hasOwnProperty(k)) continue
          try { clips[k].pause(); clips[k].currentTime = 0 } catch (e) {}
        }
        playing = null
        hideCaption()
        gen++            // 作废所有排队中的句子
      }
    }
  })()

  /* ── DOM 装配 ──────────────────────────────────────────────────────────── */
  var root = document.getElementById(ROOT_ID)
  if (!root) {
    root = el('div')
    root.id = ROOT_ID
    root.className = 'dc-root'
    document.body.appendChild(root)
  }
  root.classList.add('dc-root')

  /* 配置 → CSS 变量 */
  root.style.setProperty('--dc-bg', C.bg)
  root.style.setProperty('--dc-fg', C.fg)
  root.style.setProperty('--dc-accent', C.accent)
  root.style.setProperty('--dc-speed', String(C.speed))
  if (C.forceMotion) document.documentElement.classList.add('dc-force-motion')

  root.innerHTML =
    '<div class="dc-stage"></div>' +
    /* ── 底图 + 框架层 HUD（纯装饰，全程常驻）──────────────────────────── */
    '<div class="dc-photo" aria-hidden="true"></div>' +
    '<div class="dc-hud" aria-hidden="true">' +
      '<div class="dc-hud-plate">' +
        '<b class="dc-hud-plate-name"></b>' +
        '<span>INDUSTRIAL</span>' +
        '<span>HEAVY INDUSTRIES</span>' +
        '<span>COOPERATION</span>' +
      '</div>' +
      '<div class="dc-hud-auth">' +
        '<span class="dc-hud-auth-a">AUTHORIZED ACCESS ONLY</span>' +
        '<span class="dc-hud-auth-b">CLEARANCE LEVEL</span>' +
        '<span class="dc-hud-auth-c">YELLOW<i></i></span>' +
      '</div>' +
      '<div class="dc-hud-rail-l">' +
        '<span class="dc-hud-scale"></span>' +
        '<span class="dc-hud-vbar"><i></i></span>' +
      '</div>' +
      '<div class="dc-hud-rail-r">' +
        '<span class="dc-hud-coord">// 31.2304\u00b0N<br>121.4737\u00b0E</span>' +
        '<span class="dc-hud-elev">ELEVATION<b>23m</b></span>' +
      '</div>' +
      '<div class="dc-hud-standby">' +
        '<b>STANDBY MODE</b><span>WAITING FOR COMMAND</span><i></i><i></i>' +
      '</div>' +
      '<div class="dc-hud-bar">' +
        '<span class="dc-hud-bar-chip"><i></i><i></i><i></i><i></i><i></i></span>' +
        '<span class="dc-hud-bar-name"></span>' +
        '<span class="dc-hud-bar-track">DAWN / SKYLINE / HORIZON</span>' +
        '<span class="dc-hud-bar-box"></span>' +
      '</div>' +
      /* 左下角旋转唱片：BGM 正在播的提示 */
      '<span class="dc-disc" aria-hidden="true"></span>' +
    '</div>' +
    /* ── 幕二：协议场景（初始 hidden，由 sceneAgreement 打开）────────────── */
    '<div class="dc-agree" hidden>' +
      '<div class="dc-code" aria-hidden="true">' +
        '<div class="dc-code-col"><div class="dc-code-track"></div></div>' +
        '<div class="dc-code-col"><div class="dc-code-track"></div></div>' +
        '<div class="dc-code-col"><div class="dc-code-track"></div></div>' +
      '</div>' +
      '<div class="dc-agree-scrim"></div>' +
      /* 卡片两侧的竖排小字（参考图里那种装饰性标签） */
      '<span class="dc-agree-side dc-agree-side-l">\u25a1 SERMIS \u25a1 SERVICE \u2191</span>' +
      '<span class="dc-agree-side dc-agree-side-r">INDUSTRIAL SERVICES \u2191</span>' +
      /* ── 协议卡片：整屏一张，顶栏 + 左徽右文 + 底部同意按钮 ─────────── */
      '<section class="dc-pact">' +
        /* 底板（背景 + 边框）单独一层：投影挂在卡片上，而投影不能被裁 */
        '<div class="dc-pact-plate"></div>' +
        /* 像素幕：盖住整张卡片，进场时逐格消失 → 卡片"像素级"出现。
           格子由 paintAgreement() 生成，每格的延迟写在行内 --d 上。 */
        '<div class="dc-pixel" aria-hidden="true"></div>' +
        '<header class="dc-pact-head">' +
          '<span class="dc-pact-tag"><i></i><b>USER AGREEMENT</b></span>' +
          '<span class="dc-pact-id">' +
            '<b class="dc-pact-id-name">DSH-UI-AGREEMENT</b>' +
            '<i class="dc-pact-globe"></i>' +
            '<i class="dc-pact-meter"><b></b><b></b><b></b><b></b><b></b><b></b></i>' +
            '<i class="dc-pact-dash"></i>' +
          '</span>' +
        '</header>' +
        '<div class="dc-pact-main">' +
          '<div class="dc-pact-brand">' +
            '<div class="dc-pact-emblem">' +
              '<span class="dc-pact-emblem-ring"></span>' +
              '<span class="dc-pact-emblem-tick"></span>' +
              '<svg class="dc-pact-mark" viewBox="0 0 100 126" aria-hidden="true"><path d=""/></svg>' +
            '</div>' +
            '<b class="dc-pact-wordmark"></b>' +
            '<span class="dc-pact-slogan"></span>' +
            '<i class="dc-pact-brand-rule"></i>' +
          '</div>' +
          '<div class="dc-pact-doc">' +
            '<h2 class="dc-pact-title"><i></i><span></span></h2>' +
            '<span class="dc-pact-hr"></span>' +
            '<div class="dc-pact-body"></div>' +
          '</div>' +
        '</div>' +
        '<footer class="dc-pact-foot">' +
          '<button class="dc-accept" type="button">' +
            '<span class="dc-accept-mark"></span>' +
            '<span class="dc-accept-text"><b class="dc-accept-label"></b>' +
              '<i class="dc-accept-sub"></i></span>' +
            /* 四角标做成按钮的子元素 —— 这样 inset:0 就是按钮的框，
               不用在两处重复写死宽高。 */
            '<span class="dc-accept-corners"><i></i><i></i><i></i><i></i></span>' +
            /* 按下后射出的科技线条：左右水平 + 上下垂直 + 四个角标外移 */
            '<span class="dc-accept-fx">' +
              '<i class="dc-fx-l"></i><i class="dc-fx-r"></i>' +
              '<i class="dc-fx-t"></i><i class="dc-fx-b"></i>' +
              '<i class="dc-fx-c1"></i><i class="dc-fx-c2"></i>' +
              '<i class="dc-fx-c3"></i><i class="dc-fx-c4"></i>' +
            '</span>' +
          '</button>' +
        '</footer>' +
      '</section>' +
    '</div>' +
    /* ── 幕四：英雄屏（点完「同意」之后的界面）─────────────────────────────
       中央大圆 + 字标 + START；四周一圈 HUD 细节。
       动态全部在 CSS（K 区）：圆环反向旋转、十字轴从中心伸出、
       黄色短划公转、连线从中心向两侧铺开。 */
    '<section class="dc-hero" hidden>' +
      '<span class="dc-hero-wire dc-hero-wire-l"></span>' +
      '<span class="dc-hero-wire dc-hero-wire-r"></span>' +

      '<div class="dc-hero-brand">' +
        '<b class="dc-hero-logo">dsh</b>' +
        '<span class="dc-hero-brand-meta">' +
          '<i>DURABLE</i><i>SOLID</i><i>HEAVY INDUSTRY</i>' +
        '</span>' +
      '</div>' +
      '<span class="dc-hero-brand-strip"></span>' +

      '<div class="dc-hero-motto">INDUSTRY \u00b7 STRENGTH \u00b7 FUTURE</div>' +
      '<span class="dc-hero-plus"></span>' +

      '<div class="dc-hero-hello">' +
        '<i></i>' +
        '<b>WELCOME TO DSH</b>' +
        '<span>\u6b22\u8fce\u6765\u5230 DSH \u91cd\u5de5\u79d1\u6280</span>' +
        '<em></em>' +
      '</div>' +

      '<div class="dc-hero-geo">' +
        '<b><i></i>DSH HEAVY INDUSTRY</b>' +
        '<span>// 37.7749\u00b0N, 122.4194\u00b0E</span>' +
      '</div>' +

      '<div class="dc-hero-core">' +
        '<div class="dc-hero-rings">' +
          '<span class="dc-hero-ring dc-hero-ring-a"></span>' +
          '<span class="dc-hero-ring dc-hero-ring-b"></span>' +
          '<span class="dc-hero-ring dc-hero-ring-c"></span>' +
        '</div>' +
        '<span class="dc-hero-axis dc-hero-axis-h"></span>' +
        '<span class="dc-hero-axis dc-hero-axis-v"></span>' +
        '<div class="dc-hero-orbit">' +
          '<span class="dc-hero-chip"></span><span class="dc-hero-chip"></span>' +
          '<span class="dc-hero-chip"></span><span class="dc-hero-chip"></span>' +
        '</div>' +
        '<span class="dc-hero-brk dc-hero-brk-a"></span>' +
        '<span class="dc-hero-brk dc-hero-brk-b"></span>' +
        '<svg class="dc-hero-mark" viewBox="0 0 290 100" aria-hidden="true">' +
          '<path class="dc-hero-mark-body" d=""/>' +
          '<path class="dc-hero-mark-accent" d=""/>' +
        '</svg>' +
        '<div class="dc-hero-claim">DURABLE / SOLID / HEAVY INDUSTRY</div>' +
      '</div>' +

      '<button class="dc-hero-start" type="button">' +
        '<span class="dc-hero-start-en">START</span>' +
        '<span class="dc-hero-start-cn">\u2014 \u70b9\u51fb\u5f00\u59cb \u2014</span>' +
        '<span class="dc-hero-start-corners"><i></i><i></i><i></i><i></i></span>' +
        '<span class="dc-hero-start-ring"></span>' +
      '</button>' +

      '<div class="dc-hero-sys">' +
        '<b>SYSTEM INITIALIZING...</b>' +
        '<span>POWERED BY DSH CORE SYSTEM</span>' +
        '<span>VER. 1.0.0.2024-08-16</span>' +
      '</div>' +
      '<span class="dc-hero-hazard"></span>' +

      '<div class="dc-hero-copy">ALL RIGHTS RESERVED BY DSH HEAVY INDUSTRY</div>' +
    '</section>' +
    /* 报幕字幕：顶部居中。三个场景的中间都被占了（协议卡 / 大圆 / START），
       顶中是唯一全程空着的地方。文案由 JS 按正在播的那一句填。 */
    '<div class="dc-caption" aria-hidden="true">' +
      '<i></i><span></span>' +
    '</div>' +
    '<div class="dc-frame">' +
      '<i class="dc-corner tl"></i><i class="dc-corner tr"></i>' +
      '<i class="dc-corner bl"></i><i class="dc-corner br"></i>' +
      '<div class="dc-scanline"></div>' +
    '</div>' +
    '<div class="dc-load">' +
      '<div class="dc-load-brand"><b></b><span></span></div>' +
      '<div class="dc-load-rule"></div>' +
      '<div class="dc-load-status"><span class="dc-load-label"></span><span class="dc-load-pct">00%</span></div>' +
      '<div class="dc-load-bar"><i></i></div>' +
      '<div class="dc-load-log"></div>' +
    '</div>' +
    '<div class="dc-meta"><span class="dc-meta-1"></span></div>' +
    '<div class="dc-center">' +
      '<div class="dc-dial-wrap">' +
        '<span class="dc-dial-halo"></span>' +
        '<span class="dc-dial-brackets"><i></i><i></i><i></i><i></i></span>' +
        '<button class="dc-dial" type="button">' +
          '<span class="dc-dial-ring"></span>' +
          '<span class="dc-dial-ticks"></span>' +
          '<span class="dc-dial-scan"></span>' +
          '<span class="dc-dial-inner"></span>' +
          '<span class="dc-dial-sheen"></span>' +
          '<span class="dc-dial-label"></span>' +
          '<svg class="dc-dial-whale" viewBox="0 0 50 50" aria-hidden="true">' +
            '<path class="dc-whale-base" pathLength="100"></path>' +
            '<path class="dc-whale-ink" pathLength="100"></path>' +
          '</svg>' +
        '</button>' +
      '</div>' +
      '<div class="dc-dial-caption"></div>' +
      '<h1 class="dc-title"></h1>' +
      '<div class="dc-sub"></div>' +
      '<div class="dc-rule"></div>' +
    '</div>' +
    /* 中央圆钮那一层（第一幕用）。英雄屏用的是它自己的一套。 */
    '<div class="dc-beat"></div>' +
    '<button class="dc-skip" type="button">SKIP \u25b8</button>' +
    '<div class="dc-foot"><span></span></div>' +
    /* 背景音乐。src 由 JS 写（预览页和 DSH 的路径不同），循环播放。 */
    '<audio class="dc-bgm" loop preload="auto"></audio>'

  function q(sel) { return root.querySelector(sel) }
  var ui = {
    stage: q('.dc-stage'),
    photo: q('.dc-photo'), hud: q('.dc-hud'),
    hudPlateName: q('.dc-hud-plate-name'), hudBarName: q('.dc-hud-bar-name'),
    /* 幕二：协议场景 */
    agree: q('.dc-agree'), code: q('.dc-code'), agreeScrim: q('.dc-agree-scrim'),
    pact: q('.dc-pact'), pactPixel: q('.dc-pixel'),
    pactTitle: q('.dc-pact-title'), pactTitleText: q('.dc-pact-title span'),
    pactBody: q('.dc-pact-body'),
    pactWordmark: q('.dc-pact-wordmark'), pactSlogan: q('.dc-pact-slogan'),
    pactMark: q('.dc-pact-mark'),
    accept: q('.dc-accept'), acceptLabel: q('.dc-accept-label'), acceptSub: q('.dc-accept-sub'),
    frame: q('.dc-frame'), scanline: q('.dc-scanline'),
    /* 幕四：英雄屏 */
    hero: q('.dc-hero'), heroMark: q('.dc-hero-mark'),
    heroStart: q('.dc-hero-start'), heroLogo: q('.dc-hero-logo'),
    load: q('.dc-load'), loadBrandB: q('.dc-load-brand b'), loadBrandS: q('.dc-load-brand span'),
    loadLabel: q('.dc-load-label'), loadPct: q('.dc-load-pct'),
    loadBar: q('.dc-load-bar'), loadBarFill: q('.dc-load-bar i'), loadLog: q('.dc-load-log'),
    meta: q('.dc-meta'), meta1: q('.dc-meta-1'),
    center: q('.dc-center'),
    dialWrap: q('.dc-dial-wrap'), dial: q('.dc-dial'), dialCaption: q('.dc-dial-caption'),
    dialLabel: q('.dc-dial-label'),
    whaleBase: q('.dc-whale-base'), whaleInk: q('.dc-whale-ink'),
    title: q('.dc-title'), sub: q('.dc-sub'), rule: q('.dc-rule'),
    skip: q('.dc-skip'), foot: q('.dc-foot span'),
    disc: q('.dc-disc'), bgm: q('.dc-bgm'),
    caption: q('.dc-caption'), captionText: q('.dc-caption span')
  }

  /* 内容填充（全部来自配置，设置页可改） */
  ui.loadBrandB.textContent = C.brand
  ui.loadBrandS.textContent = C.title
  ui.loadLabel.textContent = LOADING.label
  ui.loadLog.textContent = LOADING.logs[0]
  ui.dialLabel.textContent = DIAL.label
  ui.dialCaption.textContent = DIAL.caption
  ui.title.textContent = C.title
  ui.foot.textContent = C.footer
  ui.meta1.textContent = 'REV 0.1.0'

  /* 鲸鱼：两层同路径叠放 —— 底层灰（常驻），上层蓝（点击后一笔画出来） */
  ;(function paintWhale() {
    ui.whaleBase.setAttribute('d', WHALE_PATH)
    ui.whaleInk.setAttribute('d', WHALE_PATH)
  })()

  /* 圆钮形状兜底 —— 用行内样式把"正圆"这件事钉死。
     ─────────────────────────────────────────────────────────────────────
     为什么要多这一层：宿主对 .css 请求的处理可能和 .js 不同
     （.js 确定能加载 —— 动画跑得起来就是证据），一旦样式表没到位，
     <button> 就会露出浏览器默认的圆角方块外观。
     行内样式优先级最高，而且这段跟着 boot.js 走，不依赖样式表。
     另外 border-radius:50% 只有在正方形上才是正圆，所以顺手把比例也锁住。 */
  ;(function hardenDial() {
    var s = ui.dial.style
    s.appearance = 'none'
    s.webkitAppearance = 'none'
    s.borderRadius = '50%'
    /* ☠️ corner-shape 不能省：
       DSH 的 Chromium 里它的默认值是 squircle（超椭圆），
       不显式写 round 的话 border-radius:50% 会渲染成圆角方形而不是正圆。 */
    s.cornerShape = 'round'
    s.width = '100%'
    s.height = 'auto'
    s.aspectRatio = '1 / 1'
    s.background = 'none'
    s.border = '0'
    s.padding = '0'
    s.margin = '0'
    s.minWidth = '0'
    s.minHeight = '0'
    s.boxShadow = 'none'
    s.outline = 'none'
    s.display = 'block'
    s.color = 'inherit'
    s.font = 'inherit'
    s.cursor = 'pointer'
  })()

  /* 底图 + 框架层文案。背景图 URL 必须由 JS 写 ——
     DSH 里是 /dsh-curtain/asset/xxx.jpg，离线预览页是 ../lib/assets/xxx.jpg。 */
  ;(function paintHud() {
    ui.hudPlateName.textContent = C.brand
    ui.hudBarName.textContent = C.brand
    try {
      ui.photo.style.backgroundImage = 'url("' + asset('industry.jpg') + '")'
    } catch (e) { warn('底图路径设置失败：' + e.message) }
  })()

  /* 幕四的内容：字标路径 + 厂牌缩写 */
  ;(function paintHero() {
    ui.heroMark.querySelector('.dc-hero-mark-body').setAttribute('d', HERO_MARK)
    ui.heroMark.querySelector('.dc-hero-mark-accent').setAttribute('d', HERO_MARK_ACCENT)
    ui.heroLogo.textContent = C.brand === 'DEEPSEEK' ? 'dsh' : C.brand.toLowerCase()
  })()

  /* 幕二的内容（徽记 / 协议正文 / 背景日志 / 百叶）—— 一次性建好，
     场景入场时只切 class，不在演出途中改 DOM。 */
  ;(function paintAgreement() {
    /* 左侧品牌块 */
    ui.pactMark.querySelector('path').setAttribute('d', EMBLEM_PATH)
    ui.pactWordmark.textContent = C.brand
    ui.pactSlogan.textContent = '// ' + C.brand + ' HEAVY INDUSTRY'

    /* 右侧文档块 */
    ui.pactTitleText.textContent = AGREEMENT.title
    ui.acceptLabel.textContent = AGREEMENT.accept
    ui.acceptSub.textContent = AGREEMENT.acceptSub

    /* 协议正文。AGREEMENT.alien = true 时改用生成的"外星文"条款。 */
    var html = ''
    if (AGREEMENT.alien) {
      var clauses = alienClauses()
      for (var i = 0; i < clauses.length; i++) {
        html += '<p class="dc-pact-clause"><b>' + clauses[i].no + '</b>' + clauses[i].text + '</p>'
      }
    } else {
      for (var j = 0; j < AGREEMENT.paragraphs.length; j++) {
        html += '<p class="dc-pact-clause">' + AGREEMENT.paragraphs[j] + '</p>'
      }
    }
    ui.pactBody.innerHTML = html

    /* 背景日志：三列并排铺满整屏（单列只能盖住左半，右边会空一片）。
       每列一份独立内容 + 独立速度 + 独立相位，读起来像三台终端在刷。 */
    var cols = ui.code ? ui.code.children : []
    for (var ci = 0; ci < cols.length; ci++) {
      var track = cols[ci].children && cols[ci].children[0]
      if (!track) continue
      var lines = codeLines(CODEBG.seed + ci * 977)
      var buf = ''
      for (var pass = 0; pass < 2; pass++) {
        for (var m = 0; m < lines.length; m++) {
          buf += lines[m].kind
            ? '<i class="' + lines[m].kind + '">' + lines[m].text + '</i>'
            : '<i>' + lines[m].text + '</i>'
        }
      }
      track.innerHTML = buf
      track.style.animationDuration = Math.round((CODEBG.rollMs + ci * 3400) / C.speed) + 'ms'
      track.style.animationDelay = '-' + Math.round((ci * 5600) / C.speed) + 'ms'
    }

    /* 像素幕：盖住卡片的格子。每格自己的延迟写在行内 --d 上。
       延迟 = 对角扫过的位置 + 随机抖动。
       **抖动是关键** —— 没有它，就只是一条斜线擦过去，不像"像素在闪"。 */
    var COLS = 34
    var ROWS = 21
    var SWEEP = 520      // 对角扫完一遍要多久（ms）
    var JITTER = 210     // 每格额外随机延迟上限（ms）
    var pb = ''
    for (var pr = 0; pr < ROWS; pr++) {
      for (var pc = 0; pc < COLS; pc++) {
        var pd = ((pr / ROWS) + (pc / COLS)) * 0.5 * SWEEP + Math.random() * JITTER
        pb += '<i style="--d:' + Math.round(pd / C.speed) + 'ms"></i>'
      }
    }
    ui.pactPixel.innerHTML = pb
  })()

  /* ── 视觉原子 ──────────────────────────────────────────────────────────── */
  function setIn(node, on) { if (node) node.classList.toggle('dc-in', !!on) }

  function sweep() {
    if (!ui.scanline) return
    ui.scanline.classList.remove('dc-go')
    void ui.scanline.offsetWidth          // 强制重排，动画才会重跑
    ui.scanline.classList.add('dc-go')
  }

  /* ── 加载进度（自续期循环，中止后自动停）────────────────────────────── */
  var load = { pct: 0, done: false, logIdx: 0 }
  function paintLoad() {
    var p = Math.round(load.pct * 100)
    ui.loadPct.textContent = (p < 10 ? '0' : '') + p + '%'
    ui.loadBarFill.style.width = (load.pct * 100).toFixed(1) + '%'
  }
  function tickLoad() {
    if (finished || skipped) return Promise.resolve()
    var cap = load.done ? 1 : LOADING.cap
    if (load.pct < cap - 0.002) {
      load.pct = Math.min(cap, load.pct + (cap - load.pct) * 0.085 + 0.004)
      paintLoad()
      return wait(110).then(tickLoad)
    }
    if (load.done && load.pct < 1) {
      load.pct = Math.min(1, load.pct + (1 - load.pct) * 0.28 + 0.02)
      paintLoad()
      return wait(70).then(tickLoad)
    }
    return Promise.resolve()
  }
  function tickLog() {
    if (finished || skipped) return Promise.resolve()
    if (!load.done) {
      load.logIdx = (load.logIdx + 1) % LOADING.logs.length
      ui.loadLog.textContent = LOADING.logs[load.logIdx]
    }
    return wait(LOADING.logEveryMs).then(tickLog)
  }

  /* 右上角实时时钟。刻意不用 setInterval —— 走 wait() 自续期，
     中止时那条链自然停住，不会留下任何定时器。 */
  function tickClock() {
    if (finished || skipped) return Promise.resolve()
    paintClock()
    return wait(1000).then(tickClock)
  }

  /* ── 中央按钮：点击 → 一笔画变蓝 ──────────────────────────────────────── */
  var armed = false

  /** 只负责「按下」这件事的画面反馈，不管时间线怎么等。 */
  function armDial() {
    if (armed || finished || skipped) return
    armed = true
    audio.play('confirm')
    ui.dial.classList.add('is-armed')
    ui.dialCaption.textContent = DIAL.captionArmed
    load.done = true
    ui.loadLog.textContent = 'ACCESS GRANTED'

    /* 一笔画。
       ─────────────────────────────────────────────────────────────────────
       用 pathLength="100" 把整条路径归一化成 100 个单位，dash 值直接就是 0–100，
       不再依赖 getTotalLength() 的绝对值。
       上一版用绝对值 + vector-effect:non-scaling-stroke —— 前者是用户单位、
       后者让 dash 按屏幕单位解释，两者对不上，**末段永远画不满**，就是"缺一截"的根因。
       再加一道保险：动画结束后把 dash 整个撤掉，终态一定是一条完整的线。 */
    var ink = ui.whaleInk
    var SPAN = 100
    function clearDash() {
      ink.style.strokeDasharray = 'none'
      ink.style.strokeDashoffset = '0'
    }

    if (typeof ink.animate === 'function') {
      ink.style.strokeDasharray = String(SPAN)
      ink.style.strokeDashoffset = String(SPAN)
      var anim = ink.animate(
        [{ strokeDashoffset: SPAN }, { strokeDashoffset: 0 }],
        { duration: ms(DIAL.drawMs), easing: 'cubic-bezier(.55,.06,.24,1)', fill: 'forwards' }
      )
      if (anim && typeof anim.addEventListener === 'function') anim.addEventListener('finish', clearDash)
      wait(DIAL.drawMs + 140).then(clearDash)   // 兜底：finish 事件不保证一定触发
    } else {
      clearDash()      // 不支持 Web Animations 就直接完整显形，绝不卡住
    }

    audio.play('draw')
  }

  /**
   * 等用户按下中央按钮 —— 这一幕唯一的交互。
   * 点击后要等「一笔画」放完才放行，否则转眼就切场了。
   * 关掉「需要人工确认」时，闲置 idleAutoMs 后自动按下（动画照放）。
   */
  function waitDial() {
    return new Promise(function (resolve) {
      if (armed || skipped || finished) return resolve()

      var settled = false
      function done() {
        if (settled) return
        settled = true
        awaitingUser = false
        cleanup()
        resolve()
      }
      function press(e) {
        if (e && e.preventDefault) e.preventDefault()
        if (armed) return                       // 只认第一次
        awaitingUser = false
        armDial()
        wait(DIAL.drawMs + 160).then(done)      // 等一笔画放完
      }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') press(e)
      }
      function cleanup() {
        ui.dial.removeEventListener('click', press)
        document.removeEventListener('keydown', onKey)
        drop(cancel)
      }
      /** 中止时只摘监听，不 resolve —— 让这条链永远停在这里 */
      function cancel() {
        settled = true
        awaitingUser = false
        cleanup()
      }

      ui.dial.addEventListener('click', press)
      document.addEventListener('keydown', onKey)
      cancellers.push(cancel)

      if (C.requireInteraction) {
        awaitingUser = true                     // 在等用户 —— 看门狗不许开火
      } else {
        wait(DIAL.idleAutoMs).then(press)
      }
    })
  }

  /* ── 幕二：协议场景 ──────────────────────────────────────────────────────
     左半「用户协议」面板 + 右半机械百叶展开的欢迎字，背景是滚动的终端日志。
     ------------------------------------------------------------------------ */
  var accepted = false

  /** 只负责「按下接受」的画面反馈。 */
  function acceptIt() {
    if (accepted || finished || skipped) return
    accepted = true
    audio.play('confirm')
    /* 机械按压：
       ① 立刻进入按下状态 —— 按钮下沉 + 科技线条从四边射出
       ② 文字换掉的时间点卡在「文字淡出」那一瞬间，所以看不到硬切 */
    ui.accept.classList.add('is-pressed')
    ui.pact.classList.add('is-accepted')
    wait(150).then(function () {
      if (skipped || finished) return
      ui.acceptLabel.textContent = AGREEMENT.accepted
      ui.acceptSub.textContent = AGREEMENT.acceptedSub
      ui.accept.classList.add('is-accepted')
    })
  }

  /** 等用户点「接受协议」。关掉「需要人工确认」时闲置一会儿自动接受。 */
  function waitAccept() {
    return new Promise(function (resolve) {
      if (accepted || skipped || finished) return resolve()

      var settled = false
      function done() {
        if (settled) return
        settled = true
        awaitingUser = false
        cleanup()
        resolve()
      }
      function press(e) {
        if (e && e.preventDefault) e.preventDefault()
        if (accepted) return                       // 只认第一次
        awaitingUser = false
        acceptIt()
        wait(560).then(done)                       // 让"已接受"的状态停一下再走
      }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') press(e)
      }
      function cleanup() {
        ui.accept.removeEventListener('click', press)
        document.removeEventListener('keydown', onKey)
        drop(cancel)
      }
      /** 中止时只摘监听，不 resolve —— 让这条链永远停在这里 */
      function cancel() {
        settled = true
        awaitingUser = false
        cleanup()
      }

      ui.accept.addEventListener('click', press)
      document.addEventListener('keydown', onKey)
      cancellers.push(cancel)

      if (C.requireInteraction) {
        awaitingUser = true                        // 在等用户 —— 看门狗不许开火
      } else {
        wait(AGREEMENT.idleAutoMs).then(press)
      }
    })
  }

  function sceneAgreement() {
    return Promise.resolve()
      /* 场景整体淡入（背景日志同时开始滚） */
      .then(function () {
        ui.agree.hidden = false
        void ui.agree.offsetWidth          // 摘掉 hidden 后强制一次重排，过渡才会跑
        ui.agree.classList.add('dc-in')
        narrator.say('protocol')
        return wait(300)
      })
      /* 像素级出现：格子从左上到右下逐格闪掉，卡片随之显形。
         节奏全在 paintAgreement() 的 SWEEP / JITTER 两个数里。 */
      .then(function () {
        ui.pact.classList.add('dc-in')
        audio.play('deploy')
        return wait(960)
      })
      /* 等用户点「同意」 */
      .then(function () { return waitAccept() })
      /* 整场退场 */
      .then(function () {
        ui.agree.classList.add('dc-gone')
        return wait(700)
      })
      .then(function () {
        ui.agree.hidden = true
        return Promise.resolve()
      })
  }

  /* ── 幕四：英雄屏（中央大圆 + 字标 + START）───────────────────────────────
     动态全在 CSS 的 transition-delay 里排好，这里只负责开场和等用户点 START。 */
  var started = false

  function waitStart() {
    return new Promise(function (resolve) {
      if (started || skipped || finished) return resolve()

      var settled = false
      function done() {
        if (settled) return
        settled = true
        awaitingUser = false
        cleanup()
        resolve()
      }
      function press(e) {
        if (e && e.preventDefault) e.preventDefault()
        if (started) return
        awaitingUser = false
        started = true
        audio.play('deploy')
        narrator.say('proceed')
        ui.heroStart.classList.add('is-pressed')
        wait(520).then(done)
      }
      function onKey(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') press(e)
      }
      function cleanup() {
        ui.heroStart.removeEventListener('click', press)
        document.removeEventListener('keydown', onKey)
        drop(cancel)
      }
      /** 中止时只摘监听，不 resolve —— 让这条链永远停在这里 */
      function cancel() {
        settled = true
        awaitingUser = false
        cleanup()
      }

      ui.heroStart.addEventListener('click', press)
      document.addEventListener('keydown', onKey)
      cancellers.push(cancel)

      if (C.requireInteraction) {
        awaitingUser = true                 // 在等用户 —— 看门狗不许开火
      } else {
        wait(2600).then(press)
      }
    })
  }

  function sceneHero() {
    return Promise.resolve()
      .then(function () {
        ui.hero.hidden = false
        /* 英雄屏自带左上/右上/右下的信息块，和框架层那三块会撞位 —— 让它们先退场 */
        root.classList.add('dc-hero-on')
        void ui.hero.offsetWidth            // 摘掉 hidden 后强制一次重排，过渡才会跑
        ui.hero.classList.add('dc-in')
        audio.play('rise')
        narrator.say('welcome')
        /* 3.2 秒 —— 入场编排走完就放 START 出来。
           第三句（3.82 秒）这时可能还在念，但**不影响**：
           第四句会排队等它念完，不会被吞掉（这个 bug 已经修了）。
           START 在这之前是 pointer-events:none，点不动。 */
        return wait(3200)
      })
      /* 入场走完 → START 才可点（CSS 里 .is-ready 负责它的入场和可点性） */
      .then(function () {
        ui.hero.classList.add('is-ready')
        return Promise.resolve()
      })
      .then(function () { return waitStart() })
      .then(function () {
        ui.hero.classList.add('dc-gone')
        return wait(620)
      })
      .then(function () {
        ui.hero.hidden = true
        root.classList.remove('dc-hero-on')
        return Promise.resolve()
      })
  }


  /* ── 背景音乐 ────────────────────────────────────────────────────────────
     用 <audio> 而不是 WebAudio：不用把整个文件解码进内存，浏览器自己流式播。
     动画期间 loop 循环；动画结束时由 handoffBgm() 摘掉 loop、放完当前这一遍。
     音量跟着设置页的 soundVolume 走。
     开始播放必须等一次用户操作（浏览器自动播放策略），所以挂在 wireUnlock 上。 */
  var bgmGuard = null
  var BGM_VOL = 0.36        // BGM 基准音量（再乘 soundVolume）

  function startBgm() {
    if (!C.sound || !ui.bgm) return
    try {
      if (!ui.bgm.dataset.wired) {
        ui.bgm.dataset.wired = '1'
        /* 仓库不随包提供 BGM（第三方素材，无再分发授权）。
           用户没自备的话这里会 404 —— 给一句人话，别让日志里只留一个裸错误。 */
        ui.bgm.addEventListener('error', function () {
          warn('没有背景音乐素材（lib/assets/bgm.m4a 未提供），已跳过 —— 这是正常的')
        })
      }
      if (!ui.bgm.getAttribute('src')) ui.bgm.src = asset('bgm.m4a')
      ui.bgm.volume = Math.max(0, Math.min(1, C.soundVolume == null ? 0.5 : C.soundVolume)) * BGM_VOL
      /* 已经在放就什么都不做（play() 本身幂等，重复调不会叠加） */
      if (!ui.bgm.paused) return
      var p = ui.bgm.play()
      if (p && p.catch) p.catch(function () { /* 还没拿到手势，等下一次 unlock */ })
    } catch (e) { warn('BGM 起播失败：' + e.message) }
  }

  function stopBgm() {
    if (!ui.bgm) return
    try { ui.bgm.pause() } catch (e) {}
  }

  /** 交接：动画结束时**不掐** BGM，让当前这一遍放完再收。
      两个关键动作：
       ① 摘掉 loop —— 否则放完会自动从头再来，一直响下去
       ② 把它从覆盖层里搬到 <body> 下 —— finish() 会在 820ms 后删掉整个 root，
          留在里面的话声音会跟着一起消失（这是最容易踩的一个坑）
      放完（ended）就自己清理掉，不留残余元素。 */
  function handoffBgm() {
    var a = ui.bgm
    if (!a) return
    try {
      a.loop = false
      if (a.parentNode !== document.body) document.body.appendChild(a)
      /* ⚠️ 必须是严格的 `paused === false`。
         写成 `if (a.paused)` 的话，在没有真正 <audio> 的环境里（paused 是 undefined）
         会被判成"正在播放"，于是装上一根 8 分钟的保险丝 ——
         而 Node 会为未完成的定时器一直挂着进程，测试直接卡死。（踩过） */
      if (a.paused !== false || a.ended) { cleanupBgm(); return }
      a.addEventListener('ended', cleanupBgm, { once: true })
      /* 保险丝：万一 ended 因为解码错误之类没触发，最多再给它 8 分钟 */
      bgmGuard = setTimeout(cleanupBgm, 8 * 60 * 1000)
    } catch (e) { cleanupBgm() }
  }

  /** 真正收尾：停掉、摘掉监听、把元素从 DOM 里删掉。 */
  function cleanupBgm() {
    var a = ui.bgm
    if (bgmGuard) { clearTimeout(bgmGuard); bgmGuard = null }
    if (!a) return
    ui.bgm = null                     // 先置空，避免重入
    try { a.removeEventListener('ended', cleanupBgm) } catch (e) {}
    try { a.pause() } catch (e) {}
    try { if (a.parentNode) a.parentNode.removeChild(a) } catch (e) {}
  }

  /* ── 退出：唯一出口。任何路径都要走到这里 ─────────────────────────────── */
  function finish() {
    if (finished) return
    finished = true
    abort()
    stopFailsafe()
    /* 必须摘掉滚动锁，否则揭幕后主界面永远滚不动 */
    document.documentElement.classList.remove('dc-lock', 'dc-force-motion')
    if (root) root.classList.remove('dc-hero-on')
    /* 不掐 BGM —— 让它把当前这一遍放完 */
    handoffBgm()
    document.documentElement.style.overflow = ''
    if (document.body) document.body.style.overflow = ''
    root.classList.add('dc-handoff')
    setTimeout(function () {
      try { if (root.parentNode) root.parentNode.removeChild(root) } catch (e) {}
    }, ms(820))
  }

  function requestSkip() {
    if (skipped || finished) return
    skipped = true
    abort()
    finish()
  }

  /* ── 彻底拆除本实例 ──────────────────────────────────────────────────────
     和 finish() 的区别：finish() 是「正常揭幕」（带 820ms 淡出，留给用户看），
     destroy() 是「立刻消失」（重播 / 接管时用），并且会把本实例的时间线、
     定时器、监听全部干掉，同时把接管权交出去。
     ------------------------------------------------------------------------ */
  function destroy() {
    finished = true
    skipped = true
    abort()
    stopFailsafe()
    try { if (root && root.parentNode) root.parentNode.removeChild(root) } catch (e) {}
    document.documentElement.classList.remove('dc-lock', 'dc-force-motion')
    document.documentElement.style.overflow = ''
    if (document.body) document.body.style.overflow = ''
    window.__DSH_CURTAIN_LOADED__ = false
    window.__DSH_CURTAIN_TEARDOWN__ = null
    /* 重播 / 被接管时要硬停 —— 交接那套「放完这一遍」只属于正常揭幕 */
    cleanupBgm()
    narrator.cancel()
  }

  /* ── 演出 ──────────────────────────────────────────────────────────────── */
  function run() {
    return Promise.resolve()
      /* 幕一：底图浮现 → 框架层 HUD 亮起 → 加载文字与圆钮 */
      .then(function () {
        ui.photo.classList.add('dc-in')
        return wait(560)
      })
      .then(function () {
        ui.hud.classList.add('dc-in')
        return wait(420)
      })
      .then(function () {
        setIn(ui.load, true)
        setIn(ui.meta, true)
        tickLoad()
        tickLog()
        tickClock()
        return wait(520)
      })
      .then(function () {
        setIn(ui.dialWrap, true)
        setIn(ui.dialCaption, true)
        /* SKIP 从第一幕就给出来 —— 用户在等圆钮/等协议时，随时有一条明路 */
        if (C.allowSkip) setIn(ui.skip, true)
        audio.play('rise')
        narrator.say('standby')
        return wait(700)
      })
      /* 等用户按下 —— 这是这一幕唯一的交互 */
      .then(function () { return waitDial() })
      /* 一笔画完成后收住：加载跑满、圆钮退场 */
      .then(function () {
        return wait(520)
      })
      .then(function () {
        ui.loadPct.textContent = '100%'
        ui.loadBarFill.style.width = '100%'
        return wait(380)
      })
      .then(function () {
        ui.dialWrap.classList.add('dc-gone')
        ui.dialCaption.classList.add('dc-gone')
        return wait(560)
      })
      /* 圆钮退场后必须真正让出布局位置，否则后面的标题会被它顶偏 */
      .then(function () {
        ui.dialWrap.hidden = true
        ui.dialCaption.hidden = true
        return Promise.resolve()
      })
      /* 幕二：协议场景（左协议框 / 右机械百叶展开 / 背景终端日志） */
      .then(function () {
        ui.load.classList.add('dc-gone')
        return sceneAgreement()
      })
      .then(function () {
        ui.load.hidden = true
        return Promise.resolve()
      })
      /* 幕三：HUD 骨架 */
      .then(function () {
        setIn(ui.frame, true)
        setIn(ui.foot, true)
        if (C.allowSkip) setIn(ui.skip, true)
        sweep()
        return wait(620)
      })
      /* 幕四：英雄屏（中央大圆 + 字标 dsh + START） */
      .then(function () { return sceneHero() })
      /* 英雄屏之后没有别的场景了 —— 直接揭幕 */
      .then(function () { return finish() })
      .catch(function (err) {
        warn('动画异常，直接揭幕：' + (err && err.message ? err.message : err))
        return finish()
      })
  }

  /* ── 跳过接线 ──────────────────────────────────────────────────────────── */
  if (C.allowSkip) {
    ui.skip.addEventListener('click', function (e) { e.stopPropagation(); requestSkip() })
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') requestSkip()
    })
  } else {
    ui.skip.hidden = true
  }

  /* ── 重新播放（预览页 / 设置页「立即预览」用）──────────────────────────
     先把自己彻底拆掉，再重新加载一份脚本 —— 加时间戳绕开缓存。 */
  function replay() {
    try { destroy() } catch (e) { /* 拆不掉也要继续重播 */ }
    var base = window.__DSH_CURTAIN_SCRIPT_URL__ || (BASE + '/boot.js')
    var s = document.createElement('script')
    s.src = base + (base.indexOf('?') === -1 ? '?t=' : '&t=') + Date.now()
    document.head.appendChild(s)
  }

  /* ── 对外 API ──────────────────────────────────────────────────────────── */
  window.__DSH_CURTAIN_API__ = {
    replay: replay,
    skip: requestSkip,
    /** 报幕自检：控制台里 __DSH_CURTAIN_API__.speechReport() 看原因，
        或用 __DSH_CURTAIN_API__.speak('test') 手动念一句。 */
    speechReport: function () { return narrator.report() },
    speak: function (txt) { return narrator.say(txt || 'DSH system check.') },
    finish: finish,
    destroy: destroy,
    arm: function () { armDial() },
    config: C
  }

  /* 登记拆除入口，供下一个实例接管时调用（必须早于 run()，否则中途重播会漏） */
  window.__DSH_CURTAIN_TEARDOWN__ = destroy

  /* ── 最后一道保险：只在「长时间没有进展」时才放行 ────────────────────────
     绝不允许把正在等用户操作的动画拆掉。 */
  armFailsafe(9000)

  /* ── 起跑 ──────────────────────────────────────────────────────────────── */
  document.documentElement.classList.add('dc-lock')
  document.documentElement.style.overflow = 'hidden'
  if (document.body) document.body.style.overflow = 'hidden'

  /* 第一次用户操作解锁声卡（浏览器硬规则） */
  ;(function wireUnlock() {
    var unlocked = false
    function unlock() {
      if (unlocked) return
      unlocked = true
      audio.resume()
      startBgm()
      narrator.unlock()
      document.removeEventListener('pointerdown', unlock, true)
      document.removeEventListener('keydown', unlock, true)
      document.removeEventListener('touchstart', unlock, true)
    }
    document.addEventListener('pointerdown', unlock, true)
    document.addEventListener('keydown', unlock, true)
    document.addEventListener('touchstart', unlock, true)
  })()

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run)
  } else {
    run()
  }
})()
