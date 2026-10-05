/**
 * 提取源码里所有含中文的字符串字面量，用于建立 i18n 字典。
 *
 * 只做一次性盘点，不属于应用代码。
 * 用法：node scripts/extract-strings.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const out = [];

function scan(file) {
  const src = readFileSync(file, 'utf8');

  // 去掉块注释、HTML 注释，以及行注释（避免把说明文字当成界面文案）
  const stripped = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:'"`\\])\/\/.*$/, '$1'))
    .join('\n');

  // 匹配 '...' / "..." / `...` 里含中文的部分。
  // 显式排除换行，否则会跨行匹配到一大段模板文本。
  const re = /['"`]([^'"`\\\n\r]*[\u4e00-\u9fa5][^'"`\\\n\r]*)['"`]/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(stripped))) {
    const s = m[1].trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push({ file: file.replace(/\\/g, '/').replace(/^src\//, ''), text: s });
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      // ui/ 是供应商组件，不参与
      if (entry.name !== 'ui' && entry.name !== 'node_modules') walk(p);
    } else if (/\.(svelte|ts)$/.test(entry.name)) {
      scan(p);
    }
  }
}

walk('src');

console.log(`总计: ${out.length} 条唯一字符串\n`);

const byFile = {};
for (const o of out) (byFile[o.file] ??= []).push(o.text);

for (const f of Object.keys(byFile).sort()) {
  console.log(`=== ${f} (${byFile[f].length}) ===`);
  for (const s of byFile[f]) console.log(`  ${s}`);
  console.log('');
}
