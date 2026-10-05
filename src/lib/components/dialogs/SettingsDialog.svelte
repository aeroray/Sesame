<script lang="ts">
  /**
   * 设置面板。
   */
  import { RotateCcw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Label } from '$lib/components/ui/label';
  import { Switch } from '$lib/components/ui/switch';
  import { Separator } from '$lib/components/ui/separator';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '$lib/components/ui/select';
  import {
    Root as DialogRoot,
    Content as DialogContent,
    Header as DialogHeader,
    Title as DialogTitle,
    Description as DialogDescription,
    Footer as DialogFooter,
  } from '$lib/components/ui/dialog';
  import { settings, updateSetting, resetSettings } from '$lib/state/settings.svelte';
  import { cancelAllAutoSave } from '$lib/actions/autosave';
  import FontPicker from '$lib/components/common/FontPicker.svelte';
  import { cn } from '$lib/utils/cn';
  import { setMode } from 'mode-watcher';
  import { FONT_SIZE_MIN, FONT_SIZE_MAX } from '$src/constants';
  import type { AccentId } from '$lib/state/types';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { open = $bindable(), onOpenChange }: Props = $props();

  /** 主题选项。 */
  const themes = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' },
  ] as const;

  /**
   * 强调色选项。
   *
   * `color` 是用于展示的色块值，必须与 app.css 里对应色阶的 `--brand-500`
   * 保持一致。这是**唯一一处刻意的重复**：CSS 变量在 `[data-accent]` 作用域下，
   * 无法在读色块时动态取值，因此在这里写一份。改色阶时记得同步这里。
   */
  const ACCENTS: { id: AccentId; label: string; color: string }[] = [
    { id: 'indigo', label: '靛蓝', color: 'oklch(0.63 0.16 264)' },
    { id: 'pine', label: '松绿', color: 'oklch(0.63 0.135 162)' },
    { id: 'rose', label: '玫红', color: 'oklch(0.64 0.18 355)' },
    { id: 'amber', label: '琥珀', color: 'oklch(0.68 0.15 72)' },
  ];

  /** 字号选项。 */
  const fontSizes = Array.from(
    { length: FONT_SIZE_MAX - FONT_SIZE_MIN + 1 },
    (_, i) => FONT_SIZE_MIN + i,
  );

  /** 制表符宽度选项。 */
  const tabSizes = [2, 4, 8];

  /**
   * 每个 Select 都必须传 `items`。
   *
   * bits-ui 在菜单未打开时无法从 DOM 读取选项文字，
   * 只会回退到显示原始 value（于是出现 `system` 这种英文值）。
   * 传入 items 后，关闭状态下也能显示中文标签。
   */
  const fontSizeItems = fontSizes.map((size) => ({
    value: String(size),
    label: `${size} px`,
  }));

  const tabSizeItems = tabSizes.map((size) => ({
    value: String(size),
    label: `${size} 空格`,
  }));

  /** 切换主题时同步给 mode-watcher。 */
  async function changeTheme(value: string) {
    await updateSetting('theme', value as 'light' | 'dark' | 'system');
    setMode(value as 'light' | 'dark' | 'system');
  }

  /**
   * 切换自动保存。
   *
   * 关掉时必须清空所有待触发的定时器——否则关掉开关后
   * 之前排队的那次写入仍会在几百毫秒后执行，与用户的意图相反。
   */
  async function changeAutoSave(value: boolean) {
    await updateSetting('autoSave', value);
    if (!value) cancelAllAutoSave();
  }

  async function handleReset() {
    await resetSettings();
    setMode(settings.theme);
  }
</script>

<DialogRoot bind:open>
  <DialogContent class="max-w-md">
    <DialogHeader>
      <DialogTitle>设置</DialogTitle>
      <DialogDescription>这些设置会自动保存。</DialogDescription>
    </DialogHeader>

    <div class="flex flex-col gap-4 py-2">
      <!-- 外观 -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-theme" class="text-sm font-normal">主题</Label>
        <Select
          type="single"
          value={settings.theme}
          onValueChange={changeTheme}
          items={themes.map((t) => ({ value: t.value, label: t.label }))}
        >
          <SelectTrigger id="setting-theme" class="w-32">
            <SelectValue placeholder="选择主题" />
          </SelectTrigger>
          <SelectContent>
            {#each themes as t (t.value)}
              <SelectItem value={t.value} label={t.label}>{t.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>

      <!--
        强调色：直接展示色块而不是下拉框。
        选颜色是「看一眼就知道」的事，色块比文字列表直观得多，
        而且四个选项一屏放得下，不需要折叠。
      -->
      <div class="flex items-center justify-between gap-4">
        <Label class="text-sm font-normal">强调色</Label>
        <div class="flex items-center gap-1.5" role="radiogroup" aria-label="强调色">
          {#each ACCENTS as accent (accent.id)}
            <button
              type="button"
              role="radio"
              aria-checked={settings.accent === accent.id}
              aria-label={accent.label}
              title={accent.label}
              class={cn(
                'size-5 rounded-full transition-transform hover:scale-110',
                // 选中态用描边环表达，而不是勾选图标——色块本身就说明了一切
                settings.accent === accent.id
                  ? 'ring-2 ring-offset-2 ring-offset-background'
                  : 'ring-1 ring-border-strong',
              )}
              style="background-color: {accent.color}; --tw-ring-color: {accent.color}"
              onclick={() => updateSetting('accent', accent.id)}
            ></button>
          {/each}
        </div>
      </div>

      <Separator />

      <!-- 外观 -->
      <div class="flex items-center justify-between gap-4">
        <Label class="text-sm font-normal">界面字体</Label>
        <FontPicker
          value={settings.uiFont}
          defaultLabel="跟随系统默认"
          onchange={(v) => updateSetting('uiFont', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label class="text-sm font-normal">编辑器字体</Label>
        <FontPicker
          value={settings.editorFont}
          defaultLabel="跟随系统默认"
          onchange={(v) => updateSetting('editorFont', v)}
          preferMonospace
        />
      </div>

      <Separator />

      <!-- 编辑器 -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-font-size" class="text-sm font-normal">字号</Label>
        <Select
          type="single"
          value={String(settings.fontSize)}
          onValueChange={(v) => updateSetting('fontSize', Number(v))}
          items={fontSizeItems}
        >
          <SelectTrigger id="setting-font-size" class="w-32">
            <SelectValue placeholder="选择字号" />
          </SelectTrigger>
          <SelectContent>
            {#each fontSizeItems as item (item.value)}
              <SelectItem value={item.value} label={item.label}>{item.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-tab-size" class="text-sm font-normal">制表符宽度</Label>
        <Select
          type="single"
          value={String(settings.tabSize)}
          onValueChange={(v) => updateSetting('tabSize', Number(v))}
          items={tabSizeItems}
        >
          <SelectTrigger id="setting-tab-size" class="w-32">
            <SelectValue placeholder="选择宽度" />
          </SelectTrigger>
          <SelectContent>
            {#each tabSizeItems as item (item.value)}
              <SelectItem value={item.value} label={item.label}>{item.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>

      <!--
        这里刻意**不提供**「默认编码」选项。
        新建文件固定按 UTF-8 保存，打开文件按原编码写回——
        一个能改的默认值只会让人以为它能影响打开行为，实际不能。
      -->

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-wrap" class="text-sm font-normal">自动换行</Label>
        <Switch
          id="setting-wrap"
          checked={settings.wordWrap}
          onCheckedChange={(v) => updateSetting('wordWrap', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-linenumbers" class="text-sm font-normal">显示行号</Label>
        <Switch
          id="setting-linenumbers"
          checked={settings.showLineNumbers}
          onCheckedChange={(v) => updateSetting('showLineNumbers', v)}
        />
      </div>

      <Separator />

      <!-- 行为 -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-autosave" class="text-sm font-normal">自动保存</Label>
          <span class="text-[11px] text-content-faint">停止输入后自动写入磁盘</span>
        </div>
        <Switch
          id="setting-autosave"
          checked={settings.autoSave}
          onCheckedChange={changeAutoSave}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-hibernate" class="text-sm font-normal">后台休眠</Label>
          <span class="text-[11px] text-content-faint">长时间未用的大文件释放内存</span>
        </div>
        <Switch
          id="setting-hibernate"
          checked={settings.hibernateEnabled}
          onCheckedChange={(v) => updateSetting('hibernateEnabled', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-restore" class="text-sm font-normal">恢复上次会话</Label>
          <span class="text-[11px] text-content-faint">启动时重新打开上次的文件</span>
        </div>
        <Switch
          id="setting-restore"
          checked={settings.restoreSession}
          onCheckedChange={(v) => updateSetting('restoreSession', v)}
        />
      </div>
    </div>

    <DialogFooter class="flex-row justify-between sm:justify-between">
      <Button variant="ghost" size="sm" class="gap-1.5 text-content-muted" onclick={handleReset}>
        <RotateCcw class="size-3.5" />
        恢复默认
      </Button>
      <Button size="sm" onclick={() => onOpenChange(false)}>完成</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
