# dsh-curtain

给 **DeepSeek Harness (DSH)** 做的开机动画。

暗色重工业 HUD 风格：近黑冷调底 + 单一琥珀黄 + 满屏精密细线。
全程可交互 —— 点圆钮、读协议、按 START，一路都有英文报幕和字幕。

```
幕一  圆钮待机  →  点击  →  一笔画变琥珀
幕二  用户协议  →  像素级出现  →  点「同意」
幕三  英雄屏    →  大圆 / dsh 字标 / START
揭幕  淡出，进入 DSH
```

---

## 安装

需要 DSH 0.1.1-rc.2 或更新（桌面版）。

```bash
dsh plugin --profile desktop add -w github:seatiger123/dsh-curtain
```

装完**完全退出 DSH 再打开**。

> 第一次装会顺便装依赖，慢一点是正常的。

### 卸载

```bash
dsh plugin --profile desktop remove dsh-curtain
```

或者直接编辑 `~/.dsh/profiles/desktop/package.json`，把 `dsh-curtain` 从
`dsh.profile.bundles` 里删掉，再删 `node_modules/dsh-curtain`。

---

## 配置

装好之后在 DSH 的**设置页**里会多出一块 **「开机动画」**：

| 项 | 说明 |
|---|---|
| 启用 | 总开关 |
| 播放时机 | 每次 / 每次会话 / 只在版本变化时 |
| 速度 | 整体快慢倍率 |
| 需要人工确认 | 关掉的话，圆钮和「同意」会自动按下 |
| 允许跳过 | 是否显示 SKIP（Esc 始终可用） |
| 音效 / 音量 | 报幕、BGM、界面音效 |
| 强制播放动效 | 无视系统的「减少动态效果」 |
| 品牌 / 主标题 / 副标题 / 页脚 | 文案 |
| 强调色 / 背景 / 前景 | 配色 |

配置存在 `~/.dsh/dsh-curtain.json`。

---

## 想改成自己的

**`ART.md` 是完整的美术手册** —— 改哪里、怎么改、每块动画多少毫秒，都写了。
技术部分不用碰。

改完刷新页面即可生效（`lib/boot.css` / `lib/boot.js` 每次重新读）；
只有 `lib/index.js` / `lib/client.js` 的改动需要重启 DSH。

### 换素材

| 文件 | 是什么 | 怎么换 |
|---|---|---|
| `lib/assets/industry.jpg` | 背景工业剪影 | 直接替换同名文件。选图要求见 `ART.md` |
| `lib/assets/bgm.m4a` | 背景音乐 | **仓库里没有，需自备**。放一个同名文件即可。动画期间循环，揭幕时放完当前这一遍 |
| `lib/assets/voice-*.aac` | 四句报幕 | 替换同名文件。文件名决定它挂在哪一幕 |
| `lib/boot.js` 的 `HERO_MARK` | 中央「dsh」字标 | 手画的 SVG 路径，viewBox `0 0 290 100` |
| `lib/boot.js` 的 `EMBLEM_PATH` | 协议卡左侧徽记 | 同上，viewBox `0 0 100 126` |

报幕文件是**裸 ADTS AAC**。Chromium 能直接解码，不用转格式。
如果你的是 mp3，改个名也行 —— 记得同时改 `boot.js` 里 `build()` 的扩展名，
以及 `lib/index.js` 里的扩展名白名单。

---

## 开发

仓库里带了一个**离线预览页**，改样式不用反复重启 DSH：

```
双击 打开预览.cmd
```

它加载的是**和 DSH 里完全同一份** `lib/boot.css` 和 `lib/boot.js`，
所以这里看到什么，装进 DSH 就是什么。右上角有控制面板，`R` 重播、`S` 跳过。

跑回归测试：

```bash
node test/smoke-boot.mjs
```

---

## 已知限制

- **首帧可能闪一下白屏。** 这是 DSH 自己的页面在样式应用前的默认底色，
  插件层够不着（插件最早已只能在客户端包求值时插手）。
- **报幕依赖系统嗓音之外的东西** —— 用的是随包的音频文件，所以不挑系统语音包。
- **仓库不含背景音乐**（`lib/assets/bgm.m4a`）。原曲是第三方网络素材、无可再分发授权，
  所以从仓库移除了。自己放一个同名文件即可，没有也能正常运行。
- **BGM 在动画结束后不会立刻停**，会把当前这一遍放完再收（有意为之）。

---

## 许可

MIT，见 `LICENSE`。

第三方素材的授权情况见 `lib/assets/README.md`。
