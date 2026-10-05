/**
 * 把散落的 console.error 收敛到 utils/log。
 *
 * 一次性迁移脚本，不属于应用代码。
 * 用法：node scripts/migrate-logs.mjs
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/** 文件 → scope 名。scope 用模块名，便于在日志里过滤。 */
const files = [];

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'ui' && e.name !== 'node_modules') walk(p);
    } else if (/\.(svelte|ts)$/.test(e.name)) {
      files.push(p);
    }
  }
}
walk('src');

let changed = 0;

for (const file of files) {
  // log.ts 自己内部就用 console，跳过
  if (file.endsWith('utils/log.ts')) continue;

  const src = readFileSync(file, 'utf8');
  if (!src.includes('console.error') && !src.includes('console.warn')) continue;

  // scope 取文件名（不含扩展名），例如 EditorHost / draft
  const scope = file.split(/[\\/]/).pop().replace(/\.(svelte|ts)$/, '');

  let next = src;

  // console.error('说明', err)  →  logError('scope', '说明', err)
  next = next.replace(
    /console\.error\((\s*)('[^']*'|"[^"]*"|`[^`]*`)(\s*,\s*[^)]+)?\)/g,
    (_m, _sp, msg, rest) => {
      const err = rest ? rest.replace(/^\s*,\s*/, '') : 'undefined';
      return `logError('${scope}', ${msg}, ${err})`;
    },
  );

  // console.warn('说明', detail)  →  logWarn('scope', '说明', detail)
  next = next.replace(
    /console\.warn\((\s*)('[^']*'|"[^"]*"|`[^`]*`)(\s*,\s*[^)]+)?\)/g,
    (_m, _sp, msg, rest) => {
      const detail = rest ? rest.replace(/^\s*,\s*/, '') : '';
      return detail
        ? `logWarn('${scope}', ${msg}, ${detail})`
        : `logWarn('${scope}', ${msg})`;
    },
  );

  if (next === src) continue;

  // 加 import（放在最后一条 import 之后，避免打乱顺序）
  const importLine = `import { logError, logWarn } from '$lib/utils/log';`;
  const hasLogError = next.includes('logError(');
  const hasLogWarn = next.includes('logWarn(');
  const names = [hasLogError && 'logError', hasLogWarn && 'logWarn'].filter(Boolean).join(', ');
  const line = `import { ${names} } from '$lib/utils/log';`;

  const lines = next.split('\n');
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*import\s/.test(lines[i])) lastImport = i;
  }
  if (lastImport >= 0) {
    lines.splice(lastImport + 1, 0, line);
    next = lines.join('\n');
  } else {
    // 没有 import 的文件（不太可能），插在 script 标签后
    next = next.replace(/(<script[^>]*>\n)/, `$1  ${line}\n`);
  }

  writeFileSync(file, next, 'utf8');
  changed++;
  console.log(`  ${file}  → ${names}`);
}

console.log(`\n共修改 ${changed} 个文件`);
