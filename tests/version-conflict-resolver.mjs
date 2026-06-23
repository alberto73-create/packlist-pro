import assert from 'node:assert/strict';
import { collectVersions, normalizeVersionFile, resolveConflictHunks } from '../scripts/resolve-version-conflicts.mjs';

const manifestConflict = `{
  "name": "Packlist Pro",
<<<<<<< current
  "version": "1.10.22",
  "start_url": "./index.html?v=1.10.22",
=======
  "version": "1.10.21",
  "start_url": "./index.html?v=1.10.21",
>>>>>>> main
  "display": "standalone"
}`;

const resolvedManifest = normalizeVersionFile(manifestConflict, '1.10.22');
assert.doesNotMatch(resolvedManifest, /<<<<<<<|=======|>>>>>>>/);
assert.equal((resolvedManifest.match(/"version":/g) || []).length, 1, 'manifest conflict must not leave duplicate version keys');
assert.equal((resolvedManifest.match(/"start_url":/g) || []).length, 1, 'manifest conflict must not leave duplicate start_url keys');
assert.match(resolvedManifest, /"version": "1\.10\.22"/);
assert.match(resolvedManifest, /"start_url": "\.\/index\.html\?v=1\.10\.22"/);
assert.doesNotThrow(() => JSON.parse(resolvedManifest), 'resolved manifest must remain valid JSON');

const swConflict = `const CACHE_NAME = 'packlist-v1.10.22';
<<<<<<< HEAD
  '/js/app.js?v=1.10.22',
=======
  '/js/app.js?v=1.10.21',
>>>>>>> main
  '/css/style.css?v=1.10.22'`;
const resolvedSw = resolveConflictHunks(swConflict, '1.10.22');
assert.equal((resolvedSw.match(/\/js\/app\.js/g) || []).length, 1, 'service worker asset conflict must keep one app asset row');
assert.doesNotMatch(normalizeVersionFile(swConflict, '1.10.22'), /1\.10\.21/);

const versions = collectVersions([
  'https://cdn.jsdelivr.net/npm/jspdf@3.5.31/dist/jspdf.umd.min.js',
  'App v1.10.22',
  'const CACHE_NAME = \'packlist-v1.10.21\';'
]);
assert.deepEqual(versions, ['1.10.21', '1.10.22'], 'collector must ignore third-party library versions');

console.log('Version conflict resolver test passed');
