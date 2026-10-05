<script lang="ts">
/**
 * Markdown 预览。
 *
 * 安全说明（重要）：
 * `marked` **不会**转义原始 HTML —— 文档里的 `<script>`、`<img onerror=...>`
 * 会被原样输出。预览必须经 `{@html}` 注入，因此渲染结果一律先过 DOMPurify。
 * 打开一个来路不明的 .md 就等于把它的内容当代码执行，这是必须挡住的。
 */

import { openUrl } from '@tauri-apps/plugin-opener';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { ScrollArea } from '$lib/components/ui/scroll-area';
import { t } from '$lib/i18n';
import { logError } from '$lib/utils/log';

interface Props {
  content: string;
}

let { content }: Props = $props();

marked.use({ gfm: true, breaks: false, async: false });

/**
 * 渲染并净化。
 *
 * DOMPurify 会剔除 script、事件属性（onerror 等）与 javascript: 协议，
 * 同时保留正常的排版标签与链接。
 */
const html = $derived.by(() => {
  try {
    const raw = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(raw, {
      USE_PROFILES: { html: true },
      // 明确禁止这些危险标签，即使 DOMPurify 默认已处理也写清楚意图
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
  } catch (err) {
    logError('MarkdownPreview', 'Markdown 渲染失败', err);
    // 走 `t()` 而不是内联中文：这条兜底文案会真的显示在界面上
    return `<p>${t('error.renderFailed')}</p>`;
  }
});

/**
 * 拦截链接点击，交给系统默认浏览器打开。
 *
 * 不做这一步的话，点击外链会让 WebView 直接导航到那个网址：
 * 应用界面被整个替换成网页，而窗口没有地址栏也没有后退按钮，
 * 用户只能重启应用。
 *
 * 这里在**前端**拦是为了把外链交给系统浏览器（用户预期如此），
 * 而 Rust 侧的导航守卫是最后一道防线——即使这里漏了，
 * 导航也会被拒绝，界面不会被顶掉。
 *
 * 用原生 `addEventListener` 而不是模板上的 `onclick`：
 * 处理器是给内部链接做**事件委托**的，`<article>` 本身不是可交互元素，
 * 写成模板事件会被无障碍检查判为「非交互元素绑定了点击」。
 */
let article = $state<HTMLElement | null>(null);

$effect(() => {
  const el = article;
  if (!el) return;

  const onClick = (event: MouseEvent) => {
    const anchor = (event.target as HTMLElement | null)?.closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href');
    if (!href) return;

    // 页面内锚点（#section）交给浏览器处理，不要当外链打开
    if (href.startsWith('#')) return;

    // 任何链接都不该让应用自身导航走
    event.preventDefault();

    /*
     * 只把真正的网络地址交给系统浏览器。
     * `javascript:` / `data:` 之类既不是有效外链、也有安全风险，直接忽略
     * （DOMPurify 已过滤大部分，这里是第二道）。
     */
    if (!/^https?:\/\//i.test(href)) return;

    void openUrl(href).catch((err) => {
      logError('MarkdownPreview', '打开链接失败', err);
    });
  };

  el.addEventListener('click', onClick);
  return () => el.removeEventListener('click', onClick);
});
</script>

<ScrollArea class="h-full w-full bg-surface">
  <article
    bind:this={article}
    class="mx-auto max-w-3xl px-8 py-6 text-sm leading-relaxed text-content
      [&_a]:text-brand-600 [&_a]:underline [&_a]:underline-offset-2
      [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-4 [&_blockquote]:text-content-muted
      [&_code]:rounded [&_code]:bg-surface-sunken [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
      [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:border-b [&_h1]:border-border-subtle [&_h1]:pb-2 [&_h1]:text-2xl [&_h1]:font-semibold
      [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:border-b [&_h2]:border-border-subtle [&_h2]:pb-1.5 [&_h2]:text-xl [&_h2]:font-semibold
      [&_h3]:mt-4 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold
      [&_hr]:my-6 [&_hr]:border-border-subtle
      [&_img]:my-3 [&_img]:max-w-full [&_img]:rounded-md
      [&_li]:my-1
      [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6
      [&_p]:my-3
      [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-xs
      [&_pre_code]:bg-transparent [&_pre_code]:p-0
      [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse
      [&_td]:border [&_td]:border-border-subtle [&_td]:px-3 [&_td]:py-1.5
      [&_th]:border [&_th]:border-border-subtle [&_th]:bg-surface-sunken [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold
      [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
  >
    <!-- 内容已由 DOMPurify 净化，见组件顶部说明 -->
    {@html html}
  </article>
</ScrollArea>
