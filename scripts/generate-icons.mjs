import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const temporaryRoot = resolve(tmpdir());
const output = await mkdtemp(join(temporaryRoot, 'sesame-icons-'));

if (dirname(output) !== temporaryRoot || !basename(output).startsWith('sesame-icons-')) {
  throw new Error('Unexpected icon staging directory');
}

function generate(input, destination) {
  const generated = spawnSync(
    process.execPath,
    [join(root, 'node_modules/@tauri-apps/cli/tauri.js'), 'icon', input, '--output', destination],
    { cwd: root, encoding: 'utf8' },
  );
  if (generated.error) throw generated.error;
  if (generated.status !== 0) {
    throw new Error(generated.stderr || generated.stdout || 'Icon generation failed');
  }
}

try {
  const sourcePath = join(root, 'app-icon.png');
  generate(sourcePath, output);

  // The approved source has ~8.3% transparent padding per side. Keep that
  // canvas for macOS, but fill the Windows icon cell like other desktop apps.
  // An SVG viewport preserves the exact artwork; Tauri renders all sizes.
  const source = await readFile(sourcePath);
  const size = source.readUInt32BE(16);
  const inset = Math.round(size * 0.083);
  const extent = size - inset * 2;
  const windowsSource = join(output, 'windows-source.svg');
  const windowsOutput = join(output, 'windows');
  await writeFile(
    windowsSource,
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="${inset} ${inset} ${extent} ${extent}"><image width="${size}" height="${size}" xlink:href="data:image/png;base64,${source.toString('base64')}"/></svg>`,
  );
  generate(windowsSource, windowsOutput);

  const icons = join(root, 'src-tauri/icons');
  const publicAssets = join(root, 'public');
  await mkdir(icons, { recursive: true });
  await mkdir(publicAssets, { recursive: true });

  // Only desktop assets belong in this Windows/macOS project.
  const desktopFiles = (await readdir(output)).filter((name) => /\.(png|ico|icns)$/.test(name));
  for (const name of desktopFiles) {
    const sourceDirectory = name === 'icon.icns' ? output : windowsOutput;
    await copyFile(join(sourceDirectory, name), join(icons, name));
  }
  await copyFile(join(windowsOutput, '128x128@2x.png'), join(publicAssets, 'logo.png'));
  await copyFile(join(windowsOutput, '32x32.png'), join(publicAssets, 'favicon.png'));
  await copyFile(join(windowsOutput, 'icon.ico'), join(publicAssets, 'favicon.ico'));
  console.log(
    `Generated ${desktopFiles.length} desktop icons, app logo, and favicons from app-icon.png.`,
  );
} finally {
  // output is immutable and was verified as our private directory above.
  await rm(output, { recursive: true, force: true });
}
