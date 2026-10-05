import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * 合并 Tailwind 类名。
 *
 * 使用 tailwind-merge 而非简单拼接，后写的同类工具类会正确覆盖先写的，
 * 这样组件默认样式与调用方传入的 className 不会互相打架。
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * 以下三个类型工具供 shadcn-svelte 生成的组件使用，
 * 用于描述「透传原生元素属性，同时允许调用方覆盖 ref 与 class」的 props 形态。
 * 它们是组件库的约定，不要按业务语义去改。
 */

type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

/** 互斥类型：T 与 U 只能取其一。 */
export type WithoutChild<T> = T extends { child?: unknown } ? Omit<T, 'child'> : T;

/** 去掉 `child` 与 `children` 两个 snippet 字段。 */
export type WithoutChildren<T> = T extends { children?: unknown } ? Omit<T, 'children'> : T;

/** 同时去掉 `children` 或 `child`。 */
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;

/** 透传原生元素属性，并允许显式传入 `ref`。 */
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null | undefined;
};

/** 便捷别名，供业务组件描述「一段可选内容」。 */
export type MaybeSnippet = Snippet | undefined;

/** 便捷别名，供业务组件描述「透传的原生属性」。 */
export type ElementAttrs<T extends HTMLElement = HTMLElement> = HTMLAttributes<T>;

/** 供需要「去掉某个键」的场景使用。 */
export type { Without };
