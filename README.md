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

装好之后在 DSH 的**设置页**里会多出一块 **「背景音乐」**：

```
背景音乐
┌─────────────────────────────────────────────────┐
│  bgm.mp3                                   3.2 MB│
│  [ 替换… ]  [ 试听 ]  [ 删除 ]                    │
│                                                  │
│  音量  ━━━━━━━━●━━━━  50%                        │
└─────────────────────────────────────────────────┘
```

- **选择文件 / 替换** —— 从本机挑一个音频传上去（mp3 / m4a / aac / ogg / wav，单个 ≤ 10 MB）
- **试听** —— 就地循环播放，不用重开 DSH
- **删除** —— 移除背景音乐；没有音乐时开场是静音的，其余一切照常
- **音量** —— 同时作用于背景音乐和报幕语音
- 上传后**刷新页面即生效**，不用重启

音乐文件落在 `lib/assets/bgm.<扩展名>`，同一时刻只保留一个。

### 手动放文件也可以

不想用上传的话，直接把文件丢进 `lib/assets/`，命名成 `bgm.mp3` / `bgm.m4a` / … 就行，
插件会自动识别（配置里没写也会去找）。

### 其余的配置项

`~/.dsh/dsh-curtain.json` 里还有一批键（`enabled` / `mode` / `speed` / `allowSkip` /
`accent` / `brand` 等），**但没有对应的界面了** —— 想改就直接编辑那个文件，
或者改 `lib/boot.js` / `lib/boot.css` 里的美术常量（见 `ART.md`）。

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
| `lib/assets/bgm.*` | 背景音乐 | **仓库里没有，需自备**。在设置页上传，或手动放一个 `bgm.<扩展名>` |
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
- **仓库不含背景音乐。** 原曲是第三方网络素材、无可再分发授权，所以移除了。
  在设置页上传一个，或者手动放进 `lib/assets/bgm.<扩展名>`；没有也能正常运行。
- **BGM 在动画结束后不会立刻停**，会把当前这一遍放完再收（有意为之）。

---

## 许可

MIT，见 `LICENSE`。

第三方素材的授权情况见 `lib/assets/README.md`。
