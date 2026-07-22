import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2]?.trim();
if (!/^\d+\.\d+\.\d+$/.test(version || '')) {
  console.error('Uso: npm run bump:version -- X.Y.Z');
  process.exit(1);
}

const files = {
  db: 'js/modules/db.js',
  index: 'index.html',
  sw: 'sw.js',
  manifest: 'manifest.json'
};

function replaceOrFail(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`Pattern non trovato: ${label}`);
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

const updates = {
  [files.db]: content => replaceOrFail(
    content,
    /export const APP_VERSION = ["']\d+\.\d+\.\d+["'];/,
    `export const APP_VERSION = "${version}";`,
    'APP_VERSION in js/modules/db.js'
  ),
  [files.index]: content => {
    let updated = replaceOrFail(
      content,
      /(<span class="app-version" id="appVersion" title="Versione applicazione">App v)\d+\.\d+\.\d+(<\/span>)/,
      `$1${version}$2`,
      'versione visibile in index.html'
    );
    updated = replaceOrFail(
      updated,
      /(\.\/(?:css\/style\.css|js\/app\.js|vendor\/pdf\/packlist-pdf-adapter\.js|vendor\/pdf\/packlist-autotable-adapter\.js)\?v=)\d+\.\d+\.\d+/g,
      `$1${version}`,
      'query string asset versionati in index.html'
    );
    return updated;
  },
  [files.sw]: content => {
    let updated = replaceOrFail(
      content,
      /const CACHE_NAME = ["']packlist-v\d+\.\d+\.\d+["'];/,
      `const CACHE_NAME = 'packlist-v${version}';`,
      'CACHE_NAME in sw.js'
    );
    updated = replaceOrFail(
      updated,
      /((?:\/js\/app\.js|\/css\/style\.css|\/vendor\/pdf\/packlist-pdf-adapter\.js|\/vendor\/pdf\/packlist-autotable-adapter\.js)\?v=)\d+\.\d+\.\d+/g,
      `$1${version}`,
      'asset versionati in sw.js'
    );
    return updated;
  },
  [files.manifest]: content => {
    let updated = replaceOrFail(
      content,
      /("version"\s*:\s*")\d+\.\d+\.\d+(")/,
      `$1${version}$2`,
      'version in manifest.json'
    );
    updated = replaceOrFail(
      updated,
      /("start_url"\s*:\s*"\.\/index\.html\?v=)\d+\.\d+\.\d+(")/,
      `$1${version}$2`,
      'start_url in manifest.json'
    );
    JSON.parse(updated);
    return updated;
  }
};

for (const [file, update] of Object.entries(updates)) {
  const content = readFileSync(file, 'utf8');
  writeFileSync(file, update(content));
}

console.log(`Versione Packlist Pro aggiornata a ${version} in ${Object.values(files).join(', ')}`);
