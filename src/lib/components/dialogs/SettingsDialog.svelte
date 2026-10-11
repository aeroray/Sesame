<script lang="ts">
/**
 * 设置面板。
 *
 * ## 左侧分类 + 右侧内容
 *
 * 设置项已有十几条，一路平铺下来既长又难找，而且会撑高对话框
 * （实测溢出过窗口，底部按钮够不到）。
 *
 * 改成「左侧分类 Tab + 右侧内容」之后：
 *
 * - 每屏只呈现一类，找某项不用通读全文
 * - 高度可控：内容区自己滚动，对话框不再随设置项数量增长
 * - 分类有图标，扫一眼就知道该点哪个
 *
 * ## 为什么不用现成的 Tabs 组件
 *
 * shadcn 的 `Tabs` 是**水平**标签栏，而我们要的是「左侧竖排列表 +
 * 右侧面板」这种设置页惯用的形态。用 `Tabs` 再强行掰成竖排，
 * 反倒要覆盖它一堆默认样式。这里用简单的 `$state` + 条件渲染，
 * 行为更直白，也没有额外的可访问性坑（`role="tablist"` 该有的
 * aria 属性都手写了）。
 */
import { Check, Code2, Info, Keyboard, Palette, RotateCcw, Save, Settings2 } from '@lucide/svelte';
import { getVersion } from '@tauri-apps/api/app';
import { cancelAllAutoSave } from '$lib/actions/autosave';
import AppLogo from '$lib/components/common/AppLogo.svelte';
import FontPicker from '$lib/components/common/FontPicker.svelte';
import ShortcutsList from '$lib/components/common/ShortcutsList.svelte';
import ThemeThumbnail from '$lib/components/common/ThemeThumbnail.svelte';
import UpdatePanel from '$lib/components/common/UpdatePanel.svelte';
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
import { Switch } from '$lib/components/ui/switch';
import { type MessageKey, t } from '$lib/i18n';
import { resetSettings, settings, updateSetting } from '$lib/state/settings.svelte';
import type { LanguageSetting } from '$lib/state/types';
import { THEMES } from '$lib/theme/palettes';
import { cn } from '$lib/utils/cn';
import { IS_MAC, IS_WINDOWS } from '$lib/utils/platform';
import { FONT_SIZE_MAX, FONT_SIZE_MIN } from '$src/constants';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 打开时直接落到哪个分类。不传则保持上次的分类。 */
  initialTab?: 'appearance' | 'editor' | 'files' | 'general' | 'shortcuts' | 'about';
}

let { open = $bindable(), onOpenChange, initialTab }: Props = $props();

/** 当前分类。 */
let tab = $state<'appearance' | 'editor' | 'files' | 'general' | 'shortcuts' | 'about'>(
  'appearance',
);

/*
 * 外部指定了初始分类时跟随它。
 *
 * 只在 `open` 变为 true 的那一刻生效——不能写成无条件同步，
 * 否则用户在面板里点别的分类会被立刻弹回去。
 */
$effect(() => {
  if (open && initialTab) tab = initialTab;
});

/**
 * 分类定义。
 *
 * 图标与文案都放在这里，渲染时循环——新增一个分类只需加一行，
 * 不必再改三处（按钮、面板、标题）。
 */
const TABS: { id: typeof tab; label: MessageKey; icon: typeof Palette }[] = [
  { id: 'appearance', label: 'settings.groupAppearance', icon: Palette },
  { id: 'editor', label: 'settings.groupEditor', icon: Code2 },
  { id: 'files', label: 'settings.groupFiles', icon: Save },
  { id: 'general', label: 'settings.groupSystem', icon: Settings2 },
  { id: 'shortcuts', label: 'settings.groupShortcuts', icon: Keyboard },
  { id: 'about', label: 'settings.groupAbout', icon: Info },
];

/** 主题按亮暗分组。 */
const lightThemes = $derived(THEMES.filter((item) => item.mode === 'light'));
const darkThemes = $derived(THEMES.filter((item) => item.mode === 'dark'));

/**
 * 版本号。
 *
 * **从 Tauri 读取，不写死在界面里。** 早先汉堡菜单里硬编码了
 * "Sesame 0.1.0"，而 `package.json`、`Cargo.toml`、`tauri.conf.json`
 * 各有一份版本号——第四份手写副本迟早与实际版本不一致。
 *
 * 读不到时留空而不是显示占位符：`getVersion` 只在 Tauri 运行时可用，
 * 浏览器里跑（如样式验证）会抛错，那时显示 "v" 比显示假的版本号好。
 */
let version = $state('');

$effect(() => {
  if (!open || version) return;
  getVersion()
    .then((v) => (version = v))
    .catch(() => {
      // 非 Tauri 环境：保持空字符串
    });
});

/** 平台名，用于「关于」。 */
const platformName = IS_MAC ? 'macOS' : IS_WINDOWS ? 'Windows' : 'Unknown';

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

/*
 * 每个 Select 都必须传 `items`。
 *
 * bits-ui 在菜单未打开时无法从 DOM 读取选项文字，
 * 只会回退到显示原始 value（于是出现 `system` 这种英文值）。
 * 传入 items 后，关闭状态下也能显示对应语言的标签。
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
    label: t('settings.tabSizeValue', { size, count: size }),
  })),
);

const languageItems = $derived(
  languages.map((item) => ({ value: item.value, label: t(item.label) })),
);

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
}

function moveChoice(event: KeyboardEvent, selector: string) {
  if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key))
    return;
  const current = event.currentTarget as HTMLElement;
  const choices = [
    ...(current.parentElement
      ?.closest('[role="tablist"], [role="radiogroup"]')
      ?.querySelectorAll<HTMLButtonElement>(selector) ?? []),
  ];
  if (!choices.length) return;
  const index = choices.indexOf(current as HTMLButtonElement);
  const next =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? choices.length - 1
        : (index +
            (event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1) +
            choices.length) %
          choices.length;
  event.preventDefault();
  choices[next]?.focus();
  choices[next]?.click();
}
</script>

<DialogRoot bind:open>
  <!--
    对话框宽度从 `max-w-lg` 提到 `max-w-3xl`：左侧多了分类栏，
    右侧还要放得下主题缩略图列表。

    高度用 `max-h-[85vh]` 限制并让**内容区**滚动，而不是让整个对话框
    溢出窗口。默认的 `dialog-content` 是 `grid` 且没有高度上限——
    设置项一多就会把底部按钮顶到窗口外（实测如此，用户够不到）。
    `grid-rows-[auto_minmax(0,1fr)_auto]` 让头部与底部按内容高度、
    中间区吸收剩余空间；`minmax(0,1fr)` 里的 `0` 很关键，
    不写的话 grid 子项的最小高度是内容高度，`overflow` 会失效。
  -->
  <!--
    宽度：必须用 `sm:` 前缀。`dialog-content` 默认带 `sm:max-w-sm`，
    而 `sm:` 变体在 CSS 里排在无前缀规则之后，只写 `max-w-3xl` 会被它覆盖。

    高度：用**固定值** `h-[34rem]` 而不是 `max-h-*`。
    用 max-h 时对话框高度会随内容增减——切到「外观」有 13 套主题的
    预览列表就高，切到「通用」只有一项就矮，每切一次整个窗口跳一下
    （用户反馈的「抖动」）。固定高度后内容多少都不影响外框。

    配合 `grid-rows-[auto_minmax(0,1fr)_auto]`：头部与底部按内容高度，
    中间区吸收剩余空间并自己滚动。`minmax(0,1fr)` 里的 `0` 很关键，
    不写的话 grid 子项最小高度是内容高度，`overflow` 会失效。

    `h-[34rem]` 约 544px：在 700px 高的窗口里留有充足边距，
    又能同时容纳主题列表与底部按钮。
  -->
  <DialogContent
    class="sm:max-w-3xl h-[34rem] max-h-[85vh] grid-rows-[auto_minmax(0,1fr)_auto]"
  >
    <DialogHeader>
      <DialogTitle>{t('settings.title')}</DialogTitle>
      <DialogDescription>{t('settings.description')}</DialogDescription>
    </DialogHeader>

    <!-- 左分类 / 右内容 -->
    <div class="flex min-h-0 min-w-0 gap-4">
      <!--
        分类栏。`role="tablist"` + `aria-selected` 是手写的：
        这里没用 Tabs 组件（见文件头说明），可访问性属性得自己补。
      -->
      <div
        class="flex w-36 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border-subtle pr-2"
        role="tablist"
        aria-orientation="vertical"
        aria-label={t('settings.title')}
      >
        {#each TABS as item (item.id)}
          {@const Icon = item.icon}
          <button
            type="button"
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-controls="settings-panel"
            tabindex={tab === item.id ? 0 : -1}
            aria-selected={tab === item.id}
            class={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
              tab === item.id
                ? 'bg-brand-100 font-medium text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
                : 'text-content-muted hover:bg-secondary hover:text-content',
            )}
            onclick={() => (tab = item.id)}
            onkeydown={(event) => moveChoice(event, '[role="tab"]')}
          >
            <Icon class="size-3.5 shrink-0" />
            <span class="truncate">{t(item.label)}</span>
          </button>
        {/each}
      </div>

      <!--
        内容区。只滚动这里，头部与底部固定。

        **必须同时写 `overflow-x-hidden`**：`overflow-y-auto` 只隐含
        「x 方向 visible」，而 visible 与 auto 混用时浏览器会把 x 也算成
        auto，于是内容稍微超宽就冒出横向滚动条（用户反馈过）。
        显式禁掉 x 方向才干净。
      -->
      <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-tab-${tab}`}
        class="flex min-h-0 min-w-0 flex-1 flex-col gap-3.5 overflow-y-auto overflow-x-hidden pr-1">
        {#if tab === 'appearance'}
          <!-- 主题 -->
          <div class="flex flex-col gap-2">
            <Label class="text-sm font-normal">{t('settings.theme')}</Label>
            <!--
              固定高度 + 滚动：13 套主题全铺开会把内容区撑得过高。
              用列表 + 缩略图而不是下拉框：只显示名字看不出
              「Dracula 和 Monokai 差在哪」。
            -->
            <div
              class="flex max-h-64 flex-col gap-0.5 overflow-y-auto overflow-x-hidden rounded-lg border border-border-subtle p-1"
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
                    tabindex={settings.theme === item.id ? 0 : -1}
                    class={cn(
                      'flex items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors',
                      settings.theme === item.id
                        ? 'bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100'
                        : 'hover:bg-secondary',
                    )}
                    onclick={() => updateSetting('theme', item.id)}
                    onkeydown={(event) => moveChoice(event, '[role="radio"]')}
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

          <!-- 界面字体 -->
          <div class="flex items-center justify-between gap-4">
            <Label class="text-sm font-normal">{t('settings.uiFont')}</Label>
            <FontPicker
              value={settings.uiFont}
              defaultLabel={t('settings.followSystemFont')}
              onchange={(v) => updateSetting('uiFont', v)}
            />
          </div>
        {:else if tab === 'editor'}
          <!-- 编辑器字体 -->
          <div class="flex items-center justify-between gap-4">
            <Label class="text-sm font-normal">{t('settings.editorFont')}</Label>
            <FontPicker
              value={settings.editorFont}
              defaultLabel={t('settings.followSystemFont')}
              onchange={(v) => updateSetting('editorFont', v)}
              preferMonospace
            />
          </div>

          <div class="flex items-center justify-between gap-4">
            <Label for="setting-font-size" class="text-sm font-normal"
              >{t('settings.fontSize')}</Label
            >
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
        {:else if tab === 'files'}
          <div class="flex items-center justify-between gap-4">
            <div class="flex flex-col gap-0.5">
              <Label for="setting-autosave" class="text-sm font-normal"
                >{t('settings.autoSave')}</Label
              >
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
              <Label for="setting-hibernate" class="text-sm font-normal"
                >{t('settings.hibernate')}</Label
              >
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
        {:else if tab === 'shortcuts'}
          <!--
            快捷键列表复用 `ShortcutsList`——独立的快捷键对话框用的是同一份，
            两处各写一份迟早不一致。
          -->
          <ShortcutsList scroll={false} />

        {:else if tab === 'about'}
          <!--
            关于。原先这些信息散在汉堡菜单底部（只有一行硬编码版本号），
            现在集中到这里，且版本号运行时读取。
          -->
          <div class="flex items-center gap-3">
            <AppLogo class="size-10 shrink-0" />
            <div class="flex min-w-0 flex-col gap-0.5">
              <span class="text-sm font-medium">Sesame</span>
              <span class="text-[11px] text-content-faint">
                {version ? t('settings.aboutVersion', { version }) : ''}
              </span>
            </div>
          </div>

          <p class="text-[11px] text-content-muted">{t('settings.aboutTagline')}</p>

          <dl class="flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-[11px]">
            <div class="flex items-center justify-between gap-4">
              <dt class="text-content-faint">{t('settings.aboutPlatform')}</dt>
              <dd class="text-content-muted">{platformName}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-content-faint">{t('settings.aboutEngine')}</dt>
              <dd class="text-content-muted">{t('settings.aboutEngineValue')}</dd>
            </div>
            <div class="flex items-center justify-between gap-4">
              <dt class="text-content-faint">{t('settings.aboutLicense')}</dt>
              <dd class="text-content-muted">{t('settings.aboutLicenseValue')}</dd>
            </div>
          </dl>

          <!-- 自动更新。检查在启动时静默做过一次，这里也可以手动重查。 -->
          <UpdatePanel />
        {:else}
          <div class="flex items-center justify-between gap-4">
            <Label for="setting-language" class="text-sm font-normal">{t('settings.language')}</Label>
            <Select
              type="single"
              value={settings.language}
              onValueChange={changeLanguage}
              items={languageItems}
            >
              <SelectTrigger id="setting-language" class="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {#each languageItems as item (item.value)}
                  <SelectItem value={item.value} label={item.label}>{item.label}</SelectItem>
                {/each}
              </SelectContent>
            </Select>
          </div>
        {/if}
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
