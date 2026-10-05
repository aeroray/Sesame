# Decisions

Entries are newest first.

## MC-DEC-20261021-a1b2c3d4 — 视图重建时保留撤销历史

Status: active
Scope: project
Subject: MC-SUBJ-20261021-b2c3d4e5
Facet: correctness
Evidence:
- repo:src/lib/editor/create-view.ts
- repo:src/lib/state/tabs.svelte.ts
- repo:src/lib/components/editor/EditorHost.svelte

Decision:
`EditorHandle` 新增 `exportHistory()`，用 `EditorState.toJSON({ history: historyField })` 导出；`CreateViewOptions` 新增 `history`，有值时用 `EditorState.fromJSON` 建状态。状态层新增 `pendingHistory` Map 与 set/take/drop 三个函数。EditorHost 在 effect 清理函数里先导出历史再销毁，重建时传入。
Reason:
休眠唤醒与切换 Markdown 预览都会销毁 `EditorView`，而撤销栈存在 EditorState 里随之丢失——用户切一下预览就再也按不回 Ctrl+Z。用整份状态序列化而不是只存 history 字段，是因为 `historyField` 的类型是 `StateField<unknown>`，直接调它的 `toJSON` 拿不到类型信息。两个必须注意的点：**取出即清除**（历史是相对文档的变更集，只能用一次，留着会用错偏移）；**整体替换内容时必须丢弃**（`replaceTabContent` 调 `dropTabHistory`，「加载磁盘内容」与「换编码重开」都是整篇替换）。恢复失败时退回正常创建——丢掉「能撤销」远好过让编辑器打不开。

## MC-DEC-20261021-b2c3d4e5 — 括号彩虹默认关闭

Status: active
Scope: project
Subject: MC-SUBJ-20261021-c3d4e5f6
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/rainbow-brackets.ts

Decision:
实现括号彩虹（按嵌套层级给括号上色），但**默认关闭**，可在设置里打开。层级用 `StateField` 预计算每行行首深度并缓存，`ViewPlugin` 只读缓存生成装饰。文档超过 20 万字符时不启用。扫描时跳过字符串与注释（用游标推进，不是每字符线性查找）。
Reason:
与「安静」的定位有张力——多色括号是主动吸引注意力的装饰，而缩进参考线可以在不被察觉的前提下提供价值，因此两者默认值相反。判定标准是「是否争夺注意力」而非「是否有用」。性能上的两个决定：预计算是 O(n) 且每行存一个数，大文件下语法高亮本身已吃力；跳过区间若每字符线性查找是 O(字符数 × 区间数)，几十万字符会慢到不可用（`syntaxTree.iterate` 按位置升序产生节点，一个只前进的下标即可）。跳过字符串是必须的：`printf("(((")` 会让后面所有括号层级错位。

## MC-DEC-20261020-a1b2c3d4 — 引入双语界面（简体中文 / 英文）

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/i18n/index.ts
- repo:src/lib/i18n/locale.svelte.ts
- repo:src/lib/i18n/messages/en.ts

Decision:
界面支持简体中文与英文，默认跟随系统（`navigator.languages`，`zh` 开头归简体中文，其余归英文），用户可在设置里显式指定。**不引入 i18n 框架**：一个类型化字典 + `t()` 就够。英文那份是字典结构的唯一来源，中文那份标注为同一类型，漏译或多写 key 都会在 svelte-check 阶段报错。
Reason:
README 有双语而界面只有中文——英文用户读完 README、装好应用，看到的是全中文界面，这是当时最影响国际用户的问题。不引框架是因为只有两种语言、约 160 条文案，没有懒加载语言包/复数规则/日期本地化的需求，框架换不来什么。类型强制对齐比「运行时回退到英文」可靠：回退会让漏译悄无声息地溜进发布版。

## MC-DEC-20261020-b2c3d4e5 — 语言状态必须放在 .svelte.ts

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: correctness
Evidence:
- repo:src/lib/i18n/locale.svelte.ts

Decision:
需要声明 runes 的模块，文件名必须以 `.svelte.ts` 结尾。纯函数与类型留在普通 `.ts`。
Reason:
`$state` 放在普通 `.ts` 里会在启动时抛 `rune_outside_svelte`，**整个应用白屏**，而 `svelte-check` 全绿查不出来——只有真跑起来才暴露。i18n 的语言状态踩过这一次（原在 `i18n/index.ts`）。

## MC-DEC-20261020-c3d4e5f6 — 平台收敛为 Windows + macOS

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: architecture
Evidence:
- user-confirmed
- repo:src/lib/utils/platform.ts

Decision:
只支持 Windows 与 macOS，平台判定集中在 `utils/platform.ts`（返回 `'windows' | 'macos'` 两值，不设 `unknown`）。不再声明或适配 Linux。
Reason:
用户明确「只打算支持 macOS 和 Windows，其他平台不管了」。无边框窗口的红绿灯、文件关联、打包格式在每个 Linux 桌面环境上表现都不同，维护成本远超收益。判定收敛成两值而非三值，是为了避免每个调用点都要处理第三种情况。

## MC-DEC-20261020-d4e5f6a7 — 装上单实例与窗口状态插件

Status: active
Scope: project
Subject: MC-SUBJ-20261020-c3d4e5f6
Facet: correctness
Evidence:
- repo:src-tauri/src/lib.rs
- repo:src-tauri/Cargo.toml

Decision:
引入 `tauri-plugin-single-instance`（必须**第一个**注册）与 `tauri-plugin-window-state`。单实例收到第二个实例的参数后，只把文件路径 `emit` 给前端，由前端走与拖拽完全相同的流程。
Reason:
没有单实例时，双击第二个文件会启动第二个 Sesame，两个进程同时读写 `settings.json` / `session.json` 会互相覆盖——这是**数据问题**，不只是体验问题。必须第一个注册，否则其它插件会先初始化一遍（包括建窗口）再被丢弃。让前端处理文件打开是为了保证「命令行传入」与「拖拽」两条入口行为一致（去重、编码探测、最近文件都一致）。

## MC-DEC-20261020-e5f6a7b8 — 新增手动指定编码

Status: active
Scope: project
Subject: MC-SUBJ-20261020-b2c3d4e5
Facet: interface
Evidence:
- repo:src-tauri/src/core/encoding.rs
- repo:src/lib/components/common/EncodingPicker.svelte

Decision:
新增 `decode_as`（跳过探测按指定编码解码）与 `list_encodings` 命令；状态栏的编码文字可点击，弹出编码列表。`decode_as` 返回的 label 经 `label_for` 规范化。
Reason:
实测 Big5、Shift_JIS、无 BOM 的 UTF-16LE 都会被误判成 GBK 并显示为乱码。GBK 的编解码可逆，所以**保存不会损坏文件**（已用测试固定这一结论），但用户看不到正确内容，必须给纠正入口。label 规范化是为了保证「指定编码打开 → 保存」这条链不会因 label 拼写不一致而退回 UTF-8、把文件按错误编码写回去。

## MC-DEC-20261020-f6a7b8c9 — 缩进参考线用 ViewPlugin + 两层渐变

Status: active
Scope: project
Subject: MC-SUBJ-20261020-a1b2c3d4
Facet: interface
Evidence:
- repo:src/lib/editor/indent-guides.ts

Decision:
用 `ViewPlugin` 而非 `StateField` + `updateListener` 实现；装饰为行装饰，宽度通过内联 CSS 变量（`--indent-width` / `--indent-step`）按行给出；样式用「外层 no-repeat + 内层 repeating-linear-gradient」两层结构。
Reason:
两个坑都只有真跑起来才暴露：(1) `updateListener` **不为初始状态触发**，视图刚创建时装饰是空的，参考线要等用户编辑或滚动才出现，表现为「功能没生效」——`ViewPlugin` 的构造函数在创建时就跑；(2) `background-repeat: repeat-x` 会让渐变在**整行**重复，而 `background-size` 只控制每条渐变的宽度，两者叠加导致竖线横跨整行、每 2 个字符一条，像稿纸——必须把重复分成两层。装饰数量与行数同阶而非「行数 × 层级」，且只处理视口内的行。

## MC-DEC-20261019-a1b2c3d4 — 用标题栏状态提示取代 toast

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/layout/StatusLine.svelte
- repo:src/lib/state/status.svelte.ts
- repo:src/lib/components/layout/TitleBar.svelte

Decision:
移除 toast 与 `svelte-sonner` 依赖。「已保存」这类操作反馈改在标题栏中央显示一行图标+文字，按语气分档自动消失（success 2.2s / info 2.6s / warning 4s / error 6s）。标题栏中央**不再常驻显示文件名**。需要用户决策的事仍走原生 `message()` 对话框。
Reason:
用户反馈 toast「挺丑的」且打扰。复查后同意：toast 是浮在内容之上的卡片、还会自己移动，位置与「刚发生了什么」无空间关联；同一件事（保存）在标题栏脏标记与状态栏已有体现，再弹卡片是第三遍重复。标题栏中央原先显示的文件名与标签栏相距不到 40px，纯属重复，空间改留给会变的信息。sonner 被完全 tree-shake（打包产物中已无 `data-sonner-toast`），依赖也已从 package.json 移除。
界线：**告知**用状态提示（自动消失），**决策**用原生对话框——需要决策的事不能只显示一行会消失的字，而「已保存」也不该弹需要点击的框。

## MC-DEC-20261019-b2c3d4e5 — 用户再次编辑时清除「已保存」提示

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: correctness
Evidence:
- repo:src/lib/state/status.svelte.ts
- repo:src/lib/components/editor/EditorHost.svelte

Decision:
`onChange` 里调用 `clearSuccess()`，只清除 success 类提示；error/warning 保留到自然超时。
Reason:
否则标题栏会继续挂着「已保存」而文档其实已经脏了——提示从「操作确认」变成「误导」。错误与警告往往还没到阅读时间，不该被一次按键打断。

## MC-DEC-20261018-a1b2c3d4 — 大文件保存回传真实前缀长度，修复内容重复

Status: active
Scope: project
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: correctness
Evidence:
- repo:src-tauri/src/model/file_meta.rs
- repo:src-tauri/src/commands/fs.rs
- repo:src/lib/actions/save-file.ts

Decision:
`SaveResult` 新增 `prefix_bytes: Option<u64>`，大文件保存时回传**新文件中前缀的真实长度**（`head.len()`），前端用它更新已加载字节数，不再沿用保存前的旧值。另存为时清掉大文件进度并把 `truncated` 复位。
Reason:
`save_large_file_sync` 的 `prefix_bytes` 是「旧文件的加载边界」，用户在前缀里增删字符后它与新文件的前缀长度不再相等。前端原先把 `progress.loadedBytes` 原样传回，于是第二次保存会从错误位置复制尾部，**内容重复、文件每保存一次就变长一截**。已用单测复现（得到 `YXABCDDEFGH` 而非 `YXABCDEFGH`）并修复；实机验证 12 万行文件两次保存后行数与内容均正确。

## MC-DEC-20261018-b2c3d4e5 — 非图片二进制文件不得以文本保存

Status: active
Scope: project
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: security
Evidence:
- repo:src-tauri/src/core/encoding.rs
- repo:src-tauri/src/commands/fs.rs
- repo:src/lib/components/editor/EditorHost.svelte

Decision:
编码探测的兜底分支新增「是不是文本」判定：坏字节数 > 4 且比例 > 10% 时标记为 `binary`、返回空正文。前端据此把编辑器设为只读并在状态栏提示「二进制文件 · 不可编辑保存」，Rust 侧 `save_file` 双重拒绝（`known.encoding == "binary"` 或 `encoding_label` 为 binary）。
Reason:
原先只按扩展名拦截图片，其它二进制（exe、zip、db）会走到有损 UTF-8 兜底，满篇 U+FFFD 交给编辑器，用户按一次 Ctrl+S 就把原文件永久毁掉（实测 PNG 内容有 48% 替换字符）。实机验证：MZ 开头的 .bin 文件打开后编辑器只读、状态栏提示正确、磁盘文件字节未被改动。

## MC-DEC-20261018-c3d4e5f6 — 装上导航守卫，默认拒绝外部导航

Status: active
Scope: project
Subject: MC-SUBJ-20261018-f6a7b8c9
Facet: security
Evidence:
- repo:src-tauri/src/lib.rs
- repo:src/lib/components/editor/MarkdownPreview.svelte
- repo:src-tauri/capabilities/default.json

Decision:
Rust 侧用最小插件挂 `on_navigation`，只放行 `tauri://`、`tauri.localhost`、`about/data/blob`，以及 debug 构建下的 localhost；其余一律拒绝。前端 Markdown 预览用事件委托拦下链接点击，把 http(s) 链接交给 `opener.openUrl`。
Reason:
Tauri 默认 `on_navigation` 是 `|_, _| true`（放行一切）。Markdown 里的外链被点击后 WebView 会直接导航过去，应用界面被替换成网页，而窗口无地址栏无后退，用户只能重启。窗口由 `tauri.conf.json` 声明，拿不到 `WebviewWindowBuilder`；`tauri::Builder` 也没有该钩子，但插件有。前端拦截是为了把外链交给系统浏览器（符合预期），Rust 守卫是兜底。

## MC-DEC-20261018-d4e5f6a7 — 错误码契约与错误类型对齐

Status: active
Scope: project
Subject: MC-SUBJ-20261018-e5f6a7b8
Facet: interface
Evidence:
- repo:src-tauri/src/model/error.rs
- repo:src/lib/state/types.ts

Decision:
新增 `AppError::Unsupported`（code `unsupported`）用于「文件类型不支持当前操作」，替换原先复用的 `InvalidPath`；TS 侧 `AppError['code']` 补齐 `conflict` 与 `unsupported`、删掉后端从不产生的 `unknown_encoding`；`from_io` 的兜底分支改为带上路径。
Reason:
契约两边都错了：TS 漏了后端真实返回的 `conflict`、多了不存在的 `unknown_encoding`，于是按 code 分支的冲突处理在类型层面就丢了出口；对 PNG 按 Ctrl+S 显示「路径无效：…」，而路径明明合法；`from_io` 兜底丢掉路径，用户看到「磁盘空间不足」却不知道是哪个文件，与函数自身注释相矛盾。

## MC-DEC-20261018-e5f6a7b8 — 修正快捷键面板中不存在的绑定

Status: active
Scope: project
Subject: MC-SUBJ-20261018-a1b2c3d4
Facet: interface
Evidence:
- repo:src/lib/utils/hotkeys.ts
- repo:src/lib/components/dialogs/ShortcutsDialog.svelte

Decision:
编辑器内建快捷键抽到 `EDITOR_HOTKEYS` 常量，面板直接引用；内容逐条与 `node_modules/@codemirror/*` 核对。
Reason:
面板原先手写了一份，列了 `Ctrl+H 替换`（`searchKeymap` 根本没有 `Mod-h`）与 `Ctrl+Shift+Z 重做`（`historyKeymap` 是 `Mod-y`，Windows/Linux 用 `Ctrl+Y`，`Ctrl+Shift+Z` 只在 macOS 与 Linux 生效）。面板承诺做不到的事比不写更糟。抽成常量是为了能集中核对——真实定义在 CodeMirror 里，散落在组件中无法维护。

## MC-DEC-20261017-a1b2c3d4 — toast 保留 svelte-sonner，改成胶囊 + 顶部居中（已撤销）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/ui/sonner/sonner.svelte
- repo:src/App.svelte
- repo:scripts/verify-toast.mjs

Decision:
保留 `svelte-sonner`（撤销 MC-DEC-20261015-a1b2c3d4 的自研方案），通过覆盖样式把它改成胶囊，位置用 `position="top-center"` + `offset={{ top: 80 }}`。三处关键覆盖：自己写 `display: flex`；`width: fit-content` + `border-radius: 9999px` + 标题 `white-space: nowrap`；水平定位按容器的 `data-x-position` 分别写（居中用 `left:0; right:0; margin-inline:auto`，不能用 `transform`，否则破坏 sonner 的动画）。
Reason:
用户要求「先从顶部中间出现，且文字与图标垂直居中」，并明确倾向继续用库而非自研（自研维护成本高）。`offset.top` 取 80px 是为了让开窗口自身的顶栏与标签栏（各 `h-9`=36px，共 72px），否则提示会压在标签栏上。实测：宽 82×高 30.8、圆角 ≥ 半高、图标与文字中心偏差 0.01px/0px、水平居中偏差 0px、距顶 80px。
（注：**已被 MC-DEC-20261019-a1b2c3d4 取代**——用户认为 toast 形态本身就打扰，改用标题栏状态提示，sonner 依赖已移除。）

## MC-DEC-20261016-a1b2c3d4 — 验证脚本自己管理 dev server

Status: active
Scope: project
Subject: MC-SUBJ-20261016-d4e5f6a7
Facet: workflow
Evidence:
- user-confirmed
- repo:scripts/verify-toast.mjs

Decision:
`verify-toast.mjs` 自己探测并启动 dev server（若未运行），结束时用 `taskkill /PID <pid> /T /F` 回收整棵进程树；若服务本来就在跑则只复用、不关闭。
Reason:
用户报告 `pnpm tauri dev` 报「Port 1420 is already in use」。根因是我先前用 `Start-Process pnpm dev` 手工起过 dev server 用于截图验证，事后忘了关，残留的 vite 一直占着 1420 端口。脚本启动服务后必须自己收拾干净，不能把善后留给调用方。

## MC-DEC-20261015-a1b2c3d4 — toast 改为自研，移除 svelte-sonner（已撤销）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: architecture
Evidence:
- user-confirmed
- repo:src/lib/components/common/Toaster.svelte
- repo:src/lib/state/toast.svelte.ts

Decision:
自己实现 toast（`common/Toaster.svelte` + `state/toast.svelte.ts`），不再使用 svelte-sonner。对外接口保持 `toast.success('...')` 形状，业务代码只改 import 路径。
Reason:
用户反馈「改成胶囊但根本不像胶囊」。当时认为两轮改造 sonner 都失败，故改为自研。移除后 CSS 98→83KB、JS 914→889KB。
（注：**此决定已被 MC-DEC-20261017-a1b2c3d4 撤销**。用户指出自研的长期维护成本更高，倾向继续用库；且复查发现当时认定的根因是误判——真正原因只是原规则没自己写 `display: flex`。）

## MC-DEC-20261015-b2c3d4e5 — Svelte 的 style 里禁止在规则体内部写注释（已撤销）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261015-c3d4e5f6
Facet: correctness
Evidence:
- repo:scripts/verify-toast.mjs

Decision:
（已撤销）曾认为 Svelte 编译会把规则体内的注释变成字面量文本并吞掉紧随其后的声明，因此要求说明一律写在规则体上方。
Reason:
**该结论是错的，经真实浏览器复核后撤销。** 实测 `.t3 { /* 注释 */ width: fit-content; display: flex; }` 两条声明都正常保留，规则体内注释不会吞声明。当时误判的原因有二：(1) 真正让胶囊失败的是原规则没自己写 `display: flex`，依赖了 sonner 未生效的那条规则；(2) 排查时用 `rule.cssText.slice(0, 200)` 打印，而**带 `!important` 的声明会被 CSSOM 重排到 `cssText` 末尾**，被截断在视野之外，看起来像「声明丢了」。教训见 MC-CON-20261015-b2c3d4e5。

## MC-DEC-20261014-a1b2c3d4 — toast 胶囊必须同时改 <li> 的对齐（已被取代）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: correctness
Evidence:
- user-confirmed
- repo:src/lib/components/ui/sonner/sonner.svelte

Decision:
`.cn-toast` 上写 `width: fit-content !important` 之外，**必须同时写 `right: 0; left: auto`**；不要把父容器 `[data-sonner-toaster]` 改成 `fit-content`。
Reason:
第一次改胶囊只设了 `width: fit-content`，看起来完全没生效。根因是 sonner 的 `<li data-sonner-toast>` 是 `position: absolute` 且默认 `left: 0`，宽度虽收缩但仍贴在 356px 定宽父容器的左边。把父容器改 `fit-content` 则更糟——子元素全绝对定位不参与父元素固有宽度计算，容器塌成 0、toast 换行。实测改后宽度 125px、右对齐。
（注：此方案最终仍未做出真正的胶囊，已被 MC-DEC-20261015-a1b2c3d4「自研 toast」取代。）

## MC-DEC-20261014-b2c3d4e5 — 强调色做成 4 套可切换色阶

Status: active
Scope: project
Subject: MC-SUBJ-20261014-a1b2c3d4
Facet: interface
Evidence:
- user-confirmed
- repo:src/app.css
- repo:src/lib/components/dialogs/SettingsDialog.svelte

Decision:
提供 4 套强调色（indigo 默认 / pine / rose / amber），每套是完整 10 级 `--brand-*` 色阶，通过 `<html data-accent>` 切换；`--primary`/`--ring`/`--accent` 改为引用色阶而不再硬编码。设置面板用色块圆点选择。
Reason:
用户反馈「主题色不是很好看，有点脏脏的」。原暖褐（色相 55 + 彩度 0.14）在 oklch 里偏「土褐」。四套色的亮度阶梯完全一致，只变色相与彩度，保证换色后对比度关系不变。引用色阶而非硬编码，避免换色时逐处同步漏改。实测切换生效并持久化（重启后仍是 pine）。

## MC-DEC-20261013-a1b2c3d4 — toast 改为胶囊形状，宽度贴合内容（已被取代）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/ui/sonner/sonner.svelte

Decision:
toast 改胶囊：`width: fit-content` + `max-width: 320px` + `border-radius: 9999px` + `align-items: center`；并覆盖 sonner 的两处默认布局——`[data-icon]` 去掉 16px 定尺寸与 svg 外边距、`[data-content]` 由 `flex: 1` 改为 `flex: 0 1 auto`。
Reason:
用户反馈「文字和图标没垂直居中」且「toast 太丑、太长了」。根因是 sonner 默认定宽 300px 且内容区 `flex: 1` 撑满，导致「已保存」三字也占满整行。实测图标中心 641.5、文字中心 641，偏差 0.5px。
（注：宽度确实收缩了，但形状仍不是胶囊，已被 MC-DEC-20261015-a1b2c3d4「自研 toast」取代。）

## MC-DEC-20261013-b2c3d4e5 — 查找面板用 flex 居中，不能靠 vertical-align

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/themes.ts

Decision:
`.cm-panel.cm-search` 用 `display: flex` + `align-items: center`；清掉 CodeMirror 的 `margin: .2em .6em .2em 0` 改用容器 `gap`；复选框标签改 `inline-flex` + `gap`；关闭按钮给 20px 尺寸并用 `top: 50%` + `translateY(-50%)` 居中，面板右侧留 26px 内边距。
Reason:
用户反馈「文字和左边的 checkbox 没垂直居中」「关闭按钮太小且不居中」。根因是 CodeMirror 依赖 `vertical-align: middle` 与行内基线（复选框因此偏高），且关闭按钮是 `position: absolute; top: 0` 被钉在顶端。实测复选框与文字偏差 1px、关闭按钮与输入框偏差 1px。亮暗两套布局必须同步改，否则切主题对齐会变。

## MC-DEC-20261012-a1b2c3d4 — 关掉 WebView2 的浏览器快捷键

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src-tauri/src/lib.rs

Decision:
主窗口创建后调用 wry 的 `with_browser_accelerator_keys(false)`（即 WebView2 的 `SetAreBrowserAcceleratorKeysEnabled(false)`）；`Cargo.toml` 显式声明 `webview2-com = "0.39"` 与 `windows = "0.62"`（与 Cargo.lock 中 wry 使用的一致）。
Reason:
用户指出「这是桌面软件，怎么弹出来浏览器的东西，用户都懵了」。Tauri 用 WebView2，默认带 Ctrl+F 浏览器查找栏、Ctrl+P 打印、F3 等浏览器专有快捷键。关掉后 Ctrl+F 不再弹浏览器查找栏，且保留复制/粘贴/全选。实测确认浏览器查找栏不再出现。

## MC-DEC-20261012-b2c3d4e5 — toast 不用 richColors，改中性底 + 状态色边（已撤销）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/ui/sonner/sonner.svelte

Decision:
去掉 `richColors` 与 `closeButton`；改为中性底 + 左侧 2px 状态色边（`inset box-shadow`）+ 状态色图标；尺寸压到 12px 字号 / 8px 内边距 / `--radius-md` 圆角。
Reason:
用户反馈「toast 太跳脱，一看就是另外一个软件的风格」。richColors 的整块彩底正是跳脱来源。用左侧色边表达状态既保留区分度，又与其他界面同属一套语言。

## MC-DEC-20261012-c3d4e5f6 — 编辑器查找面板覆盖 CodeMirror 默认样式

Status: active
Scope: project
Subject: MC-SUBJ-20261012-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/themes.ts

Decision:
`.cm-panel.cm-search` 的输入框与按钮改为紧凑、小圆角、幽灵按钮观感；按钮必须显式写 `backgroundImage: 'none'`。
Reason:
用户反馈「Ctrl+F 那些按钮的风格不符合现有设计语言」。CodeMirror 默认按钮用 `backgroundImage: linear-gradient(...)` 画底，只设 `backgroundColor` 覆盖不掉，必须清 `background-image`，且 hover/active 态要各写一遍。

## MC-DEC-20261011-a1b2c3d4 — 保存一律原子写入

Status: active
Scope: project
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: correctness
Evidence:
- repo:src-tauri/src/core/atomic.rs
- repo:src-tauri/src/commands/fs.rs

Decision:
所有保存路径统一走 `core::atomic`：临时文件写在目标同目录 → `sync_all()` → 带退避重试的 `rename`；失败时清理临时文件，绝不退化成「先删目标再改名」。
Reason:
此前普通保存用 `fs::write` 直接覆盖，写到一半崩溃或断电会把用户文件变成「既不是旧版也不是新版」的残缺内容。跨目录 rename 非原子、缺 fsync 会留下空文件、Windows 占用时需重试——这三点都在模块注释里写明。补了 5 项单测。

## MC-DEC-20261011-b2c3d4e5 — 保存前复核外部修改，保存后更新基线

Status: active
Scope: project
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: correctness
Evidence:
- repo:src-tauri/src/state.rs
- repo:src/lib/actions/save-file.ts

Decision:
打开文件时记录指纹（mtime + 大小）作为持久化基线；保存前重新取指纹比对，不一致返回 `conflict` 错误并弹三选对话框（覆盖磁盘 / 加载磁盘 / 另存为）；保存成功后更新基线。前端 `force: true` 表示用户已确认覆盖。
Reason:
编辑器无法独占文件，若不检查就会一次 Ctrl+S 无提示覆盖掉别的程序的修改。用 mtime + 大小而非内容哈希，避免每次保存都读完整文件。保存后必须更新基线，否则自己写盘产生的 mtime 变化会被下次复核误判成外部修改。实测：外部改文件后保存会弹「文件已被外部修改」，文件未被覆盖。

## MC-DEC-20261011-c3d4e5f6 — 写不进去时给出口而非死路

Status: active
Scope: project
Subject: MC-SUBJ-20261011-f1e2d3c4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/actions/save-file.ts

Decision:
保存遇到 `permission_denied` / `io` 错误时，弹对话框说明原因并引导「另存为到其他位置」；用户选择稍后处理则保持脏状态并提示「修改仍在编辑器中」。
Reason:
只读文件、被占用、无权限时保存必然失败，但用户的修改绝不能因此丢失。不能只弹「保存失败」就结束，要给出可执行的下一步。

## MC-DEC-20261011-d4e5f6a7 — 恢复未保存内容时不弹确认框

Status: active
Scope: project
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/actions/restore-all.ts

Decision:
启动时发现草稿就直接还原成带脏标记的标签，只在有恢复时用一条 toast 说明；不再弹模态框询问是否恢复。
Reason:
用户反馈「这种弹窗挺打扰用户的，还不如直接默认恢复，真想丢弃让他自己去关那个 tab」。内容已在草稿里，恢复不具破坏性；丢弃只是一次关标签操作。把选择权留在界面上，而不是拦在启动路径上。
（注：这推翻了提案里「用横幅或弹窗询问是否恢复」的建议——提案的理由是怕静默还原让用户困惑，用 toast 说明即可解决，无需阻断。）

## MC-DEC-20261011-e5f6a7b8 — 修复：带路径的草稿被丢弃

Status: active
Scope: project
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: correctness
Evidence:
- repo:src/lib/actions/restore-all.ts

Decision:
`restoreDrafts` 还原**所有**草稿，不论有无路径。
Reason:
自测时发现真 bug：原实现把「有路径且文件仍在」的草稿跳过、交给会话流程处理，但会话只按路径重开文件，**草稿里的未保存改动被直接丢掉**——而草稿存在的前提就是有未保存改动，等于把热退出废掉了。实测：磁盘为 DISK-CONTENT、草稿为 DRAFT-CONTENT-SHOULD-WIN 时，现在正确显示草稿内容并带脏标记。

## MC-DEC-20261011-f6a7b8c9 — 修复：会话恢复被调用两次

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: correctness
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
启动流程只调用 `restoreAll()`（内部已完成草稿与会话恢复），删除 Shell 里多余的 `restoreSession()` 调用。
Reason:
`restoreAll` 内部已调用 `restoreSession`，Shell 在 else 分支又调一次，导致会话中的文件被打开两遍。

## MC-DEC-20261010-a1b2c3d4 — 行号左右空隙恒等，右侧留给折叠图标

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts

Decision:
`MARKER_SIZE = 1.25em` 同时作为折叠列宽度与行号 `padding-left`；`padding-right = 0`；并覆盖 CodeMirror 默认的 `min-width: 20px` 为 `0`。
Reason:
用户指出「数字右侧空间挺大、左侧没有」，希望左右一致且右侧那份留给图标。gutter 布局为 `[padLeft + 数字 + padRight][折叠列]`，数字右对齐，故左空隙 = padLeft、右空隙 = padRight + MARKER_SIZE，取 padLeft = MARKER_SIZE、padRight = 0 即恒等。`min-width: 20px` 会把多余宽度算进左侧导致失衡，必须去掉；安全性由 CodeMirror 自带的 spacer（按最大行号计算）保证。实测左 17px、右 18px。

## MC-DEC-20261010-b2c3d4e5 — 开关类按钮只用文字颜色区分，图标不变

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/common/Hint.svelte
- repo:src/lib/components/layout/StatusBar.svelte

Decision:
`Hint` 的激活态改为 `text-content`（亮色），未激活为 `text-content-faint`（灰）；不加任何底色；状态栏两个开关的图标固定不变。
Reason:
用户明确要求「不需要品牌色底，激活用亮色、未激活用灰色就行，图标可以不用换」。此前试过品牌色底，视觉过重；更早的 `bg-surface` 又与状态栏底色同色而看不出状态。图标固定不变是因为换图标会让按钮看起来像两个不同功能。实测激活最亮 232、未激活 105。

## MC-DEC-20261009-a1b2c3d4 — 自定义按钮对话框的返回值是按钮文字

Status: active
Scope: project
Subject: MC-SUBJ-20261009-b1c2d3e4
Facet: correctness
Evidence:
- user-confirmed
- repo:src/lib/actions/close-tab.ts

Decision:
`askUnsaved` 把三个按钮文案抽成常量，用 `message()` 的返回值与常量比对，不再判断 `'Yes'` / `'No'`；无法识别时一律按「取消」处理。
Reason:
用户报告「点『不保存』没有任何反应」。查 rfd 源码确认：用自定义按钮文案时，Windows/macOS/Linux 都返回 `MessageDialogResult::Custom(按钮文字)`，即 `"不保存"`，而不是 `"No"`。原代码判断 `answer === 'No'` 永远不成立，「不保存」落到了默认的 `'cancel'` 分支。

## MC-DEC-20261009-b2c3d4e5 — 行号与折叠栏一起开关

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/extensions.ts

Decision:
把行号与折叠栏合并到同一个 `gutter` Compartment 一起开关；关闭时仍保留 `codeFolding()` 以保住折叠快捷键。
Reason:
用户指出「不显示行号时折叠图标还在」。折叠标记脱离行号就失去参照，用户看不出它属于哪一行。原实现把折叠栏放在固定扩展里，与行号的开关互不相干。

## MC-DEC-20261009-c3d4e5f6 — 行号不可选中

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts
- repo:src/app.css

Decision:
gutter 设 `user-select: none`；`app.css` 的可选中区域由 `.cm-editor` 收窄为 `.cm-editor .cm-content`。
Reason:
用户报告「行号容易被选中，复制代码时会带上行号」。原因是 `.cm-editor { user-select: text }` 把 gutter 一起包含了。
（注：同一轮曾把内边距设为 `0.6em`，该做法已被 MC-DEC-20261010-a1b2c3d4 取代。）

## MC-DEC-20261009-d4e5f6a7 — 开关类按钮的状态表达（已被取代）

Status: superseded
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/common/Hint.svelte
- repo:src/lib/components/layout/StatusBar.svelte

Decision:
`Hint` 的激活态改用品牌色底（`bg-brand-100` / 暗色 `bg-brand-900/50`）；状态栏的换行与行号开关图标随状态切换，提示文字写明「已开启 / 已关闭」。
Reason:
用户指出「无论开启还是关闭，按钮没有任何变化，用户不知道当前状态」。原激活态只加 `bg-surface`，而状态栏底色是 `bg-surface-sunken`，两者几乎同色，肉眼无法分辨；图标也固定不变。

## MC-DEC-20261008-a1b2c3d4 — 行号用 flex 居中，与折叠箭头对齐

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts

Decision:
`.cm-lineNumbers .cm-gutterElement` 加 `display: flex` + `align-items: center` + `justify-content: flex-end`，不再依赖 CodeMirror 默认的行盒排布。
Reason:
用户反馈行号「没有垂直居中，有点向上偏」。根因是 gutter 单元格高度由正文字号算出，而行号用小 1px 的字号，行盒更矮于是贴顶摆放；折叠箭头是 flex 居中的，两者机制不同就对不齐。改完实测每行行号中心与箭头中心偏差在 0.5px 内。

## MC-DEC-20261008-b2c3d4e5 — 状态栏数字必须带标签

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/layout/StatusBar.svelte

Decision:
状态栏的光标位置由 `19:17` 改为「行 19，列 17」，并给编码与换行项加 `title` 提示。
Reason:
用户反馈看不懂 `19:17` 是什么。纯数字组合没有标签就一定猜不出含义；加「行/列」只多两个字符，含义立刻明确。编码(UTF-8)与换行(CRLF)对开发者是常识，保留原样，仅补 title。

## MC-DEC-20261007-a1b2c3d4 — 未保存内容用草稿备份兜底（hot exit）

Status: active
Scope: project
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: behavior
Evidence:
- user-confirmed
- repo:src/lib/actions/draft.ts
- repo:src-tauri/src/commands/draft.rs

Decision:
所有脏标签（不论有无路径）在停止输入 2 秒后，把正文另存一份草稿到应用数据目录 `drafts/`；关闭窗口前立即冲刷。草稿**不依赖自动保存开关**，始终开启。
Reason:
用户询问「新建的、还没保存到桌面的文件，直接关闭窗口会不会丢」。实测确认会静默丢失：未命名标签没有路径，自动保存无从下手，会话快照只记路径也带不走正文，关窗口后 `session.json` 里是空数组。草稿是未命名标签唯一的保命手段，同时提供崩溃保护。参考 VSCode 的 hot exit 设计。

## MC-DEC-20261007-b2c3d4e5 — 草稿删除不做「是否写过」的前置判断

Status: active
Scope: project
Subject: MC-SUBJ-20261007-c1d2e3f4
Facet: correctness
Evidence:
- repo:src/lib/actions/draft.ts

Decision:
`dropDraft` 直接调用删除命令，不加「本会话是否写过该草稿」的前置 return。
Reason:
自测时发现真 bug：启动时从磁盘恢复的草稿不经过写入路径，不在内存集合里，加了前置判断就永远删不掉文件——表现为「保存过或明确放弃后，重启又冒出来」。删除是幂等的，无需前置判断。

## MC-DEC-20261007-c3d4e5f6 — 折叠标记用 SVG 图标而非 CSS 或字体字符

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts

Decision:
折叠标记改用 SVG 图标（几何同 Lucide 的 chevron-down/right），尺寸 1.25em，单元格加 `padding: 0 4px`。不再用字体字符，也不再用 CSS 边框拼。
Reason:
用户反馈 CSS 边框画的箭头「左右空间很小、比左边文字小很多、挤在里面没有空间」。字体字符会随用户所选字体变形且粗细不可控；CSS 边框拼的尺寸被单元格挤压。SVG 几何固定、stroke-width 可控、尺寸随字号缩放。

## MC-DEC-20261006-a1b2c3d4 — 行号栏跟随编辑器字体

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/themes.ts

Decision:
`editorFontTheme()` 把同一字体栈同时应用到 `.cm-content` 与 `.cm-gutters`，行号栏跟随**编辑器字体**而非界面字体。
Reason:
用户要求界定行号归属。行号属于代码编辑面，与代码同栏显示、需逐行对齐，用同一字体才视觉连贯（VSCode 同此做法）。原实现只给 `.cm-content` 设字体，行号便继承 body 的 `--font-sans`，一列数字与正文风格割裂。

## MC-DEC-20261006-b2c3d4e5 — 编辑器字体不跟随界面字体

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/dialogs/SettingsDialog.svelte

Decision:
编辑器字体的空值含义由「跟随界面字体」改为「跟随系统默认」（即内置等宽栈）；两项的默认标签统一为「跟随系统默认」，并删除编辑器字体下方的说明小字。
Reason:
用户明确要求「默认情况下还是别跟随界面字体了，就叫做跟随系统默认，两个都是」。编辑器是代码编辑面，等宽是基本要求，跟随界面字体反而会让代码失去对齐。

## MC-DEC-20261006-c3d4e5f6 — 折叠标记用 VSCode 同款 chevron 箭头

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts

Decision:
折叠标记改用 VSCode 同款人字箭头：展开时朝下，折叠时朝右；用 CSS 边框绘制（正方形只留右、下两条边，旋转 45°），状态间做 transform 过渡。
Reason:
用户提供 VSCode 截图作为参考，认为其箭头更合适。此前实现的加减号虽然语义清楚，但用户更认可箭头形态。CSS 边框画箭头不依赖字体，粗细、大小、颜色均可控，换字体不会变形。

## MC-DEC-20261005-a1b2c3d4 — 折叠标记用加号/减号并与所在行对齐

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/editor/fold-gutter.ts

Decision:
折叠栏标记改用加减号（减号=已展开可收起，加号=已折叠可展开），用 CSS 伪元素绘制而非字符；并把 `.cm-foldGutter .cm-gutterElement` 设为 flex 垂直居中，使标记与所在行严格对齐。
Reason:
用户要求。原实现的 `⌄`/`›` 有两处问题：(1) 标记按文本基线排布，实测比同行行号低约 4px，看起来像挂在两行之间；(2) 字形细小、对比度低，且折叠与可折叠两种状态几乎无法区分。用 CSS 画加减号不依赖字体，用户换字体也不会变形。

## MC-DEC-20261005-b2c3d4e5 — 品牌色阶定义原始令牌供短名引用

Status: active
Scope: project
Subject: MC-SUBJ-20261005-e1f2a3b4
Facet: interface
Evidence:
- repo:src/app.css

Decision:
在 `:root` 定义 `--brand-50` ~ `--brand-900` 原始令牌，`@theme inline` 里的 `--color-brand-*` 改为引用它们。
Reason:
Tailwind v4 的 `@theme` 只生成 `--color-brand-*`，写 `var(--brand-500)` 取不到值。原先 `:focus-visible { outline: 2px solid var(--brand-500) }` 因此成为无效声明，**键盘焦点框完全不显示**——属于无障碍缺陷。现已修复并验证构建产物中存在该变量。

## MC-DEC-20261004-a1b2c3d4 — 字体栈必须显式包含中文字体

Status: active
Scope: project
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/utils/fonts.ts

Decision:
界面字体与编辑器字体的字体栈都显式排入中文字体（`CJK_FALLBACK`），两份共用同一常量。
Reason:
用户报告「编辑器里中文和英文完全不是一个字体」。根因是等宽字体（Consolas 等）几乎都不含中文字形，浏览器为中文单独回退到系统默认中文字体（Windows 常为宋体），于是同一行里英文是无衬线等宽、中文变成衬线体。把中文字体排进栈内即可由我们控制回退结果。

## MC-DEC-20261004-b2c3d4e5 — 界面字体与编辑器字体可分别设置

Status: active
Scope: project
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/common/FontPicker.svelte

Decision:
设置里提供「界面字体」与「编辑器字体」两项；编辑器字体默认为空字符串，表示跟随界面字体。界面字体通过覆盖 CSS 变量 `--font-sans` 生效。
Reason:
用户要求「默认情况下编辑器的字体和软件的字体是跟随的，用户当然可以额外选择」。用 CSS 变量而非逐个组件传值，所有 `font-sans` 元素自动跟随。

## MC-DEC-20261004-c3d4e5f6 — 字体选择器用 Popover + 预览 + 加载态

Status: active
Scope: project
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/common/FontPicker.svelte

Decision:
系统字体枚举走 Rust 侧 `fontdb`（`list_fonts` 命令），前端用 Popover + 搜索列表展示，每项用该字体自身渲染预览。枚举期间显示加载态，失败则降级为只有默认项。
Reason:
用户要求「列出当前电脑中所有的字体以及预览」并「记得在加载的时候给一个 loading」。不用前端 `queryLocalFonts()`：那是实验性 API，需授权且各平台支持度不一。预览文本必须同时含中英文，否则会掩盖中文回退问题。

## MC-DEC-20261004-d4e5f6a7 — 关闭 linker_messages 警告

Status: active
Scope: project
Subject: MC-SUBJ-20261004-f1e2d3c4
Facet: build
Evidence:
- user-confirmed
- repo:src-tauri/Cargo.toml

Decision:
在 `Cargo.toml` 设 `[lints.rust] linker_messages = "allow"`。
Reason:
用户报告 `pnpm tauri dev` 有警告。该警告来自 MSVC 生成 cdylib 时打印「正在创建库 …dll.lib」，属链接器正常输出而非代码问题。cdylib 是 Tauri 移动端构建所需，不能从 crate-type 移除，因此关闭该 lint。

## MC-DEC-20261003-b5c6d7e8 — 关闭窗口的确认规则由自动保存开关决定

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- user-confirmed
- repo:src/lib/components/layout/Shell.svelte

Decision:
关闭窗口时：开了自动保存就先冲刷待写入内容再直接关闭，不打扰用户；未开自动保存则只要存在任一未保存标签就弹确认框。
Reason:
用户明确约定。自动保存的意义就是「不用再问」，此时弹框属于多余打扰；未开自动保存时静默丢弃改动不可接受。

## MC-DEC-20261003-c6d7e8f9 — 未保存确认框必须有「取消」

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/actions/close-tab.ts

Decision:
用 `message()` 配 YesNoCancel 三个按钮（保存 / 不保存 / 取消），不用只有两个按钮的 `ask()`。
Reason:
只有「保存 / 不保存」时用户无法中止关闭，只能被迫二选一；关到一半反悔就没有退路。实测「取消」能正确中止关闭且保留未保存状态。

## MC-DEC-20261003-d7e8f9a0 — 列表操作按钮占用相邻信息的位置

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed
- repo:src/lib/components/welcome/WelcomePage.svelte

Decision:
最近文件列表的「移除」按钮与时间戳共用同一个位置：不悬停显示时间，悬停时时间淡出、按钮淡入。容器固定宽度、两者绝对定位重叠。
Reason:
用户提出。原先按钮独占一列，未悬停时行尾留出一块空白，看起来像缺了东西，表头还得为这列做补偿对齐。重叠方案让行尾始终有内容，表头也自然对齐。

## MC-DEC-20261003-e8f9a0b1 — 编码策略：UTF-8 优先，其余只做顺带支持

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- user-confirmed
- repo:src-tauri/src/core/encoding.rs

Decision:
新文件一律 UTF-8；打开时按 BOM → 严格 UTF-8 → GBK 探测，失败则有损 UTF-8 兜底；保存按打开时探明的编码写回。不做置信度评分、不做手动切换编码的 UI，并删掉无效的「默认编码」设置项。
Reason:
用户明确要求：只要不是「系统本来就支持」，就不要自己写代码去撑。编解码全部由 `encoding_rs` 提供，我们只是多试一次解码，零额外维护成本。原先那个「默认编码」设置项只影响空标签，对打开行为毫无作用，属于假功能。

## MC-DEC-20261003-d1e2f3a4 — 大文件保存用「前缀 + 磁盘尾部」

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: behavior
Evidence:
- repo:src-tauri/src/commands/fs.rs

Decision:
大文件只加载了前缀时，保存走 `save_large_file_sync`：写出编辑器持有的前缀，再把原文件从 `prefix_bytes` 起的尾部原样追加，先写临时文件再原子替换。
Reason:
早先直接拒绝保存，导致 >32 MB 的文件用户改不了。前缀+尾部拼接无需把整个文件读进内存，也不会丢内容。实测 8.27 MB / 90000 行的文件保存后字节完全一致。

## MC-DEC-20261003-e2f3a4b5 — 大文件也必须探测换行风格

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: behavior
Evidence:
- repo:src-tauri/src/commands/fs.rs

Decision:
`open_file_sync` 的大文件分支在探测编码的同时也探测换行风格，不再硬编码 `lf`。
Reason:
CRLF 文件按 LF 写回时前缀会短一截，而尾部仍从原字节偏移开始复制，导致整段内容错位跳过——实测 90000 行变成 78482 行。

## MC-DEC-20261003-f3a4b5c6 — 编码只保留「探测 + 按原样写回」

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:src-tauri/src/core/encoding.rs

Decision:
删掉置信度评分（`confidence` 字段）与从未被前端调用的 `detect_kind` 命令；编解码全部交给 `encoding_rs`，不自研。
Reason:
置信度计算出来没有任何消费方，`detect_kind` 是死代码。用户明确要求「系统本来就支持才做，需要自己写很多代码就不做」——`encoding_rs` 已覆盖 GBK/UTF-16/Big5 等，我们只做「探测一次、按原编码写回」，零额外维护成本。

## MC-DEC-20261003-a1b2c3d5 — 保存前必须校验内容来源

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: security
Evidence:
- repo:src/lib/actions/save-file.ts
- repo:src-tauri/src/commands/fs.rs

Decision:
保存路径必须同时满足三条：标签是文本类型、大文件已完整加载、正文确实存在（`hasTabContent`）。Rust 侧再按扩展名拒绝二进制文件（SVG 除外）。
Reason:
审计发现两条真实的数据损坏路径：图片标签按 Ctrl+S 把 2812 字节的 PNG 截成 0 字节（`getView` 返回 undefined 后被 `?? ''` 兜底）；大文件未加载完时保存把 6.34 MB 写成 1.04 MB。宁可拒绝保存，也不能用局部或空内容覆盖磁盘文件。

## MC-DEC-20261003-b2c3d4e6 — 编码探测容忍窗口边界的残片

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: behavior
Evidence:
- repo:src-tauri/src/core/encoding.rs

Decision:
GBK 判定用「坏字节数量 ≤ 4 或占比 ≤ 1%」而不是「零坏字节」。
Reason:
探测窗口从文件中截断，边界会把多字节字符切成两半。实测 64 KB 窗口里仅 1 个替换字符（0.0015%），却让「零错误」判断把整个 GBK 大文件误判成 UTF-8，显示满屏乱码。

## MC-DEC-20261003-c3d4e5f7 — 分块读取用有损解码保证前进

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: behavior
Evidence:
- repo:src-tauri/src/commands/fs.rs

Decision:
`read_chunk` 按调用方传入的编码用 `decode_to_string`（有损）解码，并保证 `next_offset` 至少前进 1 字节。
Reason:
`decode_to_string_without_replacement` 遇到第一个非法字节就停止消费，GBK 大文件每块只前进 2 字节（实测 7.4 MB 卡在 0%）；配合前端按 `nextOffset` 循环，会形成死循环。有损解码显示一个替换字符，远好过文件读不完。

## MC-DEC-20261003-d4e5f6a8 — 程序化写入用注解而非全局标志

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/editor/large-file.svelte.ts

Decision:
分块追加用 `Annotation` 标记该次事务；脏标记判定读注解，不读跨 await 的标志位。
Reason:
标志位在整个 IPC 往返期间为真，用户在加载期间敲的字会被当成程序化写入而漏掉脏标记，关闭时不再提示，改动丢失。

## MC-DEC-20261003-e5f6a7b9 — 恢复位置经 restoreTargets 交给视图消费

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/state/tabs.svelte.ts
- repo:src/lib/components/editor/EditorHost.svelte

Decision:
光标与滚动位置通过 `setRestoreTarget` 登记，由 `EditorHost` 创建视图时消费一次。
Reason:
视图只在创建时读一次 `tab.scrollTop`，而恢复会话与休眠唤醒的赋值都发生在挂载之后，直接改 tab 字段对视图无效——实测光标总是回到第 1 行。

## MC-DEC-20261003-f6a7b8ca — 窗口关闭必须用 onCloseRequested

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/components/layout/Shell.svelte

Decision:
拦截窗口关闭用 Tauri 的 `onCloseRequested`，不用浏览器 `beforeunload`。
Reason:
Tauri v2 不呈现浏览器层的关闭确认，`beforeunload` 里的 `preventDefault()` 拦不住关闭，窗口直接销毁，未保存改动丢失；且 teardown 期间发出的 IPC 往往来不及完成。

## MC-DEC-20261003-a7b8c9db — 路径比较统一为正斜杠

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/state/tabs.svelte.ts

Decision:
`findByPath` 先把两侧路径规范化为正斜杠再比较。
Reason:
后端返回 `D:/a/b.md`，而对话框、拖拽、命令行传来 `D:\a\b.md`。不统一则 Windows 上永远匹配不到，同一文件被开成两个标签，先后保存互相覆盖。

## MC-DEC-20261003-c1d2e3f4 — 外观规范集中于 docs/design/design.md

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed
- repo:docs/design/design.md

Decision:
颜色、字体、间距、圆角、图标、交互状态与文案规范统一写在 `docs/design/design.md`，作为外观的唯一权威来源；界面改动前先读该文件。
Reason:
规范散落在各组件里会逐渐分叉；集中一处后新增组件有明确参照，也便于日后整体调整。

## MC-DEC-20261003-d2e3f4a5 — 图片以 data URL 返回而非 asset 协议

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:src-tauri/src/commands/media.rs

Decision:
`read_image` 返回 base64 data URL；单张图片上限 32 MB。
Reason:
asset 协议需要在 capabilities 里为每个路径开 scope，而文件对话框选中的路径运行期才知道；data URL 无需额外权限。上限用于避免一次注入上百 MB 字符串拖垮 WebView。

## MC-DEC-20261003-e3f4a5b6 — 会话恢复逆序打开标签

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/actions/restore-session.ts

Decision:
恢复会话时按保存顺序**从后往前**逐个打开文件。
Reason:
新标签一律 `unshift` 到数组最前，正序打开会把标签栏整个颠倒（实测复现）。逆序打开后最终顺序才与保存时一致。

## MC-DEC-20261003-f4a5b6c7 — 会话不保存未命名标签与未保存改动

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/state/session.svelte.ts

Decision:
会话只记录有路径的标签及其光标、滚动位置；不保存未命名标签，也不保存未落盘的改动。
Reason:
未命名标签的正文没有磁盘副本，恢复出一个空标签是误导；把未保存内容偷偷写进应用数据目录则违背「改动必须由用户保存」的预期。

## MC-DEC-20261003-a5b6c7d8 — 状态层不得依赖 actions 层

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: architecture
Evidence:
- repo:src/lib/state/session.svelte.ts
- repo:src/lib/actions/restore-session.ts

Decision:
`state/` 只做状态与存储读写，不调用 `actions/`；需要编排时把逻辑放到 `actions/`。
Reason:
恢复会话最初写在 `session.svelte.ts` 里并 import 了 `openPath`，形成 actions ↔ state 循环依赖。虽然靠函数提升能跑，但很脆弱；拆成 state 存快照、actions 做编排后依赖方向单一。

## MC-DEC-20261003-b1c2d3e4 — Markdown 预览必须经 DOMPurify 净化

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: security
Evidence:
- repo:src/lib/components/editor/MarkdownPreview.svelte

Decision:
`marked` 的渲染结果一律先过 `DOMPurify.sanitize` 再交给 `{@html}`，并显式禁用 script/style/iframe/object/embed/form 与 on* 事件属性。
Reason:
`marked` **不会**转义原始 HTML——实测 `<script>alert(1)</script>` 与 `<img src=x onerror=...>` 会被原样输出。预览走 `{@html}` 注入，不净化就等于把来路不明的 .md 当代码执行。

## MC-DEC-20261003-c2d3e4f5 — 预览与语言包不得进入首屏包

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: performance
Evidence:
- repo:src/lib/components/editor/EditorHost.svelte
- repo:vite.config.ts

Decision:
Markdown 预览组件用动态 `import()` 懒加载；语言包同样按需加载；构建时不指定 `manualChunks`。
Reason:
`marked` + `DOMPurify` 约 35 KB（gzip），静态引入会让不用预览的用户也付出代价（实测首屏从 255 KB 涨到 290 KB）。改为懒加载后回到约 256 KB。

## MC-DEC-20261003-d3e4f5a6 — 搜索面板直接用官方实现并中文化

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/editor/search-i18n.ts

Decision:
使用 `@codemirror/search` 的 `search()` 扩展，通过 `EditorState.phrases.of()` 把文案换成中文，不自己写查找替换面板。
Reason:
官方面板已处理正则、大小写、整词、跨行匹配与替换等边界情况；自写只会引入难测的缺陷。短语键必须与包内 `phrase(...)` 调用的英文字符串逐字一致。

## MC-DEC-20261003-e4f5a6b7 — 分块追加不得触发脏标记

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: behavior
Evidence:
- repo:src/lib/editor/large-file.svelte.ts

Decision:
分块加载在 `dispatch` 之前先把 `loading` 置为 true，编辑器的 change 回调据此跳过脏标记。
Reason:
`EditorView.updateListener` 是同步触发的，程序化追加若不拦住，文件刚打开就会被标记为「已修改」，用户会误以为内容被改动过。

## MC-DEC-20261003-f5a6b7c8 — 深休眠保留正文并重建视图

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: performance
Evidence:
- repo:src/lib/state/hibernation.svelte.ts

Decision:
深休眠先取出正文、再 `detachView`（它会清空待用正文）、最后写回正文；重新激活时由 `sleep` 变化触发视图重建。浅休眠只打标记，不释放资源。
Reason:
顺序颠倒会把刚保存的正文立刻删掉。浅休眠不做资源回收，因此必须在代码与文档里如实说明，不能让它看起来像真的省了内存。

## MC-DEC-20261003-a7b8c9d0 — 快捷键匹配同时比对 event.code

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/utils/hotkeys.ts

Decision:
标点键（逗号、斜杠等）的快捷键匹配同时比对 `event.code`，不能只比对 `event.key`；同时每个功能都要有可点击入口。
Reason:
中文输入法激活时会拦截或改写标点键的 `event.key`，导致 Ctrl+, 失效；`event.code` 是物理键位，不受布局与输入法影响。

## MC-DEC-20261003-f9a0b1c2 — 界面采用「紧凑布局 + 可折叠侧栏」

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- user-confirmed

Decision:
主界面为标题栏 + 标签栏 + 编辑区的紧凑三行结构，左侧栏默认折叠，按 Ctrl+B 展开；空白标签页即欢迎页，采用「最近文件优先」布局。
Reason:
默认折叠让编辑区占满窗口，符合轻量定位；需要多文件切换时再展开侧栏，避免像常驻侧栏那样长期占用宽度。

## MC-DEC-20261003-a1b2c3d4 — 前端采用纯 Svelte + Vite，不使用 SvelteKit

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- user-confirmed
- repo:index.html

Decision:
前端为纯 Svelte 5 + Vite 单页应用，入口是 `index.html` 与 `src/main.ts`，不引入 SvelteKit。
Reason:
桌面应用不需要路由与 SSR，纯 SPA 更轻、更简单，也少一层构建约定。

## MC-DEC-20261003-b2c3d4e5 — Tailwind v4 走 CSS-first 配置

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:src/app.css
- repo:vite.config.ts

Decision:
使用 `@tailwindcss/vite` 插件与 `src/app.css` 中的 `@import "tailwindcss"` 和 `@theme` 令牌，不创建 `tailwind.config.js`。
Reason:
Tailwind v4 以 CSS-first 取代 JS 配置，主题令牌与暗色变量在同一处维护，避免两套来源。

## MC-DEC-20261003-c3d4e5f6 — app.css 必须声明 bits-ui 状态变体

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/app.css

Decision:
`src/app.css` 必须保留 `@custom-variant` 定义的 `data-open`、`data-closed`、`data-checked`、`data-unchecked`、`data-active`、`data-disabled`、`data-highlighted` 等变体，把 bits-ui 的 `data-state="..."` 属性映射到组件类名使用的简写变体。
Reason:
bits-ui 写出的是 `data-state="checked"`，而 shadcn-svelte 组件类名用的是 `data-checked:`；Tailwind 不认识这种简写。缺少这段声明时开关、选中态、展开态会全部失去样式，开关会退化成一个几乎看不见的暗色圆点。

## MC-DEC-20261003-d4e5f6a7 — 编辑器扩展手工装配而非 basicSetup

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: architecture
Evidence:
- repo:src/lib/editor/extensions.ts

Decision:
自行组装 CodeMirror 扩展集，并用 Compartment 动态重配置语言、主题、行号、换行、制表符与只读状态；行号扩展必须排在折叠栏之前注册。
Reason:
basicSetup 不支持按设置动态调整；Compartment 让设置变更只替换对应扩展段，从而保留撤销历史与光标。行号顺序错误会让折叠箭头显示在行号左侧，与所有主流编辑器相反。

## MC-DEC-20261003-e5f6a7b8 — 语言包按需懒加载

Status: active
Scope: project
Subject: MC-SUBJ-20261003-a1b2c3d4
Facet: performance
Evidence:
- repo:src/lib/editor/languages.ts

Decision:
各语言包通过动态 `import()` 按需加载并缓存；shell、toml、ini 走 `@codemirror/legacy-modes` + StreamLanguage。构建时不得手工指定 `manualChunks` 把语言包并入初始分块。
Reason:
静态引入全部语言会撑爆首屏预算；且 CodeMirror 6 没有 `@codemirror/lang-shell`，这些语言官方只提供 legacy 模式。手工分块会破坏懒加载，使首屏体积从约 255 KB 涨到约 344 KB。

## MC-DEC-20261003-f6a7b8c9 — 编辑器视图与文档正文不放入响应式状态

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: performance
Evidence:
- repo:src/lib/state/tabs.svelte.ts

Decision:
`EditorView` 句柄与标签页正文存于普通 `Map`，不放进 Svelte 的 `$state`；响应式状态只记录标签页的纯数据。
Reason:
`$state` 会深层代理对象，代理 DOM 与编辑器实例既拖慢性能又破坏其内部行为，正文体积大时代理开销更明显。

## MC-DEC-20261003-a7b8c9d0 — 快捷键匹配同时比对 event.code

Status: active
Scope: project
Subject: MC-SUBJ-20261003-b2c3d4e5
Facet: interface
Evidence:
- repo:src/lib/utils/hotkeys.ts

Decision:
标点键（逗号、斜杠等）的快捷键匹配同时比对 `event.code`，不能只比对 `event.key`；同时每个功能都要有可点击入口。
Reason:
中文输入法激活时会拦截或改写标点键的 `event.key`，导致 Ctrl+, 失效；`event.code` 是物理键位，不受布局与输入法影响。
