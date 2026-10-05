<script lang="ts">
  /**
   * 快捷键一览。
   */
  import {
    Root as DialogRoot,
    Content as DialogContent,
    Header as DialogHeader,
    Title as DialogTitle,
    Description as DialogDescription,
    Footer as DialogFooter,
  } from '$lib/components/ui/dialog';
  import { Kbd } from '$lib/components/ui/kbd';
  import { Button } from '$lib/components/ui/button';
  import { formatKeys, EDITOR_HOTKEYS } from '$lib/utils/hotkeys';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { open = $bindable(), onOpenChange }: Props = $props();

  /**
   * 应用级快捷键分组。
   *
   * 必须与 `Shell.svelte` 里 `registerHotkeys([...])` 注册的保持一致。
   * 之所以没做成「自动从注册表生成」：面板要在注册之前渲染，
   * 而且这两份内容一处是「注册」一处是「展示」，耦合起来反而更难读。
   * 但**编辑器内建的那些已经抽到 `EDITOR_HOTKEYS`**——那份最容易写错，
   * 因为它的真实定义在 CodeMirror 里，不抽出来就无法集中核对。
   */
  const groups = [
    {
      title: '文件',
      items: [
        { keys: 'Ctrl+N', label: '新建标签页' },
        { keys: 'Ctrl+O', label: '打开文件' },
        { keys: 'Ctrl+S', label: '保存' },
        { keys: 'Ctrl+Shift+S', label: '另存为' },
        { keys: 'Ctrl+W', label: '关闭当前标签页' },
      ],
    },
    {
      title: '编辑',
      items: EDITOR_HOTKEYS,
    },
    {
      title: '视图',
      items: [
        { keys: 'Ctrl+B', label: '切换侧边栏' },
        { keys: 'Ctrl+Shift+M', label: 'Markdown 预览' },
        { keys: 'Ctrl+,', label: '打开设置' },
        { keys: 'Ctrl+Tab', label: '下一个标签页' },
        { keys: 'Ctrl+Shift+Tab', label: '上一个标签页' },
        { keys: 'Ctrl+/', label: '显示快捷键' },
      ],
    },
  ];
</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-lg">
    <DialogHeader>
      <DialogTitle>快捷键</DialogTitle>
      <DialogDescription>编辑器内的操作与常见编辑器一致。</DialogDescription>
    </DialogHeader>

    <div class="flex max-h-[60vh] flex-col gap-4 overflow-y-auto py-2 pr-1">
      {#each groups as group (group.title)}
        <section class="flex flex-col gap-1.5">
          <h3 class="text-[11px] font-medium tracking-wide text-content-faint">{group.title}</h3>
          {#each group.items as item (item.keys)}
            <div class="flex items-center justify-between gap-4 py-0.5">
              <span class="text-sm text-content-muted">{item.label}</span>
              <Kbd>{formatKeys(item.keys)}</Kbd>
            </div>
          {/each}
        </section>
      {/each}
    </div>

    <DialogFooter>
      <Button onclick={() => onOpenChange(false)}>知道了</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
