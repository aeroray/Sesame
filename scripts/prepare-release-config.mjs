// 在 CI 里生成发布用的 Tauri 覆写配置，注入当前仓库的更新源地址。
//
// ## 为什么要从环境变量推导，而不是写死在 tauri.conf.json
//
// 写死的话，仓库改名、换 owner、或者别人 fork 之后，
// 更新源仍指向原作者——fork 出来的版本会去检查**上游**的更新，
// 装上一个与自己代码无关的包。从 `GITHUB_REPOSITORY` 推导，
// 任何 fork 都自动指向自己的 Release。
//
// ## 为什么写成独立文件而不是改 tauri.conf.json
//
// 覆写文件由 `tauri build --config` 合并进来，仓库里的那份保持原样。
// 这样本地构建不受影响，也不会把 CI 生成的路径提交进仓库。
import { mkdir, writeFile } from 'node:fs/promises';

const OUTPUT = '.github/tauri-release.conf.json';

const repository = process.env.GITHUB_REPOSITORY;
const serverUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';

if (!repository || !/^[^/]+\/[^/]+$/.test(repository)) {
  throw new Error('GITHUB_REPOSITORY 必须是 owner/repository 的形式。');
}

/*
 * `releases/latest/download/` 是 GitHub 的**固定跳转地址**，
 * 始终指向最新一个已发布（非 draft、非 prerelease）的 Release。
 *
 * 不用 `releases/download/<tag>/`：那要求客户端知道版本号，
 * 而检查更新的前提正是「还不知道有没有新版本」。
 */
const endpoint = `${serverUrl}/${repository}/releases/latest/download/latest.json`;

await mkdir('.github', { recursive: true });
await writeFile(
  OUTPUT,
  `${JSON.stringify({ plugins: { updater: { endpoints: [endpoint] } } }, null, 2)}\n`,
  'utf8',
);

console.log(`更新源已指向 ${endpoint}`);
