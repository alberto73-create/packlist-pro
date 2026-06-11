import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

function collectFiles(directory, extension, results = []) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.name === '.git' || entry.name === 'node_modules') continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory()) collectFiles(path, extension, results);
        else if (path.endsWith(extension)) results.push(path.replace(/^\.\//, ''));
    }
    return results;
}

const htmlFiles = collectFiles('.', '.html');
assert.deepEqual(htmlFiles, ['index.html'], 'the runtime must have exactly one HTML entry point');

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
assert.equal((html.match(/<link rel="stylesheet"/g) || []).length, 1, 'the runtime must load exactly one app stylesheet');
assert.equal((html.match(/<script type="module"/g) || []).length, 1, 'the runtime must load exactly one module entry point');
const app = readFileSync('js/app.js', 'utf8');
const db = readFileSync('js/modules/db.js', 'utf8');
const pwa = readFileSync('js/modules/pwa.js', 'utf8');
const sw = readFileSync('sw.js', 'utf8');
const css = readFileSync('css/style.css', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

const version = db.match(/APP_VERSION = "([^"]+)"/)?.[1];
assert.ok(version, 'APP_VERSION must exist');
assert.match(html, new RegExp(`id="appVersion"[^>]*>App v${version}<`));
assert.match(html, new RegExp(`css/style\\.css\\?v=${version}`));
assert.match(html, new RegExp(`js/app\\.js\\?v=${version}`));
assert.match(sw, new RegExp(`css/style\\.css\\?v=${version}`));
assert.match(sw, new RegExp(`js/app\\.js\\?v=${version}`));
assert.match(app, /versionElement\.textContent = `App v\$\{APP_VERSION\}`/);
assert.match(pwa, /updateViaCache: 'none'/);
assert.match(pwa, /controllerchange/);
assert.match(sw, /client => client\.navigate\(client\.url\)/);
assert.match(css, /\.activity-grid > \.act-btn \{/);
assert.match(css, /border: 2px solid rgba\(148, 163, 184, \.5\)/);

for (const route of ['/', '/index.html', '/js/(.*)', '/css/(.*)', '/sw.js']) {
    const config = vercel.routes.find(item => item.src === route);
    assert.ok(config, `missing Vercel route ${route}`);
    assert.match(config.headers?.['cache-control'] || '', /no-cache|no-store/, `${route} must not serve stale app code`);
}

console.log(`Runtime integrity passed: one HTML entry point, version ${version}, cache-safe assets`);
