/**
 * 系统字体列表。
 *
 * 枚举是 IO 密集操作（要扫描系统字体目录），首次可能耗时数百毫秒，
 * 因此这里做三件事：加载态、一次性缓存、失败降级。
 */

import * as ipc from '$lib/ipc/fs';
import type { FontFamily } from '$lib/state/types';

/** 响应式状态。 */
export const fontList = $state<{
  /** 全部字体，按名称排序。 */
  all: FontFamily[];
  loading: boolean;
  /** 加载失败时的原因；成功时为 null。 */
  error: string | null;
  /** 是否已尝试过加载，避免重复请求。 */
  loaded: boolean;
}>({
  all: [],
  loading: false,
  error: null,
  loaded: false,
});

/**
 * 确保字体列表已加载。
 *
 * 并发调用只会真正请求一次；已加载过则直接返回。
 */
export async function ensureFonts(): Promise<void> {
  if (fontList.loaded || fontList.loading) return;

  fontList.loading = true;
  fontList.error = null;

  try {
    fontList.all = await ipc.listFonts();
    fontList.loaded = true;
  } catch (err) {
    // 枚举失败不该让设置面板不可用：降级为「只有默认字体可选」
    fontList.error = err instanceof Error ? err.message : '无法读取系统字体';
    fontList.all = [];
  } finally {
    fontList.loading = false;
  }
}

/** 按名称过滤。空查询返回全部。 */
export function filterFonts(query: string): FontFamily[] {
  const q = query.trim().toLowerCase();
  if (!q) return fontList.all;
  return fontList.all.filter((f) => f.name.toLowerCase().includes(q));
}
