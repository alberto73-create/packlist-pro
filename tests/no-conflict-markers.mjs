import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const files = [
    'css/style.css',
    'index.html',
    'js/app.js',
    'js/modules/controller.js',
    'js/modules/packlist-generator.js',
    'js/modules/state-store.js',
    'js/modules/db.js',
    'js/modules/pwa.js',
    'js/modules/ui.js',
    'sw.js'
];
const marker = /^(<<<<<<<|=======|>>>>>>>)(?: .*)?$/m;
for (const file of files) {
    assert.doesNotMatch(readFileSync(file, 'utf8'), marker, `${file} contains unresolved Git conflict markers`);
}
console.log('No unresolved Git conflict markers found');
