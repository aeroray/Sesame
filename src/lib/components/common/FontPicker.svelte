<script lang="ts">
  /**
   * 字体选择器。
   *
   * 用 Popover + 搜索列表而不是 Select：系统字体可能有几百个，
   * 塞进下拉菜单既难找也无法预览。这里每个条目用该字体自身渲染，
   * 用户能直接看到效果再决定。
   */
  import { Check, Loader2, Search } from '@lucide/svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';
  import { Input } from '$lib/components/ui/input';
  import { ScrollArea } from '$lib/components/ui/scroll-area';
  import { Button } from '$lib/components/ui/button';
  import { cn } from '$lib/utils/cn';
  import { fontList, ensureFonts, filterFonts } from '$lib/state/fonts.svelte';
  import { CJK_FALLBACK_STACK, quoteFont } from '$lib/utils/fonts';

  interface Props {
    /** 当前值。空字符串表示「默认」。 */
    value: string;
    /** 默认项的显示名。 */
    defaultLabel: string;
    /** 选中变化回调。 */
    onchange: (value: string) => void;
    /** 等宽字体是否优先展示（编辑器字体用）。 */
    preferMonospace?: boolean;
  }

  let { value, defaultLabel, onchange, preferMonospace = false }: Props = $props();

  let open = $state(false);
  let query = $state('');

  /**
   * 一次最多渲染多少个字体。
   *
   * 系统字体可能有几百个，而每个条目都带一个用该字体渲染的预览 span
   * （内联 font-family 字符串）。全部渲染意味着每次敲键都要重建几百个节点，
   * 输入会明显发顿。截断到 60 个足够找到目标——找不到时用户自然会继续输入，
   * 而搜索本来就是按名字过滤的。
   */
  const RENDER_LIMIT = 60;

  /** 过滤后的列表。 */
  const filtered = $derived(filterFonts(query));

  /** 实际渲染的列表（截断后）。 */
  const results = $derived(filtered.slice(0, RENDER_LIMIT));

  /** 是否因截断而隐藏了部分结果。 */
  const truncated = $derived(filtered.length > RENDER_LIMIT);

  /** 打开时才加载字体，避免拖慢设置面板首次渲染。 */
  $effect(() => {
    if (open) void ensureFonts();
  });

  /** 当前选中项的展示名。 */
  const currentLabel = $derived(value || defaultLabel);

  function pick(name: string) {
    onchange(name);
    open = false;
    query = '';
  }

  /**
   * 预览样式。
   *
   * 预览文本必须同时含中英文——用户最需要判断的正是
   * 「这个字体下中英文是否协调」。只预览英文会掩盖回退问题。
   */
  function previewStyle(name: string): string {
    return `font-family: ${quoteFont(name)}, ${CJK_FALLBACK_STACK}`;
  }
</script>

<PopoverPrimitive.Root bind:open>
  <PopoverPrimitive.Trigger>
    {#snippet child({ props })}
      <Button
        {...props}
        variant="outline"
        size="sm"
        class="h-8 w-48 justify-between gap-2 px-2.5 font-normal"
      >
        <span class="truncate text-xs" style={value ? previewStyle(value) : ''}>
          {currentLabel}
        </span>
        <span class="text-content-faint">▾</span>
      </Button>
    {/snippet}
  </PopoverPrimitive.Trigger>

  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      align="end"
      sideOffset={4}
      class="z-50 w-72 rounded-lg border border-border-subtle bg-popover p-2 shadow-md outline-none"
    >
      {#if fontList.loading}
        <!-- 首次枚举要扫描系统字体目录，可能几百毫秒，必须有加载态 -->
        <div class="flex items-center justify-center gap-2 py-6 text-xs text-content-faint">
          <Loader2 class="size-4 animate-spin" />
          正在读取系统字体…
        </div>
      {:else if fontList.error}
        <div class="flex flex-col items-center gap-1 py-6 text-center">
          <p class="text-xs text-content-muted">无法读取系统字体</p>
          <p class="text-[11px] text-content-faint">{fontList.error}</p>
        </div>
      {:else}
        <!-- 搜索框 -->
        <div class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-content-faint"
          />
          <Input
            bind:value={query}
            placeholder="搜索字体"
            class="h-7 pl-7 text-xs"
            autocomplete="off"
          />
        </div>

        <ScrollArea class="h-64">
          <div class="flex flex-col gap-0.5 pr-2">
            <!-- 默认项始终在最前 -->
            <button
              type="button"
              class={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-surface-sunken',
                value === '' && 'bg-surface-sunken',
              )}
              onclick={() => pick('')}
            >
              <Check class={cn('size-3.5 shrink-0', value !== '' && 'opacity-0')} />
              <span class="truncate text-content-muted">{defaultLabel}</span>
            </button>

            {#each results as font (font.name)}
              <button
                type="button"
                class={cn(
                  'flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken',
                  value === font.name && 'bg-surface-sunken',
                )}
                onclick={() => pick(font.name)}
              >
                <Check class={cn('size-3.5 shrink-0', value !== font.name && 'opacity-0')} />
                <span class="flex min-w-0 flex-col">
                  <!-- 字体名用界面默认字体显示，保证可读 -->
                  <span class="truncate text-[11px] text-content-muted">{font.name}</span>
                  <!-- 预览用该字体自身渲染，中英文都放，方便判断是否协调 -->
                  <span class="truncate text-xs text-content" style={previewStyle(font.name)}>
                    Sesame  sesame 中文 123
                  </span>
                </span>
                {#if preferMonospace && font.monospaced}
                  <span class="ml-auto shrink-0 rounded-xs bg-surface-sunken px-1 text-[10px] text-content-faint">
                    等宽
                  </span>
                {/if}
              </button>
            {/each}

            {#if results.length === 0}
              <p class="px-2 py-4 text-center text-xs text-content-faint">没有匹配的字体</p>
            {:else if truncated}
              <!-- 说明结果被截断，并给出下一步，而不是让用户以为「只有这些」 -->
              <p class="px-2 py-2 text-center text-[11px] text-content-faint">
                还有 {filtered.length - RENDER_LIMIT} 个，继续输入以缩小范围
              </p>
            {/if}
          </div>
        </ScrollArea>
      {/if}
    </PopoverPrimitive.Content>
  </PopoverPrimitive.Portal>
</PopoverPrimitive.Root>
