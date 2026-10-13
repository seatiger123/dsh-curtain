/* ============================================================================
 * dsh-curtain · client.js —— 浏览器半边
 * ----------------------------------------------------------------------------
 * 两件事：
 *   1) selfBoot()：宿主半边不做 index 注入，所以覆盖层由这里自举
 *      （判定 + 建根节点 + 拉 boot.css / boot.js）
 *   2) 在「设置」侧栏注册一页，通过自建 HTTP 路由读写配置
 *
 * 手写 ModuleLoader bundle —— 不需要任何构建步骤。
 * 注册 id 必须等于 loader entry 名（dsh-curtain），否则 ModuleLoader 会报
 * "loaded without registering dsh-curtain"。
 * ========================================================================== */
window.__ModuleLoader__.load({
  id: 'dsh-curtain',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })

    var react = require('react')
    var h = react.createElement
    var reactDom = require('react-dom/client')

    var ROUTE = (typeof window !== 'undefined' && typeof window.__DSH_CURTAIN_API_BASE__ === 'string')
      ? window.__DSH_CURTAIN_API_BASE__
      : '/dsh-curtain'
    var API = ROUTE + '/config'
    var ROOT_ID = 'dsh-curtain-root'

    /* ═════════════════════════════════════════════════════════════════════
       设置面板样式（改外观不影响动画画面，可以随便调）
       ═════════════════════════════════════════════════════════════════════ */
    var CSS = [
      '.dcp{max-width:620px;display:flex;flex-direction:column;gap:14px;font-size:13px;color:var(--dsw-alias-label-primary)}',
      '.dcp-ver{font-family:ui-monospace,Consolas,monospace;font-size:12px;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary)}',
      '.dcp-group{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:11px}',
      '.dcp-gt{font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}',
      '.dcp-field{display:flex;flex-direction:column;gap:5px}',
      '.dcp-label{font-size:12px;font-weight:600}',
      '.dcp-hint{font-size:11px;line-height:1.55;color:var(--dsw-alias-label-tertiary)}',
      '.dcp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
      '.dcp-input{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);font:inherit;color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 10px;font-size:13px;box-sizing:border-box;width:100%;outline:none}',
      '.dcp-input:focus{border-color:var(--dsw-alias-state-business-primary)}',
      '.dcp-select{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 8px;font:inherit;font-size:13px;min-width:200px}',
      '.dcp-check{display:flex;align-items:flex-start;gap:8px;cursor:pointer}',
      '.dcp-check input{margin-top:2px}',
      '.dcp-checkText{display:flex;flex-direction:column;gap:2px}',
      '.dcp-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.dcp-swatch{width:38px;height:26px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:transparent;cursor:pointer}',
      '.dcp-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}',
      '.dcp-btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);border-radius:8px;padding:6px 14px;font:inherit;font-size:13px;cursor:pointer}',
      '.dcp-btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}',
      '.dcp-btn:disabled{opacity:.5;cursor:default}',
      '.dcp-btnP{border-color:var(--dsw-alias-state-business-primary,#3964fe);background:var(--dsw-alias-state-business-primary,#3964fe);color:#fff}',
      '.dcp-btn:disabled{opacity:.45;cursor:not-allowed}',
      '.dcp-bgm{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding:9px 12px;border:1px solid var(--dsw-alias-border-l2);border-radius:8px;background:var(--dsw-alias-bg-layer-3);font-size:13px}',
      '.dcp-bgm-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.dcp-bgm-size{flex:none;opacity:.55;font-size:12px}',
      '.dcp-ok{font-size:12px;color:var(--dsw-alias-state-business-primary)}',
      '.dcp-err{font-size:12px;color:var(--dsw-alias-state-error-primary,#f85149)}',
      '.dcp-status{font-size:12px;color:var(--dsw-alias-label-tertiary)}'
    ].join('')
    ;(function injectCss() {
      if (typeof document === 'undefined') return
      if (document.querySelector('style[data-plugin-css="dsh-curtain/panel"]') !== null) return
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-curtain'
      tag.dataset.pluginCss = 'dsh-curtain/panel'
      tag.textContent = CSS
      document.head.appendChild(tag)
    })()

    /* ═════════════════════════════════════════════════════════════════════
       自举：宿主没有注入时，由这里把覆盖层拉起来
       ═════════════════════════════════════════════════════════════════════ */
    function readFlag(store, key) {
      try { var s = window[store]; return s ? s.getItem(key) : null } catch (e) { return null }
    }
    function writeFlag(store, key, value) {
      try { var s = window[store]; if (s) s.setItem(key, value) } catch (e) { /* 隐私模式可能抛 */ }
    }

    /** 自举任何一步失败，都要把页面还回去 —— 绝不留黑屏。 */
    function release() {
      try {
        var r = document.getElementById(ROOT_ID)
        if (r && r.parentNode) r.parentNode.removeChild(r)
        var crit = document.getElementById('dsh-curtain-critical')
        if (crit && crit.parentNode) crit.parentNode.removeChild(crit)
        document.documentElement.classList.remove('dc-lock')
        if (document.body && document.body.style) document.body.style.overflow = ''
        window.__DSH_CURTAIN_FAILED__ = true
      } catch (e) { /* 兜底不再抛 */ }
    }

    /* ── 样式：用 fetch 取文本，再注入 <style> ──────────────────────────────
       刻意「不用」<link rel=stylesheet>。
       桌面端外壳对文档资源有自己的处理（页面里的 .css 请求可能被它当成
       打包 dist 里的文件去找，结果 404 或返回空 —— 而 <link> 拿到空样式表
       是不会报错的，于是"样式全丢"却毫无提示，只能靠肉眼猜）。
       fetch 走的是和 /dsh-curtain/config 完全相同的通路，那条已经验证是通的。 */
    function injectCssText(text) {
      if (!text || text.length < 200) {
        throw new Error('返回内容过短（' + (text ? text.length : 0) + ' 字节），像是空样式表')
      }
      var tag = document.getElementById('dsh-curtain-css')
      if (!tag) {
        tag = document.createElement('style')
        tag.id = 'dsh-curtain-css'
        ;(document.head || document.documentElement).appendChild(tag)
      }
      tag.textContent = text
    }

    /** 退路：老老实实用 <link> 再试一次 */
    function linkCss(done) {
      var link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = ROUTE + '/boot.css?t=' + Date.now()
      link.addEventListener('load', function () { done(null) })
      link.addEventListener('error', function () { done(new Error('<link> 也拿不到样式')) })
      ;(document.head || document.documentElement).appendChild(link)
    }

    function loadCss(done) {
      var url = ROUTE + '/boot.css?t=' + Date.now()
      fetch(url, { headers: { Accept: 'text/css' } })
        .then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status)
          return r.text()
        })
        .then(function (text) {
          injectCssText(text)
          done(null)
        })
        .catch(function (e1) {
          linkCss(function (e2) {
            if (!e2) { done(null); return }
            done(new Error('fetch 失败（' + (e1 && e1.message ? e1.message : e1) +
              '），换 <link> 也失败（' + e2.message + '）'))
          })
        })
    }

    function loadScript(src, done) {
      var s = document.createElement('script')
      s.src = src
      s.async = false             // 保住执行顺序
      s.addEventListener('load', function () { done(null) })
      s.addEventListener('error', function () { done(new Error('script load failed: ' + src)) })
      ;(document.head || document.documentElement).appendChild(s)
    }

    function startOverlay(cfg) {
      var root = document.getElementById(ROOT_ID)
      if (!root) {
        root = document.createElement('div')
        root.id = ROOT_ID
        root.className = 'dc-root'
        document.body.appendChild(root)
      }
      root.className = 'dc-root'

      /* 关键内联样式：在 boot.css 到位之前先把屏幕盖住，避免闪出主界面。
         只有两条规则，和 boot.css 里的地基保持一致。 */
      if (document.getElementById('dsh-curtain-critical') === null) {
        var crit = document.createElement('style')
        crit.id = 'dsh-curtain-critical'
        crit.textContent =
          '#' + ROOT_ID + '{position:fixed;inset:0;z-index:2147483000;background:' + (cfg.bg || '#07080a') + '}' +
          'html.dc-lock,html.dc-lock body{overflow:hidden!important}'
        document.head.appendChild(crit)
      }
      document.documentElement.classList.add('dc-lock')
      if (document.body && document.body.style) document.body.style.overflow = 'hidden'

      var failed = false
      var cssReady = false
      var jsReady = false
      function guard(err) {
        if (err) {
          if (!failed) {
            failed = true
            try { console.warn('[dsh-curtain] 覆盖层自举失败，已放开页面：' + err.message) } catch (e) {}
            release()
          }
          return
        }
        if (cssReady && jsReady) {
          /* 两个资源都到位，动画自己会接管；这里只等它的标记 */
        }
      }

      window.__DSH_CURTAIN__ = cfg || {}
      try { delete window.__DSH_CURTAIN_LOADED__ } catch (e) { window.__DSH_CURTAIN_LOADED__ = undefined }

      /* ⚠️ 顺序不能颠倒，也**不能同时发**。
         同时发的话 boot.js 常常先跑完：它在一点样式都没有的状态下把 DOM 建出来，
         浏览器只好用**默认外观**渲染那个 <button class="dc-dial">——
         于是开机第一帧会闪一下灰色的原生按钮，样式到了它才消失、再重新淡入。
         这就是"第一帧闪一下按钮"的根因。串起来之后，脚本运行时样式一定已经就位。 */
      loadCss(function (err) {
        if (err) return guard(err)
        cssReady = true
        guard(null)
        loadScript(ROUTE + '/boot.js?t=' + Date.now(), function (e2) {
          if (e2) return guard(e2)
          jsReady = true
          guard(null)
        })
      })

      /* 自检：样式和形状到底对不对？
         这一条很重要 —— 样式丢了以后页面**不会报任何错**，只会"看起来有点朴素"，
         很容易被当成设计问题而不是故障。所以主动探一次，把可查的事实打出来。 */
      setTimeout(function () {
        try {
          var dial = document.querySelector('.dc-dial')
          if (!dial) return
          var cs = getComputedStyle(dial)
          var r = dial.getBoundingClientRect()
          var w = Math.round(r.width)
          var h = Math.round(r.height)
          var bad = []
          if (!cssReady) bad.push('boot.css 没能就位')
          if (String(cs.borderRadius).indexOf('50%') === -1) bad.push('border-radius=' + cs.borderRadius)
          if (Math.abs(w - h) > 1) bad.push('圆钮不是正方 ' + w + '×' + h)
          if (bad.length) {
            console.warn('[dsh-curtain] 圆钮形状自检未通过：' + bad.join('；') +
              '（视口 ' + window.innerWidth + '×' + window.innerHeight + '）')
          }
        } catch (e) { /* 自检失败不影响运行 */ }
      }, 1200)

      /* 自愈：资源和脚本都拿到了，但覆盖层还挂在启动态，说明动画没接管 */
      setTimeout(function () {
        try {
          var r = document.getElementById(ROOT_ID)
          if (r && !window.__DSH_CURTAIN_API__) release()
        } catch (e) { /* 兜底不再抛 */ }
      }, 9000)
    }

    function selfBoot() {
      try {
        if (typeof window === 'undefined' || typeof document === 'undefined') return
        if (!document.body) return
        if (window.__DSH_CURTAIN_BOOT__) return            // 已被接管
        if (window.__DSH_CURTAIN__) return                 // 配置已在页面上
        if (document.getElementById(ROOT_ID)) return
        if (window.__DSH_CURTAIN_FAILED__ === true) return // 出过错的地方不要再扑一次

        window.__DSH_CURTAIN_BOOT__ = 'client'

        fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) { return j && j.ok === true ? j.config : null })
          .catch(function () { return null })
          .then(function (cfg) {
            cfg = cfg || { enabled: true, mode: 'session', speed: 1 }
            if (cfg.enabled === false) return

            var today = new Date().toISOString().slice(0, 10)
            if (cfg.mode === 'session' && readFlag('sessionStorage', 'dsh-curtain:shown') === '1') return
            if (cfg.mode === 'daily' && readFlag('localStorage', 'dsh-curtain:day') === today) return

            /* 回填标记，语义与将来可能加的宿主侧判定保持一致 */
            if (cfg.mode === 'session') writeFlag('sessionStorage', 'dsh-curtain:shown', '1')
            if (cfg.mode === 'daily') writeFlag('localStorage', 'dsh-curtain:day', today)

            startOverlay(cfg)
          })
          .catch(function () { /* 自举失败就算了，页面本来就是好的 */ })
      } catch (e) { /* 自举是兜底，绝不许把宿主带崩 */ }
    }

    /* ═════════════════════════════════════════════════════════════════════
       设置面板
       ═════════════════════════════════════════════════════════════════════ */
    function Field(props) {
      return h('div', { className: 'dcp-field' },
        h('label', { className: 'dcp-label' }, props.label),
        props.children,
        props.hint ? h('div', { className: 'dcp-hint' }, props.hint) : null
      )
    }

    function Text(props) {
      return h('input', {
        className: 'dcp-input',
        type: 'text',
        value: props.value == null ? '' : String(props.value),
        maxLength: props.maxLength || 64,
        spellCheck: false,
        onChange: function (e) { props.onChange(e.target.value) }
      })
    }

    function Select(props) {
      return h('select', {
        className: 'dcp-select',
        value: props.value,
        onChange: function (e) { props.onChange(e.target.value) }
      }, props.options.map(function (o) { return h('option', { key: o[0], value: o[0] }, o[1]) }))
    }

    function Check(props) {
      return h('label', { className: 'dcp-check' },
        h('input', {
          type: 'checkbox',
          checked: !!props.checked,
          onChange: function (e) { props.onChange(e.target.checked) }
        }),
        h('span', { className: 'dcp-checkText' },
          h('span', null, props.label),
          props.hint ? h('span', { className: 'dcp-hint' }, props.hint) : null
        )
      )
    }

    function Color(props) {
      return h('div', { className: 'dcp-row' },
        h('input', {
          className: 'dcp-swatch',
          type: 'color',
          value: props.value,
          onChange: function (e) { props.onChange(e.target.value) }
        }),
        h('span', { className: 'dcp-status' }, String(props.value))
      )
    }

    function Slider(props) {
      return h('div', { className: 'dcp-row' },
        h('input', {
          type: 'range',
          min: props.min, max: props.max, step: props.step || 0.05,
          value: props.value,
          style: { flex: '1 1 220px' },
          onChange: function (e) { props.onChange(Number(e.target.value)) }
        }),
        h('span', { className: 'dcp-status' }, props.display)
      )
    }

    var FALLBACK = {
      enabled: true, mode: 'session', speed: 1,
      requireInteraction: true, allowSkip: true,
      sound: true, soundVolume: 0.5, forceMotion: false,
      brand: 'DEEPSEEK', title: 'HARNESS',
      subtitle: 'SYNTHESIZE INTELLIGENCE', footer: 'POWERED BY DEEPSEEK',
      bgm: '',
      accent: '#f2c21c', bg: '#0b0e11', fg: '#e6ecf2'
    }

    var BGM_API = ROUTE + '/bgm'
    var BGM_MAX_MB = 10
    var listenEl = null

    function fmtSize(n) {
      if (!n) return ''
      if (n < 1024) return n + ' B'
      if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'
      return (n / 1024 / 1024).toFixed(1) + ' MB'
    }

    function Panel() {
      var [draft, setDraft] = react.useState(null)
      var [file, setFile] = react.useState('')
      var [error, setError] = react.useState(null)
      var [notice, setNotice] = react.useState(null)
      var [busy, setBusy] = react.useState(false)
      var [bgmSize, setBgmSize] = react.useState(0)
      var [listening, setListening] = react.useState(false)

      function load() {
        setError(null)
        return fetch(API, { headers: { Accept: 'application/json' } })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'load failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setFile(j.file || '')
            setBgmSize((j.bgm && j.bgm.size) || 0)
          })
          .catch(function (e) { setError('读取配置失败：' + String(e && e.message ? e.message : e)) })
      }
      react.useEffect(function () { load() }, [])

      function set(key, value) {
        setNotice(null)
        setDraft(function (d) { return Object.assign({}, d, { [key]: value }) })
      }

      function save() {
        if (!draft) return
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patch: draft })
        })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'save failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setNotice('已保存。下次打开 DSH 生效；点「立即预览」可以先看。')
          })
          .catch(function (e) { setError('保存失败：' + String(e && e.message ? e.message : e)) })
          .then(function () { setBusy(false) })
      }

      function reset() {
        setBusy(true); setNotice(null); setError(null)
        fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' })
        })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'reset failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setNotice('已恢复默认。')
          })
          .catch(function (e) { setError('恢复默认失败：' + String(e && e.message ? e.message : e)) })
          .then(function () { setBusy(false) })
      }

      if (!draft) {
        return h('div', { className: 'dcp' },
          h('div', { className: 'dcp-status' }, error || '读取配置中…'),
          error ? h('div', { className: 'dcp-actions' },
            h('button', { className: 'dcp-btn', onClick: load }, '重试')
          ) : null
        )
      }

      /* ---- BGM 三个动作 ---- */

      function stopListen() {
        if (listenEl) { try { listenEl.pause() } catch (e) {} }
        setListening(false)
      }

      function listenBgm() {
        if (listening) { stopListen(); return }
        if (!draft.bgm) return
        if (!listenEl) { listenEl = new Audio(); listenEl.loop = true }
        listenEl.src = ROUTE + '/asset/' + draft.bgm + '?t=' + Date.now()
        listenEl.volume = Number(draft.soundVolume)
        var p = listenEl.play()
        if (p && p.then) {
          p.then(function () { setListening(true) })
            .catch(function (e) { setError('试听失败：' + String((e && e.message) || e)) })
        } else { setListening(true) }
      }

      function pickBgm() {
        var inp = document.createElement('input')
        inp.type = 'file'
        inp.accept = '.mp3,.m4a,.aac,.ogg,.wav,audio/*'
        inp.onchange = function () {
          var f = inp.files && inp.files[0]
          if (!f) return
          if (f.size > BGM_MAX_MB * 1024 * 1024) {
            setError('文件太大（' + fmtSize(f.size) + '），上限 ' + BGM_MAX_MB + ' MB')
            return
          }
          stopListen()
          setBusy(true); setError(null); setNotice(null)
          fetch(BGM_API + '?name=' + encodeURIComponent(f.name), {
            method: 'POST',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: f
          })
            .then(function (r) { return r.json() })
            .then(function (j) {
              if (!j || j.ok !== true) throw new Error((j && j.error) || 'upload failed')
              setDraft(Object.assign({}, FALLBACK, j.config))
              setBgmSize((j.bgm && j.bgm.size) || 0)
              setNotice('已设为「' + j.config.bgm + '」，刷新页面即生效。')
            })
            .catch(function (e) { setError('上传失败：' + String((e && e.message) || e)) })
            .then(function () { setBusy(false) })
        }
        inp.click()
      }

      function dropBgm() {
        stopListen()
        setBusy(true); setError(null); setNotice(null)
        fetch(BGM_API, { method: 'DELETE' })
          .then(function (r) { return r.json() })
          .then(function (j) {
            if (!j || j.ok !== true) throw new Error((j && j.error) || 'delete failed')
            setDraft(Object.assign({}, FALLBACK, j.config))
            setBgmSize(0)
            setNotice('已删除背景音乐。')
          })
          .catch(function (e) { setError('删除失败：' + String((e && e.message) || e)) })
          .then(function () { setBusy(false) })
      }

      return h('div', { className: 'dcp' },
        h('div', { className: 'dcp-ver' }, 'dsh-curtain v0.1.0'),

        h('div', { className: 'dcp-group' },
          h('div', { className: 'dcp-gt' }, '背景音乐'),

          h('div', { className: 'dcp-bgm' },
            h('span', { className: 'dcp-bgm-name' }, draft.bgm || '（未设置 —— 开场将静音）'),
            h('span', { className: 'dcp-bgm-size' }, draft.bgm ? fmtSize(bgmSize) : '')
          ),

          h('div', { className: 'dcp-actions' },
            h('button', {
              className: 'dcp-btn dcp-btnP',
              disabled: busy,
              onClick: pickBgm
            }, busy ? '处理中…' : (draft.bgm ? '替换…' : '选择文件…')),
            h('button', {
              className: 'dcp-btn',
              disabled: !draft.bgm,
              onClick: listenBgm
            }, listening ? '停止' : '试听'),
            h('button', {
              className: 'dcp-btn',
              disabled: !draft.bgm || busy,
              onClick: dropBgm
            }, '删除')
          ),

          h(Field, { label: '音量', hint: '同时作用于报幕语音。' },
            h(Slider, {
              value: Number(draft.soundVolume), min: 0, max: 1, step: 0.05,
              display: Math.round(Number(draft.soundVolume) * 100) + '%',
              onChange: function (v) { set('soundVolume', v) }
            })
          ),

          h('div', { className: 'dcp-hint' },
            '支持 mp3 / m4a / aac / ogg / wav，单个不超过 ' + BGM_MAX_MB + ' MB。上传后刷新页面生效。')
        ),

        h('div', { className: 'dcp-actions' },
          h('button', { className: 'dcp-btn dcp-btnP', disabled: busy, onClick: save },
            busy ? '处理中…' : '保存音量'),
          h('button', { className: 'dcp-btn', disabled: busy, onClick: load }, '放弃修改'),
          notice ? h('span', { className: 'dcp-ok' }, notice) : null,
          error ? h('span', { className: 'dcp-err' }, error) : null
        ),

        file ? h('div', { className: 'dcp-hint' }, '配置文件：' + file) : null
      )
    }

    /* ═════════════════════════════════════════════════════════════════════
       插件
       ═════════════════════════════════════════════════════════════════════ */
    var inject = ['slots']

    function apply(ctx) {
      /* 覆盖层自举。宿主没有注入（桌面端就是这种情况），所以这一步是主路径。 */
      selfBoot()

      ctx.slots.inject('settings.section', function () {
        return ctx.slots.register(
          { name: 'settings.section', id: 'curtain', order: 26, label: '背景音乐' },
          function () { return h(Panel, {}) }
        )
      })
    }

    exports.apply = apply
    exports.inject = inject
    void reactDom
    return module.exports
  }
})
