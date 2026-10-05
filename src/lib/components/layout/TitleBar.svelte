<script lang="ts">
/**
 * 自定义标题栏。
 *
 * ## 两个平台的处理方式不同
 *
 * - **Windows**：`decorations: false` 完全去掉系统边框，最小化/最大化/关闭
 *   三个按钮由本组件自绘，靠右排列。
 * - **macOS**：用 `titleBarStyle: "Overlay"`（见 `tauri.macos.conf.json`）。
 *   系统仍提供左侧的红绿灯按钮与全部原生行为（双击缩放、交通灯位置、
 *   全屏动画），我们只把标题栏区域当作拖拽区。
 *   **不要**在 macOS 上自绘窗口按钮——用户对左侧红绿灯的位置和手感
 *   有强预期，自绘一定不对。
 *
 * 因此窗口按钮只在 Windows 渲染，且 macOS 的标题栏左侧要为红绿灯留出空间。
 *
 * 中央区域留给**状态提示**（见 StatusLine.svelte），不再重复显示文件名——
 * 标签栏已经写着当前文件名，两者相距不到 40px。
 */

import { Minus, PanelLeft, Square, X } from '@lucide/svelte';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Hint from '$lib/components/common/Hint.svelte';
import { t } from '$lib/i18n';
import { toggleSidebar } from '$lib/state/layout.svelte';
import { IS_MAC } from '$lib/utils/platform';
import AppMenu from './AppMenu.svelte';
import StatusLine from './StatusLine.svelte';

interface Props {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
}

let { onOpenSettings, onOpenShortcuts }: Props = $props();

const appWindow = getCurrentWindow();

let maximized = $state(false);

/**
 * 同步最大化状态，用于切换图标。
 *
 * 只在 Windows 需要——macOS 的按钮由系统绘制，不随我们切换。
 */
$effect(() => {
  if (IS_MAC) return;

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

<!--
  macOS 左侧要给红绿灯让位（位置由 trafficLightPosition 定为 x=12，
  按钮区宽约 70px），因此左内边距比 Windows 大得多。
-->
<header
  class="flex h-9 shrink-0 select-none items-center gap-1 border-b border-border-subtle bg-surface-sunken pr-0 {IS_MAC
    ? 'pl-20'
    : 'pl-1.5'}"
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

    <!--
      窗口按钮只在 Windows 自绘。
      macOS 用系统红绿灯——位置、悬停态、双击缩放全由系统处理，
      自绘既画不像也会破坏用户预期。
    -->
    {#if !IS_MAC}
      <Hint
        label={t('window.minimize')}
        class="size-9 rounded-none"
        onclick={() => appWindow.minimize()}
      >
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
    {/if}
  </div>
</header>
