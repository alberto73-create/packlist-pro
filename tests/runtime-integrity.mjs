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
const admin = readFileSync('js/modules/admin.js', 'utf8');
const db = readFileSync('js/modules/db.js', 'utf8');
const dbData = readFileSync('js/modules/db-data.js', 'utf8');
const controller = readFileSync('js/modules/controller.js', 'utf8');
const pwa = readFileSync('js/modules/pwa.js', 'utf8');
const sw = readFileSync('sw.js', 'utf8');
const css = readFileSync('css/style.css', 'utf8');
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const screenshot = readFileSync('scripts/capture-screenshot.mjs', 'utf8');

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
assert.match(pwa, /registration\.waiting/);
assert.match(pwa, /registration\.onupdatefound/);
assert.match(pwa, /packlist:before-update/);
assert.match(pwa, /packlist_state_backup/);
assert.match(sw, /SKIP_WAITING/);
assert.doesNotMatch(sw, /client => client\.navigate\(client\.url\)/, 'activation must not race controllerchange with an extra navigation');
assert.match(screenshot, /previewUrl\(port\)/, 'visual regression screenshot must render representative item rows');
assert.match(screenshot, /dbus\|UPower/i, 'headless environment noise must be filtered');
assert.match(screenshot, /child\.kill\('SIGKILL'\)/, 'screenshot capture must have a timeout');
assert.match(screenshot, /maxRetries:\s*5/, 'screenshot profile cleanup must tolerate transient Chrome file locks');
assert.match(screenshot, /server\.close\(resolveClose\)/, 'screenshot server must close before temporary files are removed');
assert.match(screenshot, /const screenshotReady = existsSync\(output\)/, 'a valid screenshot must be the primary success condition');
assert.match(screenshot, /PHONE_REGISTRATION_ERROR/, 'harmless Chrome registration noise must be filtered');
assert.match(css, /\.fab-container \{[\s\S]*pointer-events: none;/);
assert.match(css, /\.fab-menu \{[\s\S]*position: absolute;/);
assert.match(css, /\.modern-switch:checked::after/);
assert.match(css, /\.admin-toggle input\[type="checkbox"\]:checked::after/, 'admin worn control must show a visible checkmark');
assert.match(css, /\.admin-field\.is-modified/, 'admin fields must visually identify unsaved changes');
assert.match(admin, /markModified\(e\.target\)/, 'admin editor must mark changed parameters');
assert.match(html, /id="itemWeight"/);
assert.match(html, /id="itemBaggage"/);
assert.match(html, /id="baggageSetupModal"/);
assert.match(html, /id="baggageManagerModal"/);
assert.match(html, /id="manageBaggagesBtn"/);
assert.match(html, /app-logo-icon[^>]*><img src="\.\/icons\/icon-backpack\.svg"/);
assert.doesNotMatch(`${html}\n${sw}\n${readFileSync('manifest.json', 'utf8')}`, /icons\/icon-(?:144|192|512)\.png/, 'runtime install assets must use the text-only backpack SVG');
assert.match(controller, /doc\.link\(cta\.x, cta\.y, cta\.width, cta\.height/);
assert.match(controller, /documentTitle = listName/);
assert.match(controller, /packlist\$\{namePart\}/);
assert.match(controller, /url\.hash = await encodeSharedState/);
assert.match(controller, /STATE\.baggages\.map\(bag => \[bag\.name, bag\.limit/);
assert.match(controller, /baggageIndexes\.get\(item\.baggageId\)/);
assert.match(css, /\.baggage-section\.over-limit/);
assert.match(css, /\.activity-grid > \.act-btn \{/);
assert.match(css, /border: 2px solid rgba\(148, 163, 184, \.5\)/);
const activityButtons = [...html.matchAll(/<button[^>]+class="act-btn"[^>]+data-activity="([^"]+)"/g)].map(([, id]) => id);
const extraDatabase = dbData.slice(dbData.indexOf('  extra: {'));
const activityDatabaseIds = [...extraDatabase.matchAll(/^    ([a-z_]+): \[/gm)].map(([, id]) => id);
assert.deepEqual(activityButtons, activityDatabaseIds, 'all database activities must exist statically in index.html');
assert.doesNotMatch(`${app}\n${readFileSync('js/modules/ui.js', 'utf8')}`, /renderActivities/, 'activity visibility must not depend on dynamic rendering');

for (const route of ['/', '/index.html', '/js/(.*)', '/css/(.*)', '/sw.js']) {
    const config = vercel.routes.find(item => item.src === route);
    assert.ok(config, `missing Vercel route ${route}`);
    assert.match(config.headers?.['cache-control'] || '', /no-cache|no-store/, `${route} must not serve stale app code`);
}

console.log(`Runtime integrity passed: one HTML entry point, version ${version}, cache-safe assets`);
