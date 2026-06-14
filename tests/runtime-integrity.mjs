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
assert.deepEqual(htmlFiles, ['index.html', 'offline.html'], 'the runtime must contain the app entry point and offline fallback');

const html = readFileSync('index.html', 'utf8');
const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, 'HTML ids must be unique');
assert.equal((html.match(/<link rel="stylesheet"/g) || []).length, 1, 'the runtime must load exactly one app stylesheet');
assert.equal((html.match(/<script type="module"/g) || []).length, 1, 'the runtime must load exactly one module entry point');
const app = readFileSync('js/app.js', 'utf8');
const adminModule = readFileSync('js/modules/admin.js', 'utf8');
const communications = readFileSync('js/modules/communications.js', 'utf8');
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
assert.match(adminModule, /markModified\(e\.target\)/, 'admin editor must mark changed parameters');
assert.match(adminModule, /data-transport-mode/, 'admin items must expose per-item transport compatibility');
assert.match(adminModule, /data-weather-mode/, 'admin items must expose per-item weather compatibility');
assert.match(controller, /isWeatherCompatible\(item, config\.weather\)/, 'generated items must be filtered by per-item weather compatibility');
assert.match(adminModule, /group\.querySelectorAll\('\[data-transport-mode\]'\)/, 'transport chip changes must update in place without resetting scroll');
assert.match(adminModule, /adminPasswordToggle/, 'admin login must expose a password visibility control');
assert.match(adminModule, /data-quantity="every"/, 'admin items must expose quantity frequency rules');
assert.match(controller, /isTransportCompatible\(item, config\.transports\)/, 'generated items must be filtered by per-item transport compatibility');
assert.match(controller, /Math\.ceil\(coveredDays/, 'quantity frequency must round up');
assert.match(html, /option value="camper"/, 'the trip transport selector must expose camper');
assert.match(html, /class="choice-btn transport-btn"/, 'public transport selection must use compact visual buttons');
assert.match(html, /class="choice-btn gender-btn"/, 'public gender selection must use compact visual buttons');
assert.match(html, /option value="walking"/, 'walking and trekking must use one canonical transport mode');
assert.doesNotMatch(html, /option value="backpack"/, 'backpack must not be duplicated as a transport mode');
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
const extraStart = dbData.search(/^\s*(?:extra|"extra"):\s*\{/m);
assert.ok(extraStart >= 0, 'DB_DATA.extra must exist in serialized or object-literal form');
const extraDatabase = dbData.slice(extraStart);
const activityDatabaseIds = [...extraDatabase.matchAll(/^\s{4}(?:([a-z_]+)|"([a-z_]+)"):\s*\[/gm)].map(([, plain, quoted]) => plain || quoted);
assert.deepEqual(activityButtons, activityDatabaseIds, 'all database activities must exist statically in index.html');
assert.doesNotMatch(`${app}\n${readFileSync('js/modules/ui.js', 'utf8')}`, /renderActivities/, 'activity visibility must not depend on dynamic rendering');

for (const route of ['/', '/index.html', '/js/(.*)', '/css/(.*)', '/sw.js']) {
    const config = vercel.routes.find(item => item.src === route);
    assert.ok(config, `missing Vercel route ${route}`);
    assert.match(config.headers?.['cache-control'] || '', /no-cache|no-store/, `${route} must not serve stale app code`);
}

console.log(`Runtime integrity passed: one HTML entry point, version ${version}, cache-safe assets`);

// Communications backend remains optional, isolated and never hardcodes a personal endpoint/admin key.
assert.match(communications, /packlist_apps_script_settings/);
assert.match(communications, /packlist_remote_feedback_pending/);
assert.match(communications, /loadRemoteCommunicationSettings/);
assert.match(communications, /retryPendingFeedback/);
assert.match(communications, /action:\s*'saveCommunication'/);
assert.doesNotMatch(communications, /script\.google\.com\/macros\/s\//, 'Apps Script endpoint must be configured by the admin');
assert.match(html, /script-src-elem[^;]*https:\/\/script\.google\.com[^;]*https:\/\/script\.googleusercontent\.com/, 'CSP must allow Apps Script JSONP fallback');
assert.match(html, /connect-src[^;]*https:\/\/script\.google\.com[^;]*https:\/\/script\.googleusercontent\.com/, 'CSP must allow Apps Script fetch requests');

const adminAuth = readFileSync('api/admin-auth.js', 'utf8');
assert.match(adminModule, /fetch\('\/api\/admin-auth'/, 'admin login must authenticate server-side');
assert.match(adminModule, /if\(!response\.ok\|\|data\.ok!==true\)throw new Error\('Password non valida'\)/, 'only an explicit ok response may open admin');
assert.match(adminModule, /draft=null/, 'failed or closed admin sessions must clear the draft');
assert.match(adminAuth, /req\.method !== 'POST'/);
assert.match(adminAuth, /req\.body\?\.password !== process\.env\.ADMIN_PASSWORD/);
assert.doesNotMatch(adminAuth, /ADMIN_PASSWORD\s*=/, 'admin password must not be hardcoded');
assert.match(communications, /postAppsScriptBestEffort/);
assert.match(communications, /mode: 'no-cors'/);
assert.doesNotMatch(communications, /return \{ ok: true \};/, 'non-JSON responses must never be assumed successful');

assert.match(html, /id="feedbackBtn"/);
assert.match(app, /fabItem\.id === 'feedbackBtn'\) openFeedbackModal\(\)/, 'the Feedback FAB action must open the feedback modal');
assert.doesNotMatch(html, /id="adminFabBtn"/, 'admin entry must not be duplicated in the FAB');
assert.match(html, /id="removeCheckedBtn"/);
assert.match(communications, /class="feedback-stars"/);
assert.match(communications, /<h2 id="feedbackTitle">Lascia un feedback<\/h2>/);
assert.equal((communications.match(/data-rating="\$\{x\}"/g) || []).length, 1, 'feedback must render its five stars from one canonical 1..5 list');
assert.match(communications, /\[1,2,3,4,5\]\.map/, 'feedback must render exactly five rating choices');
assert.match(communications, /data-rating="\$\{x\}"/);
assert.match(communications, /if\(!form\.elements\.rating\.value\)/, 'feedback must require an explicit rating');
assert.match(communications, /if\(!form\.elements\.message\.value\.trim\(\)\)/, 'feedback must require a comment');
assert.match(communications, /if \(error\.confirmedBackendError\) throw error/, 'confirmed backend failures must never fall back to opaque success');
assert.doesNotMatch(`${app}
${readFileSync('js/modules/ui.js', 'utf8')}
${readFileSync('js/modules/utils.js', 'utf8')}`, /v9\.5 Fixed/);

assert.match(communications, /modal-backdrop feedback-modal visible/, 'feedback modal must use the visible modal state');
assert.match(adminModule, /communicationSettingsForm'\)\?\.requestSubmit\(\)/, 'Salva tutto must also persist local communication settings');

assert.doesNotMatch(db, /INLINE_DB/, 'legacy inline database must not coexist with DB_DATA');
assert.match(html, /id="exportCsvBtn"/, 'CSV export must be reachable from the UI');
assert.match(html, /id="statsSummaryModal"/, 'statistics must use an app modal');
assert.doesNotMatch(controller, /alert\(\[/, 'statistics must not use blocking native alert');
assert.match(controller, /visibleEntries/, 'copy list must respect the active filter');
assert.match(sw, /offline\.html/);
assert.match(css, /\.item-text mark/);
assert.match(html, /Per assegnare un singolo item/);

assert.doesNotMatch(readFileSync('js/modules/utils.js', 'utf8'), /toast\.style\.cssText/, 'toast styling must use the shared stylesheet');
assert.match(css, /\.toast-notification/);
assert.match(app, /U\.debounce\(syncConfig, 180\)/, 'automatic config regeneration must be debounced');
assert.doesNotMatch(app, /if \(!STATE\.baggageSetup\) View\.openBaggageSetup\(\)/, 'baggage setup must not block first exploration');
assert.match(html, /data-gender="U"[^>]*>🧑 Unisex/);
assert.match(html, /id="shareQuickBtn"/);
assert.match(html, /class="fab-more"/);
assert.match(css, /\.cat-box\.complete/);

assert.match(app, /const scheduleConfigSync = U\.debounce\(syncConfig, 180\);[\s\S]*function setupEventListeners/, 'debounced sync must be shared with delegated controls');
assert.doesNotMatch(app, /function setupEventListeners\(\) \{[\s\S]{0,120}const scheduleConfigSync/, 'debounced sync must not be scoped only to setupEventListeners');
assert.match(pwa, /if \(!isInstallBannerDismissed\(\)\) showInstallBanner\(true\)/);
