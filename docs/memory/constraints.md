# Constraints

## MC-CON-20261021-a1b2c3d4 — 判断「是否需要确认框」必须先验证可否撤销

Status: active
Scope: project
Subject: MC-SUBJ-20261021-c3d4e5f6
Facet: workflow
Evidence:
- repo:src/lib/editor/extensions.ts

Requirement:
不要凭「这个操作影响面大」就给破坏性操作加确认框。先验证它能否一步撤销——**能撤销的操作加确认只是增加摩擦**。CodeMirror 的 `replaceAll` 就是一次 dispatch，实测 50 处替换后一次 Ctrl+Z 完全回到原文，因此**不加确认**。

## MC-CON-20261020-a1b2c3d4 — 声明 runes 的文件必须叫 .svelte.ts

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: correctness
Evidence:
- repo:src/lib/i18n/locale.svelte.ts

Requirement:
凡是要用 `$state` / `$derived` / `$effect` 的模块，文件名必须以 `.svelte.ts` 结尾；纯函数与类型放普通 `.ts`。**`svelte-check` 查不出这类错误**——它会在启动时抛 `rune_outside_svelte` 让整个应用白屏，只有真跑起来才暴露。

## MC-CON-20261020-b2c3d4e5 — 界面文案一律走 i18n 字典

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: workflow
Evidence:
- repo:src/lib/i18n/messages/en.ts

Requirement:
不在组件里写中文字面量，一律用 `t('...')`。新增文案必须**同时**加进 `messages/en.ts` 与 `messages/zh-CN.ts`（漏一边会在 svelte-check 阶段报错）。**代码注释与 `console.*` 日志不进字典**——它们不是界面文案。**语言名永远用该语言自身书写**，不跟随界面语言翻译。

## MC-CON-20261018-a1b2c3d4 — 不得把有损解码的二进制内容当文本保存

Status: active
Scope: project
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: safety
Evidence:
- repo:src-tauri/src/core/encoding.rs
- repo:src-tauri/src/commands/fs.rs

Requirement:
任何「探测失败就按有损 UTF-8 兜底」的路径，都必须同时判定「这是不是文本」，是二进制就标记 `binary` 并拒绝保存。**编码探测的宽容与保存的宽容必须分开**：前者为了「能打开」可以容忍替换字符，后者一旦容忍就会把原文件永久毁掉。

## MC-CON-20261018-b2c3d4e5 — 声称支持某个快捷键前必须核对真实绑定

Status: active
Scope: project
Subject: MC-SUBJ-20261018-a1b2c3d4
Facet: workflow
Evidence:
- repo:src/lib/utils/hotkeys.ts

Requirement:
写进快捷键面板（或任何面向用户的文档）的编辑器快捷键，必须先去 `node_modules/@codemirror/*` 的 keymap 定义里核对。**不得凭印象书写**——本项目的编辑器快捷键由 CodeMirror 定义，不在本仓库代码里，靠记忆几乎必然写错。

## MC-CON-20261016-a1b2c3d4 — 启动服务的脚本必须自己回收进程

Status: active
Scope: project
Subject: MC-SUBJ-20261016-d4e5f6a7
Facet: workflow
Evidence:
- repo:scripts/verify-toast.mjs

Requirement:
任何会启动服务的脚本（dev server、验证脚本等）必须自己负责关闭它，不能依赖调用方善后。Windows 上用 `spawn(..., {shell:true})` 时，直接子进程是 `cmd`，只 kill 它会留下孤儿 `vite` 继续占端口——必须用 `taskkill /PID <pid> /T /F` 终止整棵进程树。脚本还要能识别「服务本来就在跑」，此时只复用、不关闭。

## MC-CON-20261015-a1b2c3d4 — 样式验证必须看浏览器计算结果

Status: active
Scope: project
Subject: MC-SUBJ-20261015-c3d4e5f6
Facet: workflow
Evidence:
- repo:src/lib/components/ui/sonner/sonner.svelte
- repo:scripts/verify-toast.mjs

Requirement:
凡涉及**布局形状**的样式改动（胶囊、居中、贴合内容、对齐），必须用真实浏览器读 computed style 与 `getBoundingClientRect` 验证，不能只看源码或构建产物里有没有某个类名。另：Svelte 的 `<script>` 注释里**不要写尖括号包起来的标签名**——解析器会把它当成真实标签，报「`<script>` was left open」。

## MC-CON-20261015-b2c3d4e5 — 排查样式时不要依赖被截断的 cssText

Status: active
Scope: project
Subject: MC-SUBJ-20261015-c3d4e5f6
Facet: workflow
Evidence:
- repo:scripts/verify-toast.mjs

Requirement:
用 `rule.cssText` 排查样式时，**带 `!important` 的声明会被 CSSOM 重排到 `cssText` 末尾**。用 `slice(0, 200)` 之类截断打印会把它切掉，看起来像「声明丢了」。必须打印完整 `cssText`，或直接用 `rule.style.getPropertyValue(name)` 取值。

## MC-CON-20261004-b1c2d3e4 — 不得用 PowerShell 正则改写源码

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: workflow
Evidence:
- repo:src-tauri/src/commands/fs.rs
- repo:src/lib/editor/themes.ts

Requirement:
修改源码一律使用编辑工具，禁止用 PowerShell 的 `-replace` / `[System.IO.File]::WriteAllText` 做批量改写。该做法已两次造成同一类事故：正则 `\s` 跨行匹配吃掉换行，且写入时编码选择错误，把 UTF-8 中文注释变成 GBK 乱码。受损文件需整体重写。

## MC-CON-20261003-e1f2a3b4 — 包管理器固定为 pnpm

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: workflow
Evidence:
- user-confirmed
- repo:pnpm-lock.yaml

Requirement:
所有依赖安装与脚本执行使用 pnpm；不引入 npm 或 yarn 的锁文件。

## MC-CON-20261003-d0e1f2a3 — 不得删除项目已有文件

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: security
Evidence:
- user-confirmed

Requirement:
初始化与开发过程中不得删除项目内已有文件；需要变更时改为新增、改写或明确征求确认。

## MC-CON-20261003-c9d0e1f2 — 前端实现遵循既定三条约定

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed

Requirement:
界面一律使用 Tailwind 工具类而非自定义类名；优先使用组件库已有组件而非原生标签；所有界面文案先用中文，且言简意赅。

## MC-CON-20261003-b8c9d0e1 — 依赖来源走 npmmirror 镜像

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: workflow
Evidence:
- repo:.npmrc

Requirement:
本机到 `registry.npmjs.org` 的 TLS 校验失败，依赖安装固定走 `https://registry.npmmirror.com`（见 `.npmrc`）；Cargo 侧沿用全局 rsproxy 配置。

## MC-CON-20261003-a7b8c9d0 — app.css 的状态变体桥接不可删除

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/app.css

Requirement:
`src/app.css` 顶部把 bits-ui 的 `data-state="..."` 映射到 `data-checked:` 等简写变体的 `@custom-variant` 声明必须保留。删除后开关、选中态、展开态会全部失去样式。

## MC-CON-20261003-a6b7c8d9 — 外观改动以 design.md 为准

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed
- repo:docs/design/design.md

Requirement:
颜色、字号、间距、圆角、图标、交互状态与文案一律遵循 `docs/design/design.md`；新增外观约定先更新该文件再改代码，不要在组件里另起一套。
