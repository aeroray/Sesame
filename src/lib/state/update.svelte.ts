/**
 * 自动更新状态。
 *
 * ## 更新源与签名
 *
 * 检查地址来自 `tauri.conf.json` 的 `plugins.updater.endpoints`，
 * 发布工作流会用 `--config` 覆盖成当前仓库的 `latest.json`。
 * 安装包的 minisign 签名由 **Rust 侧**校验，前端拿不到也无法跳过——
 * 因此即使更新源被劫持，签名不符的包也装不上。
 *
 * ## 为什么不做成弹窗
 *
 * 「发现新版本」不是需要用户立刻决定的事。用模态框打断当前的编辑动作
 * 代价太大，而用户可能只是想让编辑器安静待着。
 * 因此：**启动时静默检查**，有更新就把入口点亮；
 * 具体版本号、更新说明与「立即更新」按钮放在设置 → 关于里，
 * 用户想看的时候一眼就能看到。
 *
 * 这与 `status.svelte.ts` 里记录的判断一致：
 * 只有**必须做决定**的事才值得用对话框。
 */

import { relaunch } from '@tauri-apps/plugin-process';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { t } from '$lib/i18n';
import { notify } from '$lib/state/status.svelte';
import { logError } from '$lib/utils/log';
import { IS_TAURI } from '$lib/utils/platform';

/** 更新流程的阶段。 */
export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'installing'
  | 'error';

interface UpdateState {
  phase: UpdatePhase;
  /** 可用更新的版本号（`available` 之后才有值）。 */
  version: string | null;
  /** 更新说明（Release notes），可能为空。 */
  notes: string | null;
  /** 下载进度百分比；无法计算总大小时为 `null`。 */
  progress: number | null;
  /** 出错时的提示文字。 */
  error: string | null;
  /** 启动时是否已经检查过（避免每次切到「关于」都重查）。 */
  checkedOnStartup: boolean;
}

export const update = $state<UpdateState>({
  phase: 'idle',
  version: null,
  notes: null,
  progress: null,
  error: null,
  checkedOnStartup: false,
});

/**
 * 已下载但尚未安装的更新句柄。
 *
 * **必须留着它**：`downloadAndInstall()` 是一次性调用，
 * 中途失败或用户想重试时，得能重新拿到同一个 `Update` 对象。
 * 它含资源句柄，因此不放进响应式状态，避免被深层代理。
 */
let pending: Update | null = null;

/** 是否正在下载或安装（此时不该再发起检查）。 */
function isBusy(): boolean {
  return update.phase === 'downloading' || update.phase === 'installing';
}

/**
 * 检查更新。
 *
 * @param silent 静默模式：失败不提示（启动时的后台检查用它），
 *               但成功发现新版本仍然会更新状态。
 */
export async function checkForUpdate(silent = false): Promise<void> {
  // 浏览器里没有 updater 插件，直接跳过而不是报错
  if (!IS_TAURI || update.phase === 'checking' || isBusy()) return;

  update.phase = 'checking';
  update.error = null;
  try {
    const found = await check();
    if (found) {
      pending = found;
      update.version = found.version;
      update.notes = found.body ?? null;
      update.phase = 'available';
    } else {
      pending = null;
      update.version = null;
      update.notes = null;
      update.phase = 'idle';
    }
  } catch (err) {
    /*
     * 检查失败**不算错误状态**，除非用户主动点了「检查更新」。
     *
     * 启动时的检查会因断网、公司代理、GitHub 被墙等原因失败，
     * 这些都不是用户需要处理的问题；把界面标成红色只会让人以为软件坏了。
     * 主动检查时则必须给出反馈，否则用户会以为按钮没反应。
     */
    pending = null;
    update.phase = 'idle';
    if (!silent) {
      const message = describeError(err);
      update.phase = 'error';
      update.error = message;
      notify.error(message);
    } else {
      logError('update', '启动时检查更新失败', err);
    }
  }
}

/** 启动时的后台检查：只做一次，且完全安静。 */
export async function checkForUpdateOnStartup(): Promise<void> {
  if (update.checkedOnStartup) return;
  update.checkedOnStartup = true;
  await checkForUpdate(true);
}

/**
 * 下载并安装更新，完成后重启应用。
 *
 * 进度来自插件自己的 `DownloadEvent` 回调，不经过事件总线——
 * 少一层转发，也就不需要在 Rust 侧另写命令。
 */
export async function installUpdate(): Promise<void> {
  if (!pending || isBusy()) return;

  update.phase = 'downloading';
  update.progress = 0;
  update.error = null;

  try {
    let downloaded = 0;
    let total = 0;

    await pending.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          total = event.data.contentLength ?? 0;
          break;
        case 'Progress':
          downloaded += event.data.chunkLength;
          update.progress =
            total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;
          break;
        case 'Finished':
          // 下载完成、开始安装。这一步没有进度可报
          update.phase = 'installing';
          update.progress = null;
          break;
      }
    });

    /*
     * Windows 上 `downloadAndInstall` 会自行结束进程来运行安装程序，
     * 因此这一行通常执行不到；macOS 上则需要显式重启。
     * 两条路径都保留，用户看到的都是「装完自动重开」。
     */
    await relaunch();
  } catch (err) {
    const message = describeError(err);
    update.phase = 'error';
    update.error = message;
    update.progress = null;
    logError('update', '安装更新失败', err);
    notify.error(message);
  }
}

/**
 * 把底层错误转成用户能看懂的一句话。
 *
 * 签名不符是最值得单独说明的一种：它意味着下载到的包**不是我们发布的**，
 * 直接显示插件的原始英文错误会让用户完全摸不着头脑。
 */
function describeError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (/signature|verify|minisign/i.test(raw)) return t('update.errorSignature');
  if (/network|connect|dns|timed? ?out|request/i.test(raw)) return t('update.errorNetwork');
  return t('update.errorGeneric');
}

/** 供界面判断是否有可安装的更新。 */
export function hasUpdate(): boolean {
  return update.phase === 'available' && update.version !== null;
}

/** 重置为可再次检查的状态（用户在错误后重试时用）。 */
export function resetUpdateState(): void {
  if (isBusy()) return;
  update.phase = update.version ? 'available' : 'idle';
  update.error = null;
  update.progress = null;
}
