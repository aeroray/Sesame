/**
 * 可选编码列表。
 *
 * 列表由**后端**提供（`list_encodings` 命令），不在前端硬编码：
 * 真正能解码的编码由 Rust 侧的 `encoding_for` 决定，
 * 两边各写一份必然漂移——前端列出一个后端认不出的编码，
 * 用户选了之后会被静默回退成 UTF-8，把文件按错误编码写回去。
 */

import * as ipc from '$lib/ipc/fs';
import { logError } from '$lib/utils/log';

/** 响应式状态。 */
export const encodingList = $state<{
  all: string[];
  loading: boolean;
  loaded: boolean;
}>({
  all: [],
  loading: false,
  loaded: false,
});

/**
 * 确保列表已加载。
 *
 * 并发调用只会真正请求一次。列表是静态的，加载一次即可。
 */
export async function ensureEncodings(): Promise<void> {
  if (encodingList.loaded || encodingList.loading) return;

  encodingList.loading = true;
  try {
    encodingList.all = await ipc.listEncodings();
    encodingList.loaded = true;
  } catch (err) {
    logError('encodings', '读取编码列表失败', err);
    // 失败时给出最小可用集合，至少让用户能选 UTF-8 纠正
    encodingList.all = ['utf-8'];
  } finally {
    encodingList.loading = false;
  }
}
