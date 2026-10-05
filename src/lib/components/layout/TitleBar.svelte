<script lang="ts">
  /**
   * 自定义标题栏。
   *
   * 窗口为无边框模式（decorations: false），因此这里要自己实现
   * 拖拽区域与最小化/最大化/关闭按钮。
   *
   * 中央区域留给**状态提示**（见 StatusLine.svelte），不再重复显示文件名——
   * 标签栏已经写着当前文件名，两者相距不到 40px。
   */
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { Minus, Square, X, PanelLeft } from '@lucide/svelte';
  import Hint from '$lib/components/common/Hint.svelte';
  import AppMenu from './AppMenu.svelte';
  import StatusLine from './StatusLine.svelte';
  import { toggleSidebar } from '$lib/state/layout.svelte';
  import { t } from '$lib/i18n';

  interface Props {
    onOpenSettings: () => void;
    onOpenShortcuts: () => void;
  }

  let { onOpenSettings, onOpenShortcuts }: Props = $props();

  const appWindow = getCurrentWindow();

  let maximized = $state(false);

  /** 同步最大化状态，用于切换图标。 */
  $effect(() => {
    let unlisten: (() => void) | undefined;
    let disposed = false;

    appWindow.isMaximized().then((v) => {
      if (!disposed) maximized = v;
    });

    appWindow
      .onResized(async () => {
        const v = await appWindow.isMaximized();
        if (!disposed) maximized = v;
      })
      .then((fn) => {
        // 组件可能在 promise 决议前就被销毁；此时监听器还没注册完，
        // 若不记录状态，等它注册好就再也没人注销了（监听器泄漏）。
        if (disposed) fn();
        else unlisten = fn;
      });

    return () => {
      disposed = true;
      unlisten?.();
    };
  });
</script>

<header
  class="flex h-9 shrink-0 select-none items-center gap-1 border-b border-border-subtle bg-surface-sunken pl-1.5 pr-0"
  data-tauri-drag-region
>
  <Hint label={t('sidebar.toggleWithKey')} onclick={toggleSidebar}>
    <PanelLeft class="size-4" />
  </Hint>

  <!--
    中央：状态提示。
    整条仍是拖拽区，但提示本身 pointer-events-none，不会挡住拖窗口。
  -->
  <div
    class="pointer-events-none flex min-w-0 flex-1 items-center justify-center overflow-hidden px-2"
    data-tauri-drag-region
  >
    <StatusLine />
  </div>

  <div class="flex shrink-0 items-center">
    <AppMenu {onOpenSettings} {onOpenShortcuts} />

    <Hint label={t('window.minimize')} class="size-9 rounded-none" onclick={() => appWindow.minimize()}>
      <Minus class="size-3.5" />
    </Hint>

    <Hint
      label={maximized ? t('window.restore') : t('window.maximize')}
      class="size-9 rounded-none"
      onclick={() => appWindow.toggleMaximize()}
    >
      <Square class="size-3" />
    </Hint>

    <Hint
      label={t('action.close')}
      class="size-9 rounded-none"
      danger
      onclick={() => appWindow.close()}
    >
      <X class="size-4" />
    </Hint>
  </div>
</header>
