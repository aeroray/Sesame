/**
 * 应用入口。
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { blockNativeContextMenu } from '$lib/utils/context-menu-guard';

/*
 * 先装原生右键菜单的拦截，再挂载界面。
 *
 * 顺序有意义：挂载在前的话，从挂载完成到装上监听之间有一小段窗口，
 * 那期间右键仍会弹出 WebView 的原生菜单。先装后挂就没有这个缝隙。
 */
blockNativeContextMenu();

const target = document.getElementById('app');
if (!target) {
  throw new Error('找不到挂载节点 #app');
}

export default mount(App, { target });
