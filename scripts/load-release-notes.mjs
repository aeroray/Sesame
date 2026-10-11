// 读取本次发布对应的更新说明，作为 workflow 的 step output 传给 tauri-action。
//
// ## 为什么说明放在 docs/releases/<tag>.md 而不是写进 workflow
//
// 写在 workflow 里的话，每次发布都要手改那一段；漏改一次，新版本就会
// 带上**上一个版本**的说明，而流水线没有任何办法发现这件事
// （它看起来完全正常）。放成按标签命名的文件后，漏写会直接报错。
//
// ## 为什么用 Node 而不是 bash heredoc
//
// 矩阵里包含 windows-latest，那里的 `$GITHUB_OUTPUT` 是 Windows 路径，
// shell heredoc 是最容易出问题的一环。Node 写文件在各平台行为一致。
import { appendFile, readFile } from 'node:fs/promises';

const rawTag = process.argv[2] || process.env.GITHUB_REF_NAME;
const tag = rawTag?.startsWith('v') ? rawTag : `v${rawTag ?? ''}`;

if (!tag || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag)) {
  throw new Error(`发布标签必须是 v 开头的 SemVer，收到：${rawTag || '<空>'}`);
}

const notesPath = `docs/releases/${tag}.md`;

let body;
try {
  body = await readFile(notesPath, 'utf8');
} catch {
  throw new Error(
    `找不到 ${notesPath}。打标签之前先写好这一版的更新说明，否则 Release 会没有正文。`,
  );
}

if (!body.trim()) {
  throw new Error(`${notesPath} 是空的。`);
}

/*
 * 分隔符不能出现在正文里，否则 `$GITHUB_OUTPUT` 会在那一行被截断，
 * 发布出去的说明只剩前半截。
 */
const delimiter = 'RELEASE_NOTES_EOF';
if (body.includes(delimiter)) {
  throw new Error(`${notesPath} 不能包含输出分隔符 ${delimiter}。`);
}

const outputPath = process.env.GITHUB_OUTPUT;
if (!outputPath) {
  // 本地运行时没有这个变量，直接把内容打出来当作校验
  console.log(body);
  console.error(`\n（未设置 GITHUB_OUTPUT，改为打印 ${notesPath} 内容。）`);
  process.exit(0);
}

// 正文与结束分隔符之间必须有换行，否则最后一行会被吞掉；
// 而正文通常已经以换行结尾，归一化一下免得给发布的说明多加一个空行。
const normalized = body.endsWith('\n') ? body : `${body}\n`;
await appendFile(outputPath, `body<<${delimiter}\n${normalized}${delimiter}\n`, 'utf8');

console.log(`已从 ${notesPath} 读取更新说明（${Buffer.byteLength(body, 'utf8')} 字节）。`);
