<script lang="ts">
/**
 * 应用根组件：整体骨架。
 *
 * 这里**没有** Toaster：操作反馈改由标题栏中央的状态提示承担
 * （见 `layout/StatusLine.svelte` 与 `state/status.svelte.ts`）。
 * 原因见那个模块的说明——「已保存」是操作确认，不是需要处理的通知，
 * 用浮动卡片表达它既遮挡内容又抢注意力。
 *
 * ## `ModeWatcher` 的 `defaultMode` 从主题推导
 *
 * 早先这里传 `settings.theme`（`'system' | 'light' | 'dark'`）。
 * 改成主题制后，亮暗由**主题自身**决定（Dracula 恒为暗色、
 * GitHub Light 恒为亮色），不再有独立的亮暗设置。
 *
 * 因此传主题的 `mode`。`ModeWatcher` 只负责在 `<html>` 上维护 `dark`
 * 类供 Tailwind 的 `dark:` 变体使用；实际令牌由 `applyTheme()` 写入。
 */
import { ModeWatcher } from 'mode-watcher';
import Shell from '$lib/components/layout/Shell.svelte';
import { getTheme } from '$lib/state/theme.svelte';

const themeMode = $derived(getTheme().mode);
</script>

<ModeWatcher defaultMode={themeMode} />

<Shell />
