<script lang="ts">
/**
 * 设置面板。
 */
import { Check, RotateCcw } from '@lucide/svelte';
import { cancelAllAutoSave } from '$lib/actions/autosave';
import FontPicker from '$lib/components/common/FontPicker.svelte';
import ThemeThumbnail from '$lib/components/common/ThemeThumbnail.svelte';
import { Button } from '$lib/components/ui/button';
import {
  Content as DialogContent,
  Description as DialogDescription,
  Footer as DialogFooter,
  Header as DialogHeader,
  Root as DialogRoot,
  Title as DialogTitle,
} from '$lib/components/ui/dialog';
import { Label } from '$lib/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '$lib/components/ui/select';
import { Separator } from '$lib/components/ui/separator';
import { Switch } from '$lib/components/ui/switch';
import { type MessageKey, t } from '$lib/i18n';
import { resetSettings, settings, updateSetting } from '$lib/state/settings.svelte';
import type { LanguageSetting } from '$lib/state/types';
import { THEMES } from '$lib/theme/palettes';
import { cn } from '$lib/utils/cn';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '$src/constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

/**
 * 主题按亮暗分组。
 *
 * 13 套平铺会让列表很长且难找；分组后「想要亮一点的」能直接定位。
 */
const lightThemes = $derived(THEMES.filter((item) => item.mode === 'light'));
const darkThemes = $derived(THEMES.filter((item) => item.mode === 'dark'));

/** 语言选项。`system` 表示跟随系统。 */
const languages: { value: LanguageSetting; label: MessageKey }[] = [
  { value: 'system', label: 'settings.languageSystem' },
  { value: 'zh-CN', label: 'locale.zh-CN' },
  { value: 'en', label: 'locale.en' },
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

/**
 * 切换界面语言。`applyLanguage()` 由 `updateSetting` 内部调用。
 */
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
}
</script>

<DialogRoot bind:open>
  <!--
    对话框整体限高并让**内容区**滚动，而不是让整个对话框溢出窗口。

    默认的 `dialog-content` 是 `grid` 且没有高度上限。设置项本来就不多，
    所以一直没暴露问题；加了 13 套主题的预览列表之后，内容高度超过窗口，
    底部的「恢复默认」按钮直接被切在窗口外（实测如此）——用户够不到。

    `max-h-[85vh]` 留出上下边距，`grid-rows-[auto_minmax(0,1fr)_auto]`
    让头部与底部按内容高度、中间区吸收剩余空间。
    `minmax(0,1fr)` 里的 `0` 很关键：不写的话 grid 子项的最小高度是内容高度，
    滚动区会被内容撑开、`overflow` 失效。
  -->
  <DialogContent class="max-w-lg max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]">
    <DialogHeader>
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogDescription>{t('settings.description')}</DialogDescription>
    </DialogHeader>

    <div class="flex min-h-0 flex-col gap-4 overflow-y-auto py-2 pr-1">
      <!--
        主题（皮肤）。
        一套主题同时决定界面配色与编辑器配色（含语法高亮），
        因此只有一个控件，不再拆成「亮暗 + 强调色」。

        用**列表 + 缩略图**而不是下拉框：13 套主题若只显示名字，
        用户看不出「Dracula 和 Monokai 差在哪」；缩略图一次展示多套，
        扫一眼就能比较。分组标题让「想要亮一点的」这类需求能直接定位。
      -->
      <div class="flex flex-col gap-2">
        <Label class="text-sm font-normal">{t('settings.theme')}</Label>

        <!--
          固定高度 + 滚动：13 套主题全铺开会把对话框撑得过高。
          `max-h-80` 约能露出 5 套，其余滚动，既给了充分的预览空间，
          又不至于让「设置」这个动作变成翻长列表。
        -->
        <div
          class="flex max-h-80 flex-col gap-0.5 overflow-y-auto rounded-lg border border-border-subtle p-1"
          role="radiogroup"
          aria-label={t('settings.theme')}
        >
          {#each [lightThemes, darkThemes] as group, gi (gi)}
            <div
              class="px-2 py-1 text-[11px] text-content-faint {gi > 0
                ? 'mt-1 border-t border-border-subtle pt-2'
                : ''}"
            >
              {gi === 0 ? t('settings.themeLight') : t('settings.themeDark')}
            </div>

            {#each group as item (item.id)}
              <button
                type="button"
                role="radio"
                aria-checked={settings.theme === item.id}
                class={cn(
                  'flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
                  settings.theme === item.id
                    ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
                    : 'hover:bg-secondary',
                )}
                onclick={() => updateSetting('theme', item.id)}
              >
                <ThemeThumbnail theme={item} />
                <span class="min-w-0 flex-1 truncate text-sm font-normal">{item.name}</span>
                {#if settings.theme === item.id}
                  <Check class="size-3.5 shrink-0" />
                {/if}
              </button>
            {/each}
          {/each}
        </div>
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
          <SelectTrigger id="setting-language" class="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {#each languages as item (item.value)}
              <SelectItem value={item.value} label={t(item.label)}>{t(item.label)}</SelectItem>
            {/each}
          </SelectContent>
        </Select>
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
