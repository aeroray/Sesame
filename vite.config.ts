import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte(), tailwindcss()],

  resolve: {
    alias: {
      $lib: fileURLToPath(new URL('./src/lib', import.meta.url)),
      $src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Tauri 相关配置：仅影响 `tauri dev` / `tauri build`
  // 1. 不要让 Vite 清屏，否则会盖掉 Rust 的编译错误
  clearScreen: false,
  // 2. Tauri 要求固定端口，端口被占用时直接失败而不是自动换端口
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // 3. src-tauri 由 Rust 自己监听，Vite 不必重复监听
      ignored: ['**/src-tauri/**'],
    },
  },

  // 让前端能读取 TAURI_ 前缀的环境变量
  envPrefix: ['VITE_', 'TAURI_'],

  build: {
    // WebView2 与 WKWebView 都支持 esnext
    target: 'esnext',
    // Vite 8 底层是 rolldown，默认压缩器是 oxc，无需额外依赖
    minify: true,
    sourcemap: false,
    // 语言包由动态 import 自然分块，不手工指定 manualChunks——
    // 手工分块会把所有语言包强行并进一个初始就加载的大块，反而破坏懒加载。
    chunkSizeWarningLimit: 700,
  },
});
