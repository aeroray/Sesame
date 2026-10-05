/**
 * 应用入口。
 */

import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';

const target = document.getElementById('app');
if (!target) {
  throw new Error('找不到挂载节点 #app');
}

export default mount(App, { target });
