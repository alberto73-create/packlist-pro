import { readFileSync, writeFileSync } from 'node:fs';

const VERSION_FILES = ['index.html', 'js/modules/db.js', 'sw.js', 'manifest.json'];
const explicitVersion = process.argv.find((arg) => /^\d+\.\d+\.\d+$/.test(arg));
const dryRun = process.argv.includes('--dry-run');

function stripConflictMarkers(content) {
  return content
    .split('\n')
    .filter((line) => !/^(<<<<<<<|=======|>>>>>>>)(\s|$)/.test(line))
    .join('\n');
}

function compareSemver(a, b) {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function collectVersions(contents) {
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

const originalContents = VERSION_FILES.map((file) => readFileSync(file, 'utf8'));
const detectedVersions = collectVersions(originalContents);
const targetVersion = explicitVersion || detectedVersions.at(-1);

if (!targetVersion) {
  console.error('Nessuna versione semver trovata. Passa una versione, es: npm run resolve:version-conflicts -- 1.10.23');
  process.exit(1);
}

const replacements = [
  [/1\.\d+\.\d+/g, targetVersion],
  [/packlist-v1\.\d+\.\d+/g, `packlist-v${targetVersion}`]
];

for (const file of VERSION_FILES) {
  let content = stripConflictMarkers(readFileSync(file, 'utf8'));
  for (const [pattern, replacement] of replacements) content = content.replace(pattern, replacement);
  if (!dryRun) writeFileSync(file, content);
}

const mode = dryRun ? 'verificata' : 'risolta';
console.log(`Versione ${mode}: ${targetVersion} in ${VERSION_FILES.join(', ')}`);
