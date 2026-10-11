<div align="center">

<img src="src-tauri/icons/128x128@2x.png" alt="Sesame" width="112" />

# Sesame

**轻量、快速的桌面文本编辑器与文件查看器。**

打开即用，不打扰你，还能处理那些让别的编辑器卡住的文件——
很大的日志、GBK 编码的配置文件、你只是想瞄一眼的图片。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#许可证)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS-lightgrey.svg)](#安装)
[![Built with Tauri](https://img.shields.io/badge/built%20with-Tauri%202-24C8DB.svg)](https://tauri.app)
[![Binary size](https://img.shields.io/badge/installer-2.1%20MB-brightgreen.svg)](#为什么这么小)

[English](README.md) · [简体中文](README.zh-CN.md)

<img src="docs/assets/screenshot.png" alt="Sesame 打开一个 Rust 文件，带语法高亮" width="820" />

</div>

---

## 为什么做 Sesame

现在的文本编辑器基本只有两类：一类是连日志都打不开的小玩具，
另一类是启动要等四秒的重型 IDE。Sesame 面向的是第三种情况——
**你只是想看一眼某个文件，或者改它三行**，现在就要。

- **打开得快。** 没有启动画面、不索引项目、不加载工作区。
- **不会弄丢你的东西。** 每次保存都是原子的；未保存的内容持续备份，
  崩溃或强杀进程都不会让你损失什么。
- **不会毁掉你的文件。** 打开时是什么编码、什么换行、有没有 BOM，
  写回去就是什么。二进制文件直接拒绝，而不是乱码写回。
- **装不下的文件也能开。** 超过 5 MB 的文件按 1 MB 分块读取；保存时未加载的尾部
  直接从磁盘流式拼回，不读进内存。单次写入上限为 256 MB。

## 功能

| | |
| --- | --- |
| **语法高亮** | 18 种语言，基于 CodeMirror 6，按需懒加载——没打开就不占体积 |
| **大文件** | 超过 5 MB 按 1 MB 分块加载；保存时把未加载的尾部从磁盘流式拼回，不读进内存（单次写入上限 256 MB） |
| **编码** | 打开时自动探测（BOM → 严格 UTF-8 → GBK，UTF-16 通过 BOM 识别），并按原样写回。探测不可能全对——点状态栏上的编码即可换个编码重新打开 |
| **换行风格** | LF、CRLF、CR 逐个文件保留，不静默转换 |
| **安全网** | 原子写入、外部修改检测、自动保存，以及始终开启的草稿备份（未命名标签也覆盖） |
| **多标签** | 拖拽排序，每个标签独立记录光标与滚动位置，重启后恢复上次会话，`Ctrl+Shift+T` 重开刚关掉的标签 |
| **Markdown 预览** | 用 DOMPurify 净化后渲染；外链交给系统浏览器打开，不会把应用界面顶掉 |
| **图片查看** | Ctrl＋滚轮缩放、空格＋拖动平移、重置、适应窗口、原始尺寸、选择外部程序打开；尺寸、体积与格式显示在状态栏 |
| **查找替换** | 支持正则、区分大小写、整词、跨行，并可在面板内替换 |
| **缩进参考线** | 每一级缩进处画一条淡竖线，默认开启，可在设置里关闭 |
| **括号彩虹** | 按嵌套层级给括号上色，默认开启，可在设置里关闭 |
| **省内存** | 长时间未看的标签会释放编辑器实例，切回来立刻重建 |
| **主题** | 内置 13 套主题（含浅色与深色），每套同时决定界面、编辑器与语法高亮配色；界面字体与编辑器字体可分别设置 |
| **界面语言** | 简体中文与英文，默认跟随系统语言 |
| **自动更新** | 启动时静默检查，在应用内安装带签名的更新包 |

### 为什么这么小

Windows 安装包约 **2.1 MB**（可执行文件本身 4.8 MB，安装包会压缩它）。
Sesame 使用操作系统自带的 WebView
（Windows 上是 WebView2，macOS 上是 WKWebView），不打包浏览器内核——
这也是它启动这么快的原因。

### 支持平台

**只支持 Windows 与 macOS**，两者共用同一份代码，差异集中在
`src/lib/utils/platform.ts`。

Linux 不作为目标平台：无边框窗口的红绿灯、文件关联、打包格式
在每个 Linux 桌面环境上表现都不同，维护成本远超这个体量的项目所能承受。

## 安装

### 下载安装包

到 [Releases 页面](https://github.com/aeroray/Sesame/releases) 下载最新版：

| 平台 | 文件名 |
| --- | --- |
| Windows (x64) | `Sesame_<版本>_x64-setup.exe` |
| macOS（Apple Silicon） | `Sesame_<版本>_aarch64.dmg` |

Windows 安装程序可以把 Sesame 注册为它所支持的文本与图片格式的默认打开方式，
这是安装过程中的一个勾选项，不需要可以取消。

> **macOS 版未做 Apple 签名与公证**，本项目不涉及 Apple 开发者证书。
> 因此首次打开会被系统拦下。请在 Finder 里右键点击应用并选择「打开」，
> 或在终端执行：
>
> ```bash
> xattr -rd com.apple.quarantine /Applications/Sesame.app
> ```
>
> 这只清除你这台机器上的隔离标记，不能替代 Apple 代码签名。Windows 版不受影响。

macOS 只发布 Apple Silicon（`aarch64`）版本，不以 Intel Mac 为目标。

### 从源码构建

**前置条件**

- [Rust](https://rustup.rs) 1.90 或更高
- [Node.js](https://nodejs.org) 20 或更高，以及 [pnpm](https://pnpm.io)
- 对应平台的 Tauri 依赖，见
  [Tauri 前置条件](https://v2.tauri.app/start/prerequisites/)。Windows 上需要
  **C++ 生成工具**与 **WebView2**（Windows 11 已预装）；
  macOS 上需要 Xcode Command Line Tools，WKWebView 由系统提供。

> **实测平台是 Windows。** macOS 版本预期可用——平台相关代码只有标题栏
> 与 Cmd 键处理两处——但尚未在真机上验证过。如果你在 Mac 上构建了，
> 欢迎反馈结果。

**构建**

```sh
git clone https://github.com/aeroray/Sesame.git
cd Sesame
pnpm install
pnpm tauri build
```

安装包生成在 `src-tauri/target/release/bundle/`。

**开发模式运行**

```sh
pnpm tauri dev
```

## 自动更新

Sesame 在**启动时静默检查**更新，发现新版本后会显示在
**设置 → 关于**里，附带更新说明与一键安装按钮。
在你点击那个按钮之前，不会下载也不会安装任何东西。

更新包使用 [minisign](https://jedisct1.github.io/minisign/) 签名。
公钥编译在应用里，签名在 Rust 侧校验通过才会安装，
因此即使更新服务器被劫持也无法推送改过的安装包——只会得到签名校验失败。
注意更新说明**不在签名保护范围内**，所以它只按纯文本渲染，绝不当作 HTML 解析。

## 使用

打开文件有四种方式：

- **Ctrl+O** —— 文件对话框
- **拖拽**文件到窗口里
- **命令行传入** —— `sesame notes.md`
- **双击文件**（若安装时注册了关联）

### 快捷键

应用级：

| 操作 | 快捷键 |
| --- | --- |
| 新建 / 打开 / 保存 / 另存为 | `Ctrl+N` / `Ctrl+O` / `Ctrl+S` / `Ctrl+Shift+S` |
| 关闭标签 | `Ctrl+W` |
| 重开刚关掉的标签 | `Ctrl+Shift+T` |
| 复制文件路径 | `Ctrl+Shift+C` |
| 切换侧边栏 | `Ctrl+B` |
| Markdown 预览 | `Ctrl+Shift+M` |
| 下一个 / 上一个标签 | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| 设置 / 快捷键 | `Ctrl+,` / `Ctrl+/` |

编辑器内：

| 操作 | 快捷键 |
| --- | --- |
| 查找 / 下一个匹配 | `Ctrl+F` / `Ctrl+G` |
| 选中全部匹配 | `Ctrl+Shift+L` |
| 跳转到行 | `Ctrl+Alt+G` |
| 自动补全 | `Ctrl+Space` |
| 撤销 / 重做 | `Ctrl+Z` / `Ctrl+Y` |
| 全选 | `Ctrl+A` |
| 切换行注释 | `Ctrl+/` |
| 增加 / 减少缩进 | `Ctrl+]` / `Ctrl+[` |
| 上移 / 下移当前行 | `Alt+↑` / `Alt+↓` |
| 向上 / 向下复制当前行 | `Shift+Alt+↑` / `Shift+Alt+↓` |

在应用里按 **Ctrl+/** 可以看到同一份列表。

### 从文件管理器打开

Sesame 是**单实例**的：打开第二个文件时，它会交给已在运行的窗口，
而不是再启动一份。两个进程同时写同一份设置与会话文件会互相覆盖。

### 你的修改有三层保护

1. **主动保存**（`Ctrl+S`）—— 写回原文件。
2. **自动保存**（可选）—— 有路径的标签在停顿后自动写回。
3. **草稿备份**（始终开启）—— 未保存的正文写到应用数据目录，未命名标签同样覆盖，
   下次启动静默还原。

保存是原子的：内容先写到同目录的临时文件，落盘后再替换原文件。
中途失败时保留的是完整旧版，而不是写了一半的残缺文件。

如果文件在你打开之后被外部改过，Sesame 会提示并给出三个出口——
**覆盖磁盘**、**加载磁盘**、**另存为**，不会静默丢掉别人的修改。

大文件只加载部分内容时，另存为也会保留尚未读取的尾部。无法完整解码的文本保持只读，
选对编码后才能编辑；当前编码无法表示的字符会在写盘前报错。
关闭「恢复会话」仍会恢复未保存草稿。缺少磁盘基线的旧草稿会作为未命名文档恢复，
避免覆盖已经更新的原文件。

## 配置

设置存放在各平台的应用数据目录：

| 平台 | 位置 |
| --- | --- |
| Windows | `%APPDATA%\com.sesame.app\` |
| macOS | `~/Library/Application Support/com.sesame.app/` |

`settings.json` 存偏好设置；`recent.json`、`session.json` 与 `drafts/` 分开存放，
因此「清空最近文件」不会波及你的会话与未保存内容。

## 技术栈

| 层 | 选型 |
| --- | --- |
| 外壳 | [Tauri 2](https://tauri.app)（Rust） |
| 界面 | [Svelte 5](https://svelte.dev)（runes）——不用 SvelteKit，无 SSR、无路由 |
| 构建 | [Vite](https://vite.dev) |
| 样式 | [Tailwind CSS v4](https://tailwindcss.com)（CSS-first 配置） |
| 组件 | [shadcn-svelte](https://shadcn-svelte.com) + [bits-ui](https://bits-ui.com) |
| 编辑器 | [CodeMirror 6](https://codemirror.net) |
| Markdown | [marked](https://marked.js.org) + [DOMPurify](https://github.com/cure53/DOMPurify) |

所有文件读写、编码转换、语言识别与路径规范化都在 Rust 侧完成，
前端只通过 IPC 传字符串。

## 开发

```sh
pnpm install        # 安装依赖
pnpm tauri dev      # 带热重载运行
pnpm check          # 类型检查（svelte-check）
pnpm lint           # 代码检查与格式检查（Biome）
cargo test --lib    # 运行 Rust 单测，需在 src-tauri/ 目录下
```

项目文档在 [`docs/`](docs/)：

- [`docs/design/design.md`](docs/design/design.md) —— 外观的唯一权威来源，
  改界面前先读这份。
- [`docs/memory/`](docs/memory/) —— 架构决策、约束与项目概要。

## 发布

推送一个 SemVer 标签（例如 `v0.2.0`）会触发
[`.github/workflows/release.yml`](.github/workflows/release.yml)，
构建 Windows NSIS 安装包与 Apple Silicon DMG，并创建 GitHub Release，
同时上传签过名的自动更新产物与 `latest.json`。
也可以在 Actions 里手动对一个已有标签触发。

发布前的准备：改 `package.json` 的版本、同步 Rust 版本、写这一版的更新说明。

```sh
pnpm sync:version                 # 把版本号同步进 src-tauri/Cargo.toml
$EDITOR docs/releases/v0.2.0.md   # Release 正文来自这个文件
git commit -am "chore(release): v0.2.0"
git tag v0.2.0 && git push --tags
```

以下两种情况 workflow 会**直接失败**：标签与 `package.json` /
`Cargo.toml` 的版本不一致，或 `docs/releases/<标签>.md` 缺失或为空。
这两条都是刻意的——版本不一致会发布出「内部版本永远对不上标签」的安装包，
客户端从此永远显示「已是最新」。

### 需要配置的仓库 Secrets

| Secret | 是否必需 | 用途 |
| --- | --- | --- |
| `TAURI_SIGNING_PRIVATE_KEY` | **必需** | 给更新产物签名。没有它就不会有 `latest.json`，客户端永远收不到更新。 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 私钥设了密码才需要 | 私钥密码。 |

`GITHUB_TOKEN` 由 Actions 自动提供，不用填。

密钥对用 `pnpm tauri signer generate -w ~/.tauri/sesame-updater.key` 生成一次即可。
**公钥**填进 `src-tauri/tauri.conf.json` 的 `plugins.updater.pubkey`
（它不是秘密）；**私钥**与密码填进仓库 Secrets，绝不能提交。
`.gitignore` 里已忽略 `*.key` 作为第二道防线。

> **务必备份私钥。** 丢了就意味着再也无法给已经装了旧版的用户签更新——
> 他们只能手动下载新版。换新密钥只有在「用户先手动装一次带新公钥的版本」
> 之后才生效。

Apple 签名与公证**没有**配置，因此 macOS 的 DMG 是未签名的，
这也是上面安装说明里要提 `xattr` 的原因。
Apple 证书与上面的更新签名是两件独立的事：前者消除系统警告，
后者保证更新包没被篡改。如果以后要加，Tauri 认的六个 Secret 是
`APPLE_CERTIFICATE`、`APPLE_CERTIFICATE_PASSWORD`、`APPLE_SIGNING_IDENTITY`、
`APPLE_ID`、`APPLE_PASSWORD`、`APPLE_TEAM_ID`，写在 `tauri-action`
那一步的 `env:` 下。

## 参与贡献

欢迎提 Issue 和 PR。提 PR 前请：

1. 跑一遍 `pnpm check`、`pnpm lint`、`cargo test --lib`，三项都应是干净的。
2. 若改动涉及外观，先读 `docs/design/design.md` 并遵循它。
3. **所有面向用户的文案都要走 i18n 字典**（`src/lib/i18n/messages/`）。
   新增文案必须**同时**加进 `en.ts` 与 `zh-CN.ts`——漏一边是类型错误，
   不会静默回退。代码注释保持中文，与现有代码一致；注释与日志不翻译。

## 许可证

[MIT](LICENSE) © Sesame contributors
