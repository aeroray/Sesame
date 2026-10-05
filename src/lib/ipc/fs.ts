/**
 * IPC 层：唯一与 Rust 后端通信的出口。
 *
 * 所有命令都返回结构化结果；失败时抛出 `AppError`，
 * 由调用方决定是提示还是静默处理。
 */

import { invoke } from '@tauri-apps/api/core';
import { t } from '$lib/i18n';
import type {
  AppError,
  Draft,
  FileMeta,
  FilePayload,
  FontFamily,
  ImagePayload,
  RecentEntry,
  SaveResult,
  SessionSnapshot,
  TextChunk,
} from '$lib/state/types';

/** 判断一个未知值是否为后端返回的结构化错误。 */
export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as AppError).message === 'string'
  );
}

/**
 * 统一调用入口。
 *
 * Tauri 的 `invoke` 在命令返回 `Err` 时会 reject，
 * 且 rejection 值可能是结构化错误对象，也可能是字符串。
 * 这里统一转换成 `AppError`，避免上层到处做类型判断。
 */
async function call<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (raw) {
    if (isAppError(raw)) throw raw;
    throw {
      code: 'io',
      message: typeof raw === 'string' ? raw : t('error.unknown'),
    } satisfies AppError;
  }
}

/**
 * 读取文件内容与元数据。
 *
 * `encoding` 为手动指定的编码；省略时由后端自动探测。
 * 用户可能因为探测错误而手动纠正（见 EncodingPicker）。
 */
export function openFile(path: string, encoding?: string): Promise<FilePayload> {
  return call<FilePayload>('open_file', { path, encoding: encoding ?? null });
}

/** 列出可手动指定的编码。由后端提供，避免前后端两份列表漂移。 */
export function listEncodings(): Promise<string[]> {
  return call<string[]>('list_encodings');
}

/**
 * 保存文件。
 *
 * `prefixBytes` 只在**大文件模式**下传入：它告诉后端「编辑器持有的只是文件前
 * 这么多字节」，后端会把磁盘上剩余的尾部原样追加，从而在不把整个文件读进内存的
 * 前提下完整写回。普通文件不传，内容即全文。
 */
export function saveFile(
  path: string,
  content: string,
  options?: {
    encoding?: string;
    lineEnding?: string;
    hasBom?: boolean;
    prefixBytes?: number;
    /**
     * 用户已确认「覆盖磁盘」时传 true。
     *
     * 后端默认会在写盘前复核文件指纹，发现被外部改动就拒绝写入并返回
     * `conflict` 错误；只有用户在冲突对话框里明确选择覆盖，才跳过这一步。
     */
    force?: boolean;
  },
): Promise<SaveResult> {
  return call<SaveResult>('save_file', {
    path,
    content,
    encodingLabel: options?.encoding ?? null,
    lineEnding: options?.lineEnding ?? null,
    hasBom: options?.hasBom ?? null,
    prefixBytes: options?.prefixBytes ?? null,
    force: options?.force ?? false,
  });
}

/** 读取文件元数据。 */
export function statFile(path: string): Promise<FileMeta> {
  return call<FileMeta>('stat_file', { path });
}

/**
 * 分块读取。
 *
 * `encodingLabel` 必须传入打开文件时探明的编码：非 UTF-8（如 GBK）的大文件
 * 若按 UTF-8 解码，每一块都解不出内容、偏移无法前进，加载会卡死。
 */
export function readChunk(
  path: string,
  offset: number,
  encodingLabel: string,
  length?: number,
): Promise<TextChunk> {
  return call<TextChunk>('read_chunk', {
    path,
    offset,
    length: length ?? null,
    encodingLabel,
  });
}

/** 关闭文件，清理后端状态。 */
export function closeFile(path: string): Promise<void> {
  return call<void>('close_file', { path });
}

/** 最近文件列表。 */
export function recentList(): Promise<RecentEntry[]> {
  return call<RecentEntry[]>('recent_list');
}

/** 记录一次打开。 */
export function recentAdd(path: string): Promise<RecentEntry[]> {
  return call<RecentEntry[]>('recent_add', { path });
}

/** 清空最近文件。 */
export function recentClear(): Promise<RecentEntry[]> {
  return call<RecentEntry[]>('recent_clear');
}

/** 移除单条最近文件。 */
export function recentRemove(path: string): Promise<RecentEntry[]> {
  return call<RecentEntry[]>('recent_remove', { path });
}

/**
 * 取出启动时命令行传入的文件路径。
 * 返回后后端会清空该列表，因此只需在启动时调用一次。
 */
export function takeStartupFiles(): Promise<string[]> {
  return call<string[]>('take_startup_files');
}

/** 读取图片，返回可直接用于 <img src> 的 data URL。 */
export function readImage(path: string): Promise<ImagePayload> {
  return call<ImagePayload>('read_image', { path });
}

/** 读取上次会话快照。 */
export function sessionLoad(): Promise<SessionSnapshot> {
  return call<SessionSnapshot>('session_load');
}

/** 保存会话快照。 */
export function sessionSave(snapshot: SessionSnapshot): Promise<void> {
  return call<void>('session_save', { snapshot });
}

/** 清空会话。 */
export function sessionClear(): Promise<void> {
  return call<void>('session_clear');
}

/**
 * 列出系统已安装字体。
 *
 * 首次调用会扫描系统字体目录，可能耗时数百毫秒，调用方应显示加载态。
 */
export function listFonts(): Promise<FontFamily[]> {
  return call<FontFamily[]>('list_fonts');
}

/** 写入一份草稿备份。 */
export function draftSave(draft: Draft): Promise<void> {
  return call<void>('draft_save', { draft });
}

/** 删除一份草稿。 */
export function draftDelete(id: string): Promise<void> {
  return call<void>('draft_delete', { id });
}

/** 读出全部草稿。 */
export function draftList(): Promise<Draft[]> {
  return call<Draft[]>('draft_list');
}

/** 清空全部草稿。 */
export function draftClear(): Promise<void> {
  return call<void>('draft_clear');
}
