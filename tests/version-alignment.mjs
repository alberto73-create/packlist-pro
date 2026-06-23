import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const versionPattern = '\\d+\\.\\d+\\.\\d+';
const files = {
  db: readFileSync('js/modules/db.js', 'utf8'),
  index: readFileSync('index.html', 'utf8'),
  sw: readFileSync('sw.js', 'utf8'),
  manifest: readFileSync('manifest.json', 'utf8')
};

function capture(content, regex, label) {
  const match = content.match(regex);
  assert.ok(match, `${label} non trovato`);
  return match[1];
}

const versions = {
  appVersion: capture(files.db, new RegExp(`export const APP_VERSION = ["'](${versionPattern})["'];`), 'APP_VERSION in js/modules/db.js'),
  indexVisible: capture(files.index, new RegExp(`id="appVersion"[^>]*>App v(${versionPattern})<\\/span>`), 'versione visibile in index.html'),
  swCache: capture(files.sw, new RegExp(`const CACHE_NAME = ["']packlist-v(${versionPattern})["'];`), 'CACHE_NAME in sw.js'),
  manifestVersion: JSON.parse(files.manifest).version,
  manifestStartUrl: capture(JSON.parse(files.manifest).start_url, new RegExp(`\\?v=(${versionPattern})$`), 'start_url versionata in manifest.json')
};

const expectedVersion = versions.appVersion;
for (const [label, actualVersion] of Object.entries(versions)) {
  assert.equal(actualVersion, expectedVersion, `${label} (${actualVersion}) non allineata ad APP_VERSION (${expectedVersion})`);
}

const versionedAssetPatterns = {
  'index.html css/style.css': /\.\/css\/style\.css\?v=(\d+\.\d+\.\d+)/g,
  'index.html js/share-v4-loader.js': /\.\/js\/share-v4-loader\.js\?v=(\d+\.\d+\.\d+)/g,
  'index.html js/app.js': /\.\/js\/app\.js\?v=(\d+\.\d+\.\d+)/g,
  'index.html vendor/pdf/packlist-pdf-adapter.js': /\.\/vendor\/pdf\/packlist-pdf-adapter\.js\?v=(\d+\.\d+\.\d+)/g,
  'index.html vendor/pdf/packlist-autotable-adapter.js': /\.\/vendor\/pdf\/packlist-autotable-adapter\.js\?v=(\d+\.\d+\.\d+)/g,
  'sw.js /css/style.css': /\/css\/style\.css\?v=(\d+\.\d+\.\d+)/g,
  'sw.js /js/share-v4-loader.js': /\/js\/share-v4-loader\.js\?v=(\d+\.\d+\.\d+)/g,
  'sw.js /js/app.js': /\/js\/app\.js\?v=(\d+\.\d+\.\d+)/g,
  'sw.js /vendor/pdf/packlist-pdf-adapter.js': /\/vendor\/pdf\/packlist-pdf-adapter\.js\?v=(\d+\.\d+\.\d+)/g,
  'sw.js /vendor/pdf/packlist-autotable-adapter.js': /\/vendor\/pdf\/packlist-autotable-adapter\.js\?v=(\d+\.\d+\.\d+)/g
};

for (const [label, regex] of Object.entries(versionedAssetPatterns)) {
  const content = label.startsWith('index.html') ? files.index : files.sw;
  const matches = [...content.matchAll(regex)].map(match => match[1]);
  assert.ok(matches.length > 0, `${label} non trovato`);
  for (const actualVersion of matches) {
    assert.equal(actualVersion, expectedVersion, `${label} usa ${actualVersion}, atteso ${expectedVersion}`);
  }
}

console.log(`Version alignment test passed (${expectedVersion})`);
