// 版本号统一管理。
//
// ## 唯一来源：package.json
//
// 版本号只写在 `package.json` 的 `version` 一个地方，其余两处都从它派生：
//
// - **`src-tauri/tauri.conf.json`** 写的是 `"version": "../package.json"`，
//   由 Tauri 自己去读那个文件。这是 Tauri 官方支持的写法（配置 schema 的
//   描述原文："It is a semver version number or a path to a `package.json`
//   file containing the `version` field"），因此那一处**不需要同步**。
//
// - **`src-tauri/Cargo.toml`** 必须与之一致，但 Cargo 不支持从外部文件读
//   版本，所以由本脚本写入。这一步已经在 `prebuild` / `predev` 钩子里
//   自动执行，正常流程下不需要手动调用。
//
// ## 为什么还要一个 check 模式
//
// 自动同步覆盖不到两种情况：
//   1. 直接跑 `cargo build`（绕过了 pnpm 钩子）
//   2. CI 用标签发布时，需要确认标签、package.json、Cargo.toml 三者一致
//
// 因此 check 模式存在，并且**只读不写**——CI 里不该产生未提交的改动，
// 否则「构建产物对应哪个提交」就说不清了。不一致时直接报错退出，
// 而不是悄悄改掉：那种情况说明有人绕过了正常流程，需要人看一眼。
//
// 用法：
//   node scripts/version.mjs              # 同步：把 package.json 的版本写进 Cargo.toml
//   node scripts/version.mjs --check      # 校验：三处版本是否一致
//   node scripts/version.mjs v1.0.0       # 校验：标签是否也是这个版本
import { readFile, writeFile } from 'node:fs/promises';

const PACKAGE_PATH = 'package.json';
const CARGO_PATH = 'src-tauri/Cargo.toml';
const TAURI_CONF_PATH = 'src-tauri/tauri.conf.json';

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

/*
 * 正则锚定在 `^\[package\]` 之后的第一个 version。
 *
 * 不能只匹配 `version = "..."`：Cargo.toml 的 `[dependencies]` 下面
 * 还有十几个依赖各自的版本号，不加锚点会改错行（把某个依赖的版本
 * 改成应用版本，构建直接失败，且报错信息与真正原因无关）。
 */
const CARGO_PACKAGE_VERSION = /(^\[package\][\s\S]*?^version\s*=\s*")([^"]+)("\s*$)/m;

/** 读取唯一来源里的版本。 */
async function readVersion() {
  const pkg = JSON.parse(await readFile(PACKAGE_PATH, 'utf8'));
  const version = pkg.version;
  if (!version || !SEMVER.test(version)) {
    throw new Error(`${PACKAGE_PATH} 里的版本号不是合法 SemVer：${version || '<空>'}`);
  }
  return version;
}

/** 读取 Cargo.toml 的包版本。 */
async function readCargoVersion() {
  const cargo = await readFile(CARGO_PATH, 'utf8');
  const found = cargo.match(CARGO_PACKAGE_VERSION);
  if (!found) throw new Error(`在 ${CARGO_PATH} 里找不到 [package] 的 version 字段。`);
  return { cargo, version: found[2] };
}

/** 读取 tauri.conf.json 的 version 字段，确认它指向 package.json 而不是写死。 */
async function assertTauriConfDerives() {
  const conf = JSON.parse(await readFile(TAURI_CONF_PATH, 'utf8'));
  const value = conf.version;
  /*
   * 这一条是防回归的关键：如果有人「顺手」把这里改回字面量版本号，
   * 就又变回了三处各写一份，而那种重复正是本脚本要消除的东西。
   * 因此这里不是警告，而是直接失败。
   */
  if (value !== '../package.json') {
    throw new Error(
      `${TAURI_CONF_PATH} 的 version 应为 "../package.json"（由 Tauri 读取），` +
        `实际是 ${JSON.stringify(value)}。不要在这里写死版本号。`,
    );
  }
}

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const tagArg = args.find((a) => !a.startsWith('--'));
const version = await readVersion();

await assertTauriConfDerives();

if (checkOnly || tagArg !== undefined) {
  // ---- 校验模式：只读，不改任何文件 ----
  const tag = tagArg?.replace(/^v/, '');
  if (tag !== undefined) {
    if (!SEMVER.test(tag)) {
      throw new Error(`发布标签不是合法 SemVer：${tagArg}`);
    }
    if (version !== tag) {
      throw new Error(
        `${PACKAGE_PATH} 的版本是 ${version}，与标签 ${tag} 不一致。\n` +
          `请先把 ${PACKAGE_PATH} 的版本改成 ${tag}，再提交并打标签。`,
      );
    }
  }

  const cargo = await readCargoVersion();
  if (cargo.version !== version) {
    throw new Error(
      `${CARGO_PATH} 的版本是 ${cargo.version}，与 ${PACKAGE_PATH} 的 ${version} 不一致。\n` +
        `请运行 pnpm sync:version 同步后提交。`,
    );
  }

  console.log(`版本校验通过：${version}` + (tag ? `（标签 ${tagArg}）` : '') + '，三处一致。');
} else {
  // ---- 同步模式：把唯一来源写进 Cargo.toml ----
  const { cargo, version: cargoVersion } = await readCargoVersion();
  if (cargoVersion === version) {
    console.log(`${CARGO_PATH} 已是 ${version}，无需改动。`);
  } else {
    const next = cargo.replace(
      CARGO_PACKAGE_VERSION,
      (_, prefix, _old, suffix) => `${prefix}${version}${suffix}`,
    );
    await writeFile(CARGO_PATH, next, 'utf8');
    console.log(`已把 ${CARGO_PATH} 从 ${cargoVersion} 同步为 ${version}。`);
  }
}
