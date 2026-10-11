// 校验发布标签与仓库里的版本号一致，并同步 Cargo.toml。
//
// 与 SkillSage 的做法一致：这个脚本**在 CI 里只做校验、不改文件**，
// 本地才写入 Cargo.toml。理由是不该让发布流程产生未提交的改动——
// 那会让「构建产物对应哪个提交」变得说不清。
//
// 用法：
//   node scripts/sync-version.mjs            # 本地：把 package.json 的版本写进 Cargo.toml
//   node scripts/sync-version.mjs v0.1.0     # CI：校验标签与两处版本号是否一致
import { readFile, writeFile } from 'node:fs/promises';

const CARGO_PATH = 'src-tauri/Cargo.toml';
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/*
 * 正则锚定在 `^\[package\]` 之后的第一个 version。
 *
 * 不能只匹配 `version = "..."`：Cargo.toml 里 `[dependencies]` 下面
 * 还有十几个依赖各自的版本号，不加锚点会改错行（把某个依赖的版本
 * 改成应用版本，构建直接失败且报错信息与真正原因无关）。
 */
const PACKAGE_VERSION = /(^\[package\][\s\S]*?^version\s*=\s*")([^"]+)("\s*$)/m;

const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const version = pkg.version;

if (!version || !SEMVER.test(version)) {
  throw new Error(`package.json 里的版本号不是合法 SemVer：${version || '<空>'}`);
}

const tag = process.argv[2]?.replace(/^v/, '');

/*
 * 传了标签就是 CI 模式：只校验，不写文件。
 *
 * 版本号必须与标签一致，因为安装包的版本、更新清单里的版本都取自
 * `package.json`；标签与它不符会发布出「叫做 v1.2.0 但内部是 1.1.0」
 * 的包，而自动更新会因此永远认为「已是最新」，用户再也收不到更新。
 */
if (tag !== undefined) {
  if (!SEMVER.test(tag)) {
    throw new Error(`发布标签不是合法 SemVer：${process.argv[2] || '<空>'}`);
  }
  if (version !== tag) {
    throw new Error(
      `package.json 的版本是 ${version}，与标签 ${tag} 不一致。\n` +
        `请先把 package.json 的版本改成 ${tag}，运行 pnpm sync:version，再提交并打标签。`,
    );
  }

  const cargo = await readFile(CARGO_PATH, 'utf8');
  const cargoVersion = cargo.match(PACKAGE_VERSION)?.[2];
  if (cargoVersion !== version) {
    throw new Error(
      `${CARGO_PATH} 的版本是 ${cargoVersion || '<缺失>'}，与 package.json 的 ${version} 不一致。\n` +
        `请在本地运行 pnpm sync:version 并提交。`,
    );
  }

  console.log(`版本校验通过：${version}`);
} else {
  // 本地模式：把 package.json 的版本同步进 Cargo.toml
  const cargo = await readFile(CARGO_PATH, 'utf8');
  if (!PACKAGE_VERSION.test(cargo)) {
    throw new Error(`在 ${CARGO_PATH} 里找不到 [package] 的 version 字段。`);
  }

  const next = cargo.replace(
    PACKAGE_VERSION,
    (_, prefix, _old, suffix) => `${prefix}${version}${suffix}`,
  );
  if (next === cargo) {
    console.log(`${CARGO_PATH} 的版本已经是 ${version}，无需改动。`);
  } else {
    await writeFile(CARGO_PATH, next, 'utf8');
    console.log(`已把 ${CARGO_PATH} 的版本同步为 ${version}。`);
  }
}
