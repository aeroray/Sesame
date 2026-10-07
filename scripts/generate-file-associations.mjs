import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const config = JSON.parse(await readFile(new URL('src-tauri/tauri.conf.json', root), 'utf8'));
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const product = config.productName;
const binary = config.mainBinaryName ?? pkg.name;
const capabilityKey = `Software\\${product}\\Capabilities`;
const entries = config.bundle.fileAssociations.flatMap((association) =>
  association.ext.map((extension) => ({
    extension,
    progId: `${product}.${extension}`,
    description: association.description ?? association.name,
  })),
);
if (!/^[A-Za-z0-9_-]+$/.test(product) || !/^[A-Za-z0-9_-]+$/.test(binary)) {
  throw new Error('Application names must be safe registry identifiers');
}
for (const { extension } of entries) {
  if (!/^[a-z0-9]+$/i.test(extension)) throw new Error('Invalid file association extension');
}

const quote = (value) => `"${value.replaceAll('$', () => '$$').replaceAll('"', '$\\"')}"`;
const registry = (key, name, value) =>
  `  WriteRegStr SHCTX ${quote(key)} ${quote(name)} ${quote(value)}`;
const applicationKey = `Software\\Classes\\Applications\\${binary}.exe`;
const command = `$\\"$INSTDIR\\${binary}.exe$\\" $\\"%1$\\"`;
const install = [
  registry('Software\\RegisteredApplications', product, capabilityKey),
  registry(capabilityKey, 'ApplicationName', product),
  registry(capabilityKey, 'ApplicationDescription', config.bundle.shortDescription),
  '  WriteRegStr SHCTX ' +
    quote(capabilityKey) +
    ' "ApplicationIcon" "$INSTDIR\\' +
    binary +
    '.exe,0"',
  registry(applicationKey, 'FriendlyAppName', product),
  '  WriteRegStr SHCTX ' +
    quote(`${applicationKey}\\shell\\open\\command`) +
    ' "" "' +
    command +
    '"',
];
const remove = [
  `  DeleteRegValue SHCTX "Software\\RegisteredApplications" ${quote(product)}`,
  `  DeleteRegKey SHCTX ${quote(capabilityKey)}`,
  `  DeleteRegKey SHCTX ${quote(applicationKey)}`,
];
for (const { extension, progId, description } of entries) {
  const classKey = `Software\\Classes\\${progId}`;
  install.push(
    registry(classKey, '', description),
    '  WriteRegStr SHCTX ' +
      quote(`${classKey}\\DefaultIcon`) +
      ' "" "$INSTDIR\\' +
      binary +
      '.exe,0"',
    `  WriteRegStr SHCTX ${quote(`${classKey}\\shell\\open\\command`)} "" "${command}"`,
    registry(`Software\\Classes\\.${extension}\\OpenWithProgids`, progId, ''),
    registry(`${applicationKey}\\SupportedTypes`, `.${extension}`, ''),
    registry(`${capabilityKey}\\FileAssociations`, `.${extension}`, progId),
  );
  remove.push(
    '  DeleteRegValue SHCTX ' +
      quote(`Software\\Classes\\.${extension}\\OpenWithProgids`) +
      ' ' +
      quote(progId),
    `  DeleteRegKey SHCTX ${quote(classKey)}`,
  );
}
const nsis = [
  '; Generated from tauri.conf.json. Register candidates without writing UserChoice.',
  '!macro SESAME_REGISTER_FILE_CANDIDATES',
  ...install,
  '!macroend',
  '!macro SESAME_UNREGISTER_FILE_CANDIDATES',
  ...remove,
  '!macroend',
  '',
].join('\n');

const xml = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const wixRow = (key, name, value, keyPath = false) =>
  '      <RegistryValue Root="HKMU" Key="' +
  xml(key) +
  '"' +
  (name ? ` Name="${xml(name)}"` : '') +
  ' Type="string" Value="' +
  xml(value) +
  '"' +
  (keyPath ? ' KeyPath="yes"' : '') +
  ' />';
const wixRows = [
  wixRow('Software\\RegisteredApplications', product, capabilityKey, true),
  wixRow(capabilityKey, 'ApplicationName', product),
  wixRow(capabilityKey, 'ApplicationDescription', config.bundle.shortDescription),
  wixRow(capabilityKey, 'ApplicationIcon', `[INSTALLDIR]${binary}.exe,0`),
  wixRow(applicationKey, 'FriendlyAppName', product),
  wixRow(`${applicationKey}\\shell\\open\\command`, '', `"[INSTALLDIR]${binary}.exe" "%1"`),
];
for (const { extension, progId } of entries) {
  // The main WiX template already declares each advertised ProgId.
  wixRows.push(
    wixRow(`Software\\Classes\\.${extension}\\OpenWithProgids`, progId, ''),
    wixRow(`${applicationKey}\\SupportedTypes`, `.${extension}`, ''),
    wixRow(`${capabilityKey}\\FileAssociations`, `.${extension}`, progId),
  );
}
const arch = process.env.TAURI_ENV_ARCH ?? process.arch;
const win64 = arch === 'x86' || arch === 'ia32' ? 'no' : 'yes';
const wix = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">',
  '  <Fragment><DirectoryRef Id="INSTALLDIR">',
  '    <Component Id="SesameFileCandidates" Guid="536006C6-A002-4D1E-B34D-AFCAC359D8A0" Win64="' +
    win64 +
    '">',
  ...wixRows,
  '    </Component>',
  '  </DirectoryRef></Fragment>',
  '</Wix>',
  '',
].join('\n');
const output = new URL('src-tauri/gen/', root);
await mkdir(fileURLToPath(output), { recursive: true });
await writeFile(new URL('file-associations.nsh', output), nsis);
await writeFile(new URL('file-associations.wxs', output), wix);
console.log(`Generated Windows application candidates for ${entries.length} file extensions.`);
