<script lang="ts">
/**
 * 应用骨架：标题栏 + 标签栏 + 侧边栏 + 编辑区 + 状态栏。
 *
 * 布局按「紧凑优先」设计——侧边栏默认折叠，编辑区占据剩余全部空间。
 */

import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { flushAutoSave } from '$lib/actions/autosave';
import { requestCloseActive, requestCloseAll } from '$lib/actions/close-tab';
import { flushDrafts } from '$lib/actions/draft';
import { copyPath } from '$lib/actions/file-actions';
import { newTab } from '$lib/actions/new-tab';
import { openPath, openViaDialog, reportError } from '$lib/actions/open-file';
import { requestTogglePreview } from '$lib/actions/preview';
import { reopenClosedTab } from '$lib/actions/reopen-tab';
import { restoreAll } from '$lib/actions/restore-all';
import { saveTab, saveTabAs } from '$lib/actions/save-file';
import SettingsDialog from '$lib/components/dialogs/SettingsDialog.svelte';
import EditorHost from '$lib/components/editor/EditorHost.svelte';
import LargeFileBanner from '$lib/components/editor/LargeFileBanner.svelte';
import TabBar from '$lib/components/tabs/TabBar.svelte';
import WelcomePage from '$lib/components/welcome/WelcomePage.svelte';
import { getProgress, loadAll, loadNextChunk } from '$lib/editor/large-file.svelte';
import { t } from '$lib/i18n';
import * as ipc from '$lib/ipc/fs';
import { startHibernationLoop } from '$lib/state/hibernation.svelte';
import { getImageDimensions, getTransform, setTransform } from '$lib/state/images.svelte';
import { isPreviewing, layout, toggleSidebar } from '$lib/state/layout.svelte';
import { refreshRecents } from '$lib/state/recents.svelte';
import { resumeSessionSave, saveSessionNow, scheduleSessionSave } from '$lib/state/session.svelte';
import { loadSettings, settings } from '$lib/state/settings.svelte';
import { notify } from '$lib/state/status.svelte';
import { activateTab, markDirty, tabs } from '$lib/state/tabs.svelte';
import { documentTasks } from '$lib/utils/async';
import { registerHotkeys } from '$lib/utils/hotkeys';
import {
  flipHorizontal,
  flipVertical,
  type ImageTransform,
  isIdentity,
  rotateCCW,
  rotateCW,
} from '$lib/utils/image-transform';
import { logError } from '$lib/utils/log';
import Sidebar from './Sidebar.svelte';
import StatusBar from './StatusBar.svelte';
import TitleBar from './TitleBar.svelte';

let settingsOpen = $state(false);
/**
 * 设置面板打开时落到哪个分类。
 *
 * 快捷键与设置现在共用一个界面（`Ctrl+/` 与 `Ctrl+,` 都打开设置，
 * 只是落在不同分类）。这是主流做法：JetBrains 与 Notepad++ 都把
 * 快捷键列表放在设置对话框里，VS Code 与 Zed 也是同一界面的两个视图。
 * 两份独立对话框会让用户以为「快捷键」是另一个东西。
 */
let settingsTab = $state<'appearance' | 'editor' | 'files' | 'general' | 'shortcuts' | 'about'>(
  'appearance',
);
let closing = $state(false);
let startupComplete = false;

/** 打开设置面板并落到指定分类。 */
function openSettings(tab: typeof settingsTab = 'appearance') {
  settingsTab = tab;
  settingsOpen = true;
}

async function openQueuedFiles() {
  await documentTasks.run('startup-files', async () => {
    for (const path of await ipc.takeStartupFiles()) await openPath(path);
  });
}

/** 当前激活的标签页。 */
const active = $derived(tabs.items.find((t) => t.id === tabs.activeId) ?? null);

/** 当前标签页的大文件加载进度（不是大文件时为 undefined）。 */
const chunkProgress = $derived(active ? getProgress(active.id) : undefined);

/** 是否显示大文件提示条：有进度且尚未加载完。 */
const showLargeBanner = $derived(
  active?.truncated && chunkProgress !== undefined && !chunkProgress.complete,
);

/** 当前标签页能否预览（仅 Markdown）。 */
const canPreview = $derived(active?.language === 'markdown');

/** 启动：加载设置 → 还原草稿与会话 → 打开命令行文件 → 刷新最近文件。 */
$effect(() => {
  (async () => {
    try {
      await loadSettings();
      await refreshRecents();

      /*
       * 先还原草稿，再还原会话。
       *
       * `restoreAll` 内部已经按这个顺序做完两件事，**不要在这里再调一次
       * `restoreSession`**——那会把所有文件打开两遍。
       *
       * 草稿排在前是因为它是「上次没保存的正文」，最可能被用户以为已经丢了。
       * 草稿恢复成带脏标记的标签，用户想丢弃就关掉它，不需要额外的确认框。
       */
      const { drafts, files } = await restoreAll();

      // 命令行传入的文件优先于会话恢复
      startupComplete = true;
      await openQueuedFiles();

      /*
       * 只在确实恢复了内容时提示一句。
       *
       * 用 toast 而不是模态框：它不打断操作、几秒后自动消失，
       * 但能解释「为什么一打开就多了个标签」——否则用户会困惑。
       */
      if (drafts > 0) {
        notify.info(t('status.restoredDrafts', { count: drafts }));
      } else if (files > 0) {
        notify.info(t('status.restoredSession', { count: files }));
      }
    } catch (err) {
      reportError(err, t('error.openFailed'));
    } finally {
      startupComplete = true;
      resumeSessionSave();
    }
  })();
});

/** 启动休眠巡检；关闭时停止。 */
$effect(() => {
  const stop = startHibernationLoop();
  return stop;
});

/** 窄窗口（< 760px）自动折叠侧边栏，避免挤压编辑区。 */
$effect(() => {
  const onResize = () => {
    if (window.innerWidth < 760) layout.sidebarOpen = false;
  };
  onResize();
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
});

/** 注册全局快捷键。 */
$effect(() => {
  const unregister = registerHotkeys(
    [
      { keys: 'Ctrl+N', label: t('tab.new'), group: t('shortcuts.groupFile'), handler: newTab },
      {
        keys: 'Ctrl+O',
        label: t('command.openFile'),
        group: t('shortcuts.groupFile'),
        handler: () => void openViaDialog(),
      },
      {
        keys: 'Ctrl+S',
        label: t('action.save'),
        group: t('shortcuts.groupFile'),
        handler: () => {
          if (active) void saveTab(active);
        },
      },
      {
        keys: 'Ctrl+Shift+S',
        label: t('action.saveAs'),
        group: t('shortcuts.groupFile'),
        handler: () => {
          if (active) void saveTabAs(active);
        },
      },
      {
        keys: 'Ctrl+W',
        label: t('command.closeTab'),
        group: t('shortcuts.groupFile'),
        handler: () => void requestCloseActive(),
      },
      {
        keys: 'Ctrl+Shift+T',
        label: t('action.reopenClosed'),
        group: t('shortcuts.groupFile'),
        handler: () => void reopenClosedTab(),
      },
      {
        keys: 'Ctrl+Shift+C',
        label: t('action.copyPath'),
        group: t('shortcuts.groupFile'),
        handler: () => void copyPath(),
      },
      {
        keys: 'Ctrl+B',
        label: t('command.toggleSidebar'),
        group: t('shortcuts.groupView'),
        handler: toggleSidebar,
      },
      {
        // 用 Ctrl+Shift+M 而不是 Ctrl+Shift+V：后者是通行的「粘贴为纯文本」，
        // 占用它会破坏编辑器里最基本的粘贴习惯。
        keys: 'Ctrl+Shift+M',
        label: t('editor.preview'),
        group: t('shortcuts.groupView'),
        handler: () => {
          if (active && canPreview) requestTogglePreview(active);
        },
      },
      {
        keys: 'Ctrl+,',
        label: t('menu.settings'),
        group: t('shortcuts.groupView'),
        handler: () => openSettings('appearance'),
      },
      {
        keys: 'Ctrl+/',
        label: t('menu.shortcuts'),
        group: t('shortcuts.groupView'),
        handler: () => openSettings('shortcuts'),
      },
      /*
       * 图片旋转 / 翻转的快捷键。
       *
       * 只在当前标签是**图片**时生效（handler 内部判断），
       * 因此不会与编辑器里同名的按键冲突。
       *
       * ## 键位选择的依据（查过主流实现）
       *
       * IrfanView 用**裸字母** `L` / `R` / `H` / `V`；Preview 用 `Cmd+L` / `Cmd+R`。
       * 裸字母在这里**不能用**：`registerHotkeys` 是先 `preventDefault()`
       * 再调 handler，一个裸 `L` 绑定会把编辑器里每次输入 `L` 都吞掉。
       * 要支持裸字母就得让绑定能「拒绝」，那是另一套机制，不值得为四个
       * 低频快捷键引入。
       *
       * 也**不能**用 `Ctrl+[` / `Ctrl+]`：那两个是 CodeMirror 的
       * 减少/增加缩进（`indentLess` / `indentMore`），在文本标签里
       * 会直接抢掉缩进操作。
       *
       * 最终选 `Ctrl+R` / `Ctrl+Shift+R`（旋转）与
       * `Ctrl+H` / `Ctrl+Shift+H`（翻转）：四个都未被占用，
       * 且 `R` / `H` 与 rotate / horizontal 有助记关系。
       * `Ctrl+H` 在 CodeMirror 的 `searchKeymap` 里**没有**绑定
       * （替换是 `Mod-h` 之外的组合），因此不冲突。
       */
      {
        keys: 'Ctrl+R',
        label: t('image.rotateCW'),
        group: t('shortcuts.groupView'),
        handler: () => rotateActiveImage(rotateCW),
      },
      {
        keys: 'Ctrl+Shift+R',
        label: t('image.rotateCCW'),
        group: t('shortcuts.groupView'),
        handler: () => rotateActiveImage(rotateCCW),
      },
      {
        keys: 'Ctrl+H',
        label: t('image.flipH'),
        group: t('shortcuts.groupView'),
        handler: () => rotateActiveImage(flipHorizontal),
      },
      {
        keys: 'Ctrl+Shift+H',
        label: t('image.flipV'),
        group: t('shortcuts.groupView'),
        handler: () => rotateActiveImage(flipVertical),
      },
      {
        keys: 'Ctrl+Tab',
        label: t('tab.next'),
        group: t('shortcuts.groupView'),
        handler: () => cycleTab(1),
      },
      {
        keys: 'Ctrl+Shift+Tab',
        label: t('tab.previous'),
        group: t('shortcuts.groupView'),
        handler: () => cycleTab(-1),
      },
    ],
    () => !closing,
  );
  return unregister;
});

/** 在标签之间循环切换。 */
function cycleTab(step: number) {
  if (tabs.items.length < 2 || !tabs.activeId) return;
  const index = tabs.items.findIndex((t) => t.id === tabs.activeId);
  const next = (index + step + tabs.items.length) % tabs.items.length;
  const target = tabs.items[next];
  if (target) activateTab(target.id);
}

/**
 * 对当前标签的图片施加一次旋转 / 翻转。
 *
 * 非图片标签、图片尚未解码完成时什么都不做——
 * 快捷键在文本标签下是「无效按键」，不该报错。
 *
 * 脏状态按**实际结果**同步，而不是无条件标脏：转回恒等（例如左转后
 * 又右转）就应当恢复为「未修改」，否则关闭时会平白提示保存。
 * 与 `ImageViewer.svelte` 里的同名逻辑保持一致。
 */
function rotateActiveImage(op: (t: ImageTransform) => ImageTransform) {
  if (active?.kind !== 'image') return;
  if (!getImageDimensions(active.id)) return;
  const next = op(getTransform(active.id));
  setTransform(active.id, next);
  markDirty(active.id, !isIdentity(next));
}

/** 拖拽文件到窗口即打开。 */
$effect(() => {
  let unlisten: (() => void) | undefined;
  // 组件可能在 promise 决议前就被销毁；此时监听器还没注册完，
  // 若不记录状态，等它注册好就再也没人注销了（监听器泄漏）。
  let disposed = false;

  getCurrentWebview()
    .onDragDropEvent((event) => {
      if (closing || event.payload.type !== 'drop') return;
      const paths = event.payload.paths ?? [];
      if (paths.length === 0) return;
      // 并行打开：拖入多个大文件时不必串行等待
      for (const path of paths) void openPath(path);
    })
    .then((fn) => {
      if (disposed) {
        fn();
      } else {
        unlisten = fn;
      }
    })
    .catch((err) => logError('shell', '监听拖拽失败', err));

  return () => {
    disposed = true;
    unlisten?.();
  };
});

/**
 * 第二个实例传来的文件路径。
 *
 * ## 这个监听器曾经完全不存在
 *
 * Rust 侧注册了 `tauri-plugin-single-instance`，在检测到已有实例时
 * 会把文件路径 `emit("open-files", ...)` 给前端。但前端**从来没有
 * 监听这个事件**——实测：开着 A 文件再双击 B 文件，进程数确实是 1
 * （单实例生效了），可 B 文件根本不会打开，事件被丢进了虚空。
 *
 * 症状很隐蔽：用户看到的是「双击第二个文件没反应」，
 * 而不是任何报错。
 *
 * 这里复用与拖拽完全相同的 `openPath`，保证两条入口的去重、
 * 编码探测、最近文件记录行为一致。
 */
$effect(() => {
  let unlisten: (() => void) | undefined;
  let disposed = false;

  listen('open-files', () => {
    if (startupComplete && !closing) {
      void openQueuedFiles().catch((err) => reportError(err, t('error.openFailed')));
    }
  })
    .then((fn) => {
      if (disposed) fn();
      else {
        unlisten = fn;
        if (startupComplete && !closing) {
          void openQueuedFiles().catch((err) => reportError(err, t('error.openFailed')));
        }
      }
    })
    .catch((err) => logError('shell', '监听 open-files 失败', err));

  return () => {
    disposed = true;
    unlisten?.();
  };
});

/** 同步窗口标题，任务栏能看出当前文件。 */
$effect(() => {
  const name = active?.name ?? 'Sesame';
  const dirty = active?.dirty ? ' •' : '';
  getCurrentWindow()
    .setTitle(`${name}${dirty} — Sesame`)
    .catch(() => {});
});

/**
 * 拦截窗口关闭。
 *
 * 规则（按用户约定）：
 * - **开启了自动保存**：先把待写的内容冲刷落盘，然后直接关闭，不打扰用户。
 * - **未开启自动保存**：只要还有任何一个标签未保存，就弹出确认流程；
 *   全部已保存时同样直接关闭。
 *
 * **无论走哪条分支，关闭前都必须先冲刷草稿**：
 * 自动保存只处理有路径的标签，未命名标签的内容只能靠草稿保住。
 * 早先漏了这一步，导致「新建 → 输入 → 关窗口」静默丢内容（实测确认）。
 *
 * 必须用 Tauri 的 `onCloseRequested`——浏览器层的 `beforeunload` 在 Tauri v2
 * 里不会弹出确认界面，`preventDefault()` 拦不住关闭，窗口会直接销毁，
 * 未保存的改动随之丢失（实测过）。
 */
$effect(() => {
  let unlisten: (() => void) | undefined;
  let disposed = false;

  getCurrentWindow()
    .onCloseRequested(async (event) => {
      // Repeated close requests must remain blocked while persistence is pending.
      event.preventDefault();
      if (closing) return;

      // 无论如何都要拦截一次：需要时间写完自动保存、草稿与会话，再主动销毁窗口
      closing = true;
      try {
        await documentTasks.drain();

        // 先把草稿冲刷到磁盘。这一步不依赖自动保存开关——
        // 它是未命名标签唯一的保命手段，也是崩溃/误关的兜底。
        if (!(await flushDrafts())) {
          notify.error(t('error.draftBackupFailed'));
          closing = false;
          return;
        }

        if (settings.autoSave) {
          // 自动保存开启：把防抖中的写入立刻落盘，不必再问用户
          await flushAutoSave();
        } else if (tabs.items.some((t) => t.dirty)) {
          // 未开自动保存且有未保存内容：走确认流程
          const closed = await requestCloseAll(false);
          // 用户取消或保存失败时中止关闭
          if (!closed) {
            closing = false;
            return;
          }
          /*
           * 用户已逐个处理完所有标签，草稿没有存在意义了。
           * 若不清理，下次启动会把刚处理过的内容又恢复一遍，
           * 造成「明明保存过却还提示有未保存内容」的困惑。
           */
        }

        await saveSessionNow();
        await getCurrentWindow().destroy();
      } catch (err) {
        closing = false;
        reportError(err, t('error.saveFailed'));
      }
    })
    .then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    })
    .catch((err) => logError('shell', '监听关闭事件失败', err));

  return () => {
    disposed = true;
    unlisten?.();
  };
});

/**
 * 标签集合变化时防抖保存会话。
 *
 * 依赖 `tabs.items.length` 与激活项而不是整个数组：
 * 后者的每个字段变化（光标、滚动）都会触发，写盘过于频繁。
 */
$effect(() => {
  const count = tabs.items.length;
  const activeId = tabs.activeId;
  void count;
  void activeId;
  scheduleSessionSave();
});
</script>

<div class="flex h-full flex-col overflow-hidden bg-surface text-content" inert={closing}>
  <TitleBar onOpenSettings={() => openSettings('appearance')} />

  <div class="flex min-h-0 flex-1">
    <Sidebar open={layout.sidebarOpen} />

    <main class="flex min-w-0 flex-1 flex-col">
      <TabBar />

      <!-- 大文件提示条：仅当有未加载完的分块时出现 -->
      {#if showLargeBanner && active && chunkProgress}
        <LargeFileBanner
          progress={chunkProgress}
          onLoadMore={() =>
            void loadNextChunk(active).catch((e) => reportError(e, t('error.loadFailed')))}
          onLoadAll={() => void loadAll(active).catch((e) => reportError(e, t('error.loadFailed')))}
        />
      {/if}

      <div class="relative min-h-0 flex-1">
        {#if tabs.items.length === 0}
          <WelcomePage />
        {:else}
          <!-- 每个标签页保留自己的编辑器实例，切换时只切换可见性 -->
          {#each tabs.items as tab (tab.id)}
            <div class="absolute inset-0" class:hidden={tab.id !== tabs.activeId}>
              <EditorHost {tab} active={tab.id === tabs.activeId} preview={isPreviewing(tab.id)} />
            </div>
          {/each}
        {/if}
      </div>

      <StatusBar />
    </main>
  </div>
</div>

<SettingsDialog
  bind:open={settingsOpen}
  initialTab={settingsTab}
  onOpenChange={(v) => (settingsOpen = v)}
/>
