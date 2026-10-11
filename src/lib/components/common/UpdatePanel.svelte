<script lang="ts">
/**
 * 「设置 → 关于」里的自动更新面板。
 *
 * ## 为什么放在这里而不是弹窗
 *
 * 发现新版本不是需要立刻决定的事。用模态框打断正在进行的编辑，
 * 代价远大于收益——用户可能只是想让编辑器安静待着。
 * 因此更新入口就在「关于」里：想看的时候一眼可见，不看也不会被打扰。
 *
 * 这与 `status.svelte.ts` 里记录的分工一致：
 * 只有**必须做决定**的事（覆盖还是重载、保存还是不保存）才用对话框。
 *
 * ## 更新说明按纯文本渲染
 *
 * `notes` 来自 GitHub Release 的正文，**不受安装包签名保护**——
 * minisign 签的是二进制，不是这份 JSON 清单。
 * 因此这里只当纯文本显示，绝不解析成 HTML：
 * 否则一个被篡改的清单就能在应用里执行任意标记。
 */
import { AlertCircle, Check, Download, Loader2, RefreshCw } from '@lucide/svelte';
import { Button } from '$lib/components/ui/button';
import { t } from '$lib/i18n';
import {
  checkForUpdate,
  hasUpdate,
  installUpdate,
  resetUpdateState,
  update,
} from '$lib/state/update.svelte';

/** 是否有更新待安装。 */
const available = $derived(hasUpdate());

/** 正在下载或安装。 */
const busy = $derived(update.phase === 'downloading' || update.phase === 'installing');

/** 下载进度文案。总大小未知时退化为不带百分比的提示。 */
const progressText = $derived(
  update.progress === null
    ? t('update.downloadingUnknown')
    : t('update.downloading', { percent: update.progress }),
);

/** 按钮是否可点：检查中与安装中都不该重复触发。 */
const canCheck = $derived(update.phase !== 'checking' && !busy);
</script>

<div class="flex flex-col gap-2 border-t border-border-subtle pt-3">
  <span class="text-[11px] font-medium tracking-wide text-content-faint">
    {t('update.title')}
  </span>

  <!--
    状态行。
    每种阶段给一个图标而不是只换文字：文字要读完才知道结果，
    图标扫一眼就能分辨（对勾=最新、下载箭头=有更新、转圈=进行中、感叹号=出错）。
  -->
  <div class="flex items-center gap-2 text-[11px]">
    {#if update.phase === 'checking'}
      <Loader2 class="size-3 shrink-0 animate-spin text-content-faint" />
      <span class="text-content-muted">{t('update.checking')}</span>
    {:else if update.phase === 'available'}
      <Download class="size-3 shrink-0 text-brand-500" />
      <span class="text-content">{t('update.available', { version: update.version ?? '' })}</span>
    {:else if update.phase === 'downloading'}
      <Loader2 class="size-3 shrink-0 animate-spin text-content-faint" />
      <span class="text-content-muted">{progressText}</span>
    {:else if update.phase === 'installing'}
      <Loader2 class="size-3 shrink-0 animate-spin text-content-faint" />
      <span class="text-content-muted">{t('update.installing')}</span>
    {:else if update.phase === 'error'}
      <AlertCircle class="size-3 shrink-0 text-destructive" />
      <span class="min-w-0 flex-1 text-destructive">{update.error}</span>
    {:else}
      <Check class="size-3 shrink-0 text-content-faint" />
      <span class="text-content-muted">{t('update.upToDate')}</span>
    {/if}
  </div>

  <!--
    下载进度条。总大小未知时（服务端没给 Content-Length）不显示，
    否则会是一条永远不动的空条，比不显示更让人困惑。
  -->
  {#if update.phase === 'downloading' && update.progress !== null}
    <div
      class="h-1 w-full overflow-hidden rounded-full bg-surface-sunken"
      role="progressbar"
      aria-valuenow={update.progress}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-label={progressText}
    >
      <div class="h-full bg-brand-500 transition-[width]" style="width: {update.progress}%"></div>
    </div>
  {/if}

  <!--
    更新说明。限高 + 可滚动：Release notes 可能很长，
    不限制会把「关于」面板撑得看不到底部的按钮。
    限高用 max-h-32（128px）——大约 8 行，足够看清要点。
  -->
  {#if available && update.notes}
    <div class="flex flex-col gap-1">
      <span class="text-[10px] text-content-faint">{t('update.notes')}</span>
      <pre
        class="max-h-32 overflow-y-auto whitespace-pre-wrap break-words rounded-md bg-surface-sunken p-2 font-sans text-[11px] leading-relaxed text-content-muted">{update.notes}</pre>
    </div>
  {/if}

  <div class="flex items-center gap-2">
    {#if available}
      <Button size="sm" class="gap-1.5" disabled={busy} onclick={() => void installUpdate()}>
        {#if busy}
          <Loader2 class="size-3.5 animate-spin" />
        {:else}
          <Download class="size-3.5" />
        {/if}
        {t('update.download')}
      </Button>
    {:else}
      <Button
        variant="outline"
        size="sm"
        class="gap-1.5"
        disabled={!canCheck}
        onclick={() => {
          // 出错后再点「检查更新」时先清掉错误，否则旧错误会一直挂在那儿
          if (update.phase === 'error') resetUpdateState();
          void checkForUpdate();
        }}
      >
        {#if update.phase === 'checking'}
          <Loader2 class="size-3.5 animate-spin" />
        {:else}
          <RefreshCw class="size-3.5" />
        {/if}
        {update.phase === 'error' ? t('update.retry') : t('update.check')}
      </Button>
    {/if}
  </div>
</div>
