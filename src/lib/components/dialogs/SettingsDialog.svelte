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
  import { t, type MessageKey } from '$lib/i18n';
  import type { AccentId, LanguageSetting } from '$lib/state/types';

  interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }

  let { open = $bindable(), onOpenChange }: Props = $props();

  /**
   * 主题选项。
   *
   * `label` 存的是**文案 key**而不是文案本身：文案在模块加载时求值一次就固定了，
   * 之后切换语言不会更新。渲染时再经 `t()` 解析，才能跟随语言变化。
   */
  const themes: { value: 'system' | 'light' | 'dark'; label: MessageKey }[] = [
    { value: 'system', label: 'menu.themeSystem' },
    { value: 'light', label: 'menu.themeLight' },
    { value: 'dark', label: 'menu.themeDark' },
  ];

  /** 语言选项。`system` 表示跟随系统。 */
  const languages: { value: LanguageSetting; label: MessageKey }[] = [
    { value: 'system', label: 'settings.languageSystem' },
    { value: 'zh-CN', label: 'locale.zh-CN' },
    { value: 'en', label: 'locale.en' },
  ];

  /**
   * 强调色选项。
   *
   * `color` 是用于展示的色块值，必须与 app.css 里对应色阶的 `--brand-500`
   * 保持一致。这是**唯一一处刻意的重复**：CSS 变量在 `[data-accent]` 作用域下，
   * 无法在读色块时动态取值，因此在这里写一份。改色阶时记得同步这里。
   */
  const ACCENTS: { id: AccentId; label: MessageKey; color: string }[] = [
    { id: 'indigo', label: 'accent.indigo', color: 'oklch(0.63 0.16 264)' },
    { id: 'pine', label: 'accent.pine', color: 'oklch(0.63 0.135 162)' },
    { id: 'rose', label: 'accent.rose', color: 'oklch(0.64 0.18 355)' },
    { id: 'amber', label: 'accent.amber', color: 'oklch(0.68 0.15 72)' },
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
   * 传入 items 后，关闭状态下也能显示对应语言的标签。
   *
   * 用 `$derived` 而不是普通常量：`t()` 读的是响应式的当前语言，
   * 放在 `$derived` 里才能在切换语言后重算；写成模块级常量会停在初始语言。
   */
  const fontSizeItems = $derived(
    fontSizes.map((size) => ({
      value: String(size),
      label: t('settings.fontSizeValue', { size }),
    })),
  );

  const tabSizeItems = $derived(
    tabSizes.map((size) => ({
      value: String(size),
      // 这条是复数文案，`t()` 依 `count` 选 one/other，因此两个都要传
      label: t('settings.tabSizeValue', { size, count: size }),
    })),
  );

  /** 切换主题时同步给 mode-watcher。 */
  async function changeTheme(value: string) {
    await updateSetting('theme', value as 'light' | 'dark' | 'system');
    setMode(value as 'light' | 'dark' | 'system');
  }

  /** 切换界面语言。`applyLanguage()` 由 `updateSetting` 内部调用。 */
  async function changeLanguage(value: string) {
    await updateSetting('language', value as LanguageSetting);
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
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogDescription>{t('settings.description')}</DialogDescription>
    </DialogHeader>

    <div class="flex flex-col gap-4 py-2">
      <!-- 外观 -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-theme" class="text-sm font-normal">{t('settings.theme')}</Label>
        <Select
          type="single"
          value={settings.theme}
          onValueChange={changeTheme}
          items={themes.map((item) => ({ value: item.value, label: t(item.label) }))}
        >
          <SelectTrigger id="setting-theme" class="w-32">
            <SelectValue placeholder={t('settings.themePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {#each themes as item (item.value)}
              <SelectItem value={item.value} label={t(item.label)}>{t(item.label)}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>

      <!-- 语言 -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-language" class="text-sm font-normal">{t('settings.language')}</Label>
        <Select
          type="single"
          value={settings.language}
          onValueChange={changeLanguage}
          items={languages.map((item) => ({ value: item.value, label: t(item.label) }))}
        >
          <SelectTrigger id="setting-language" class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {#each languages as item (item.value)}
              <SelectItem value={item.value} label={t(item.label)}>{t(item.label)}</SelectItem>
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
        <Label class="text-sm font-normal">{t('settings.accent')}</Label>
        <div class="flex items-center gap-1.5" role="radiogroup" aria-label={t('settings.accent')}>
          {#each ACCENTS as accent (accent.id)}
            <button
              type="button"
              role="radio"
              aria-checked={settings.accent === accent.id}
              aria-label={t(accent.label)}
              title={t(accent.label)}
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
        <Label class="text-sm font-normal">{t('settings.uiFont')}</Label>
        <FontPicker
          value={settings.uiFont}
          defaultLabel={t('settings.followSystemFont')}
          onchange={(v) => updateSetting('uiFont', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label class="text-sm font-normal">{t('settings.editorFont')}</Label>
        <FontPicker
          value={settings.editorFont}
          defaultLabel={t('settings.followSystemFont')}
          onchange={(v) => updateSetting('editorFont', v)}
          preferMonospace
        />
      </div>

      <Separator />

      <!-- 编辑器 -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-font-size" class="text-sm font-normal">{t('settings.fontSize')}</Label>
        <Select
          type="single"
          value={String(settings.fontSize)}
          onValueChange={(v) => updateSetting('fontSize', Number(v))}
          items={fontSizeItems}
        >
          <SelectTrigger id="setting-font-size" class="w-32">
            <SelectValue placeholder={t('settings.fontSizePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {#each fontSizeItems as item (item.value)}
              <SelectItem value={item.value} label={item.label}>{item.label}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-tab-size" class="text-sm font-normal">{t('settings.tabSize')}</Label>
        <Select
          type="single"
          value={String(settings.tabSize)}
          onValueChange={(v) => updateSetting('tabSize', Number(v))}
          items={tabSizeItems}
        >
          <SelectTrigger id="setting-tab-size" class="w-32">
            <SelectValue placeholder={t('settings.tabSizePlaceholder')} />
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
        <Label for="setting-wrap" class="text-sm font-normal">{t('settings.wordWrap')}</Label>
        <Switch
          id="setting-wrap"
          checked={settings.wordWrap}
          onCheckedChange={(v) => updateSetting('wordWrap', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-linenumbers" class="text-sm font-normal"
          >{t('settings.showLineNumbers')}</Label
        >
        <Switch
          id="setting-linenumbers"
          checked={settings.showLineNumbers}
          onCheckedChange={(v) => updateSetting('showLineNumbers', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <Label for="setting-indent-guides" class="text-sm font-normal"
          >{t('settings.showIndentGuides')}</Label
        >
        <Switch
          id="setting-indent-guides"
          checked={settings.showIndentGuides}
          onCheckedChange={(v) => updateSetting('showIndentGuides', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-rainbow" class="text-sm font-normal"
            >{t('settings.rainbowBrackets')}</Label
          >
          <span class="text-[11px] text-content-faint">{t('settings.rainbowBracketsHint')}</span>
        </div>
        <Switch
          id="setting-rainbow"
          checked={settings.rainbowBrackets}
          onCheckedChange={(v) => updateSetting('rainbowBrackets', v)}
        />
      </div>

      <Separator />

      <!-- 行为 -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-autosave" class="text-sm font-normal">{t('settings.autoSave')}</Label>
          <span class="text-[11px] text-content-faint">{t('settings.autoSaveHint')}</span>
        </div>
        <Switch
          id="setting-autosave"
          checked={settings.autoSave}
          onCheckedChange={changeAutoSave}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-hibernate" class="text-sm font-normal">{t('settings.hibernate')}</Label>
          <span class="text-[11px] text-content-faint">{t('settings.hibernateHint')}</span>
        </div>
        <Switch
          id="setting-hibernate"
          checked={settings.hibernateEnabled}
          onCheckedChange={(v) => updateSetting('hibernateEnabled', v)}
        />
      </div>

      <div class="flex items-center justify-between gap-4">
        <div class="flex flex-col gap-0.5">
          <Label for="setting-restore" class="text-sm font-normal"
            >{t('settings.restoreSession')}</Label
          >
          <span class="text-[11px] text-content-faint">{t('settings.restoreSessionHint')}</span>
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
        {t('action.reset')}
      </Button>
      <Button size="sm" onclick={() => onOpenChange(false)}>{t('action.done')}</Button>
    </DialogFooter>
  </DialogContent>
</DialogRoot>
