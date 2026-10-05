<script lang="ts">
/**
 * 设置面板。
 */
import { RotateCcw } from '@lucide/svelte';
import { cancelAllAutoSave } from '$lib/actions/autosave';
import FontPicker from '$lib/components/common/FontPicker.svelte';
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
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '$src/constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

let { open = $bindable(), onOpenChange }: Props = $props();

/**
 * 主题选项。
 *
 * 主题是**完整配色方案**（界面 + 编辑器 + 语法高亮），不再拆成
 * 「亮暗开关 + 强调色」两个控件。主题名是专有名词（Dracula 等），
 * 因此直接取主题数据里的 `name`，不走 i18n 字典。
 */
const themeItems = THEMES.map((item) => ({ value: item.id, label: item.name }));

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
  <DialogContent class="max-w-md">
    <DialogHeader>
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogDescription>{t('settings.description')}</DialogDescription>
    </DialogHeader>

    <div class="flex flex-col gap-4 py-2">
      <!--
        主题（皮肤）。
        一套主题同时决定界面配色与编辑器配色（含语法高亮），
        因此只有一个控件，不再拆成「亮暗 + 强调色」。
      -->
      <div class="flex items-center justify-between gap-4">
        <Label for="setting-theme" class="text-sm font-normal">{t('settings.theme')}</Label>
        <Select
          type="single"
          value={settings.theme}
          onValueChange={(value) => updateSetting('theme', value)}
          items={themeItems}
        >
          <SelectTrigger id="setting-theme" class="w-44">
            <SelectValue placeholder={t('settings.themePlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {#each THEMES as item (item.id)}
              <SelectItem value={item.id} label={item.name}>
                <span class="flex items-center gap-2">
                  <!-- 配色预览：左半背景、右半强调色 -->
                  <span
                    class="flex size-3.5 shrink-0 overflow-hidden rounded-sm ring-1 ring-border-subtle"
                    aria-hidden="true"
                  >
                    <span class="h-full w-1/2" style="background-color: {item.bg}"></span>
                    <span class="h-full w-1/2" style="background-color: {item.accent}"></span>
                  </span>
                  <span>{item.name}</span>
                </span>
              </SelectItem>
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
