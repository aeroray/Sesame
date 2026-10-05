<script lang="ts">
  /**
   * 应用根组件：主题监听与整体骨架。
   *
   * 这里**没有** Toaster：操作反馈改由标题栏中央的状态提示承担
   * （见 `layout/StatusLine.svelte` 与 `state/status.svelte.ts`）。
   * 原因见那个模块的说明——「已保存」是操作确认，不是需要处理的通知，
   * 用浮动卡片表达它既遮挡内容又抢注意力。
   */
  import { ModeWatcher } from 'mode-watcher';
  import Shell from '$lib/components/layout/Shell.svelte';
  import { settings } from '$lib/state/settings.svelte';
</script>

<!-- defaultMode 跟随设置，用户在设置里改动后由 setMode 接管 -->
<ModeWatcher defaultMode={settings.theme} />

<Shell />
