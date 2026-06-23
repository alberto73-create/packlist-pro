import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const VERSION_FILES = ['index.html', 'js/modules/db.js', 'sw.js', 'manifest.json'];

export function compareSemver(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

export function collectVersions(contents) {
  const versions = new Set();
  const patterns = [
    /App v(\d+\.\d+\.\d+)/g,
    /APP_VERSION = ["'](\d+\.\d+\.\d+)["']/g,
    /packlist-v(\d+\.\d+\.\d+)/g,
    /["']version["']:\s*["'](\d+\.\d+\.\d+)["']/g,
    /[?&]v=(\d+\.\d+\.\d+)/g
  ];

  for (const content of contents) {
    for (const pattern of patterns) {
      for (const match of content.matchAll(pattern)) versions.add(match[1]);
    }
  }
  return [...versions].sort(compareSemver);
}

function normalizeVersionText(content, targetVersion) {
  return content
    .replace(/packlist-v1\.\d+\.\d+/g, `packlist-v${targetVersion}`)
    .replace(/1\.\d+\.\d+/g, targetVersion);
}

function chooseConflictSide(currentLines, incomingLines, targetVersion) {
  const current = normalizeVersionText(currentLines.join('\n'), targetVersion);
  const incoming = normalizeVersionText(incomingLines.join('\n'), targetVersion);
  if (current === incoming) return currentLines;

  const currentHasTarget = currentLines.some((line) => line.includes(targetVersion));
  const incomingHasTarget = incomingLines.some((line) => line.includes(targetVersion));
  if (currentHasTarget && !incomingHasTarget) return currentLines;
  if (incomingHasTarget && !currentHasTarget) return incomingLines;

  return currentLines;
}

export function resolveConflictHunks(content, targetVersion) {
  const lines = content.split('\n');
  const resolved = [];
  let index = 0;

  while (index < lines.length) {
    if (!lines[index].startsWith('<<<<<<<')) {
      resolved.push(lines[index]);
      index += 1;
      continue;
    }

    index += 1;
    const currentLines = [];
    while (index < lines.length && !lines[index].startsWith('=======')) {
      currentLines.push(lines[index]);
      index += 1;
    }

    if (index >= lines.length) {
      resolved.push(...currentLines);
      break;
    }

    index += 1;
    const incomingLines = [];
    while (index < lines.length && !lines[index].startsWith('>>>>>>>')) {
      incomingLines.push(lines[index]);
      index += 1;
    }

    if (index < lines.length && lines[index].startsWith('>>>>>>>')) index += 1;
    resolved.push(...chooseConflictSide(currentLines, incomingLines, targetVersion));
  }

  return resolved.join('\n');
}

export function normalizeVersionFile(content, targetVersion) {
  return normalizeVersionText(resolveConflictHunks(content, targetVersion), targetVersion);
}

export function resolveVersionConflicts({ version, dryRun = false, files = VERSION_FILES } = {}) {
  const originalContents = files.map((file) => readFileSync(file, 'utf8'));
  const detectedVersions = collectVersions(originalContents);
  const targetVersion = version || detectedVersions.at(-1);

  if (!targetVersion) {
    throw new Error('Nessuna versione semver trovata. Passa una versione, es: npm run resolve:version-conflicts -- 1.10.23');
  }

  for (const file of files) {
    const content = normalizeVersionFile(readFileSync(file, 'utf8'), targetVersion);
    if (!dryRun) writeFileSync(file, content);
  }

  return { targetVersion, files };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isCli) {
  const explicitVersion = process.argv.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
  const dryRun = process.argv.includes('--dry-run');

  try {
    const { targetVersion, files } = resolveVersionConflicts({ version: explicitVersion, dryRun });
    const mode = dryRun ? 'verificata' : 'risolta';
    console.log(`Versione ${mode}: ${targetVersion} in ${files.join(', ')}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
