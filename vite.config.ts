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

  /*
   * 只把 `VITE_` 前缀的变量暴露给前端。
   *
   * 早先这里还带了 `TAURI_`，理由是「前端要读 TAURI_ 变量」——实际上前端
   * 一个都没读，需要 `TAURI_DEV_HOST` 的是本配置文件自己（走 `process.env`）。
   * 而 `TAURI_` 前缀会顺带把 `TAURI_SIGNING_PRIVATE_KEY` 之类**构建期密钥**
   * 变成 `import.meta.env` 的候选成员：只要将来有人在代码里写一次
   * `const env = import.meta.env`（诊断日志、版本展示都可能这么写），
   * 签名私钥就会被打进发行包——等于把更新通道的钥匙随安装包一起发出去，
   * 而代码审查里几乎看不出来。
   *
   * 收紧到 `VITE_` 之后，这类变量在构建期就不存在，写错也读不到。
   */
  envPrefix: ['VITE_'],

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
