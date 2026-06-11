import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function classList(initial = '') {
    const values = new Set(initial.split(/\s+/).filter(Boolean));
    return {
        add: (...names) => names.forEach(name => values.add(name)),
        remove: (...names) => names.forEach(name => values.delete(name)),
        toggle(name, force) {
            const enabled = force === undefined ? !values.has(name) : force;
            enabled ? values.add(name) : values.delete(name);
            return enabled;
        },
        contains: name => values.has(name)
    };
}

function element(id = '') {
    return {
        id, value: '', dataset: {}, style: {}, children: [], className: '', textContent: '', innerHTML: '',
        classList: classList(),
        setAttribute(key, value) { this[key] = String(value); },
        appendChild(child) { this.children.push(child); },
        remove() {}, focus() {},
        addEventListener(type, listener) { this.listeners ??= {}; this.listeners[type] = listener; },
        querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, matches() { return false; }
    };
}

const ids = [
    'results', 'statsBar', 'progressFill', 'progressPct', 'itemsCount', 'weightSuitcase', 'weightTotal',
    'wornChip', 'wornWeight', 'weightFill', 'daytripBanner', 'laundryToggle', 'laundryFreqBox', 'nights',
    'gender', 'transport', 'laundryFreq', 'laundryBuffer', 'warningsBox', 'templateSelect', 'templateName',
    'w-sun', 'w-rain', 'w-cold', 'act-trekking', 'act-nuoto'
];
const elements = new Map(ids.map(id => [id, element(id)]));
const weather = ['w-sun', 'w-rain', 'w-cold'].map(id => elements.get(id));
const activities = ['act-trekking', 'act-nuoto'].map(id => elements.get(id));

globalThis.document = {
    getElementById: id => elements.get(id) || null,
    querySelectorAll: selector => selector === '.weather-btn' ? weather : selector === '.act-btn' ? activities : [],
    querySelector: () => null,
    createElement: () => element(),
    createDocumentFragment: () => ({ children: [], appendChild(child) { this.children.push(child); } }),
    body: element('body'),
    execCommand: () => true
};
globalThis.localStorage = {
    data: {}, getItem(key) { return this.data[key] ?? null; }, setItem(key, value) { this.data[key] = value; }, removeItem(key) { delete this.data[key]; }
};
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => {} } }, configurable: true });
let printCalled = false;
globalThis.window = { jspdf: null, location: new URL('https://packlist.example/index.html?old=1'), history: { replaceState() {} }, print() { printCalled = true; } };
let alertCalled = false;
globalThis.alert = () => { alertCalled = true; };
globalThis.confirm = () => true;
globalThis.prompt = () => null;

const Ctrl = await import('../js/modules/controller.js');
const db = await import('../js/modules/db.js');

Ctrl.toggleWeather('sun');
Ctrl.toggleWeather('rain');
Ctrl.toggleWeather('cold');
Ctrl.toggleActivity('trekking');
Ctrl.toggleLaundry();
assert.deepEqual(db.STATE.config.weather, ['sun', 'rain', 'cold']);
assert.deepEqual(db.STATE.config.activities, ['trekking']);
assert.equal(db.STATE.config.laundry, true);
assert.equal(elements.get('w-sun').classList.contains('active'), true);
assert.equal(elements.get('w-rain').classList.contains('active'), true);
assert.equal(elements.get('w-cold').classList.contains('active'), true);
assert.equal(elements.get('act-trekking').classList.contains('active'), true);
assert.equal(elements.get('laundryToggle').classList.contains('active'), true);

Ctrl.setConfig({ nights: 15, laundry: false, laundryFreq: 3, laundryBuffer: 1 });
Ctrl.generateList();
for (const fixedName of ['Pigiama', 'Pantaloni casual', 'Multipresa viaggio']) {
    assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === fixedName).q, 1, `${fixedName} must be a fixed 1x item`);
}
let underwear = Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande');
assert.equal(underwear.q, 16);
Ctrl.toggleLaundry();
underwear = Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande');
assert.equal(underwear.q, 4, 'laundry must reduce daily clothes to frequency + buffer');
Ctrl.setConfig({ nights: 6, laundry: false, laundryFreq: 3, laundryBuffer: 0 });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 7, 'without laundry daily clothes must cover every travel day');
Ctrl.toggleLaundry();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 3, 'with laundry and zero buffer daily clothes must match laundry frequency');

const initialItems = Object.values(db.STATE.list).flat().length;
Ctrl.setupEventDelegation();
const input = element('custom-input');
input.value = 'Voce prova';
elements.set('custom-input', input);
const categoryBox = element('category-box');
categoryBox.dataset = { cat: 'Essenziali' };
const addRow = element('add-row');
addRow.querySelector = selector => selector === 'input' ? input : null;
addRow.closest = selector => selector === '.cat-box' ? categoryBox : null;
const addButton = element('add-button');
const clickTarget = element('target');
clickTarget.closest = selector => selector === '[data-action="add"]' ? addButton : selector === '.add-custom' ? addRow : null;
elements.get('results').listeners.click({ target: clickTarget });
assert.equal(Object.values(db.STATE.list).flat().length, initialItems + 1);

const firstItem = Object.values(db.STATE.list).flat()[0];
const firstUid = firstItem.uid;
assert.equal(Ctrl.toggleItemChecked(firstUid), true);
assert.equal(Object.values(db.STATE.list).flat().filter(item => item.checked).length, 1);
assert.equal(Ctrl.updateItemOptions(firstUid, { quantity: 5, weight: 275, worn: true, bulky: true }), true);
assert.deepEqual({ q: firstItem.q, w: firstItem.w, worn: firstItem.worn, bulky: firstItem.bulky }, { q: 5, w: 275, worn: true, bulky: true });
Ctrl.setConfig({ nights: 999, laundryFreq: 0, laundryBuffer: 99, weather: ['sun', 'sun'] });
Ctrl.generateList();
assert.equal(db.STATE.config.nights, 90, 'nights must respect the UI maximum');
assert.equal(db.STATE.config.laundryFreq, 1, 'laundry frequency must respect the UI minimum');
assert.equal(db.STATE.config.laundryBuffer, 5, 'laundry buffer must respect the UI maximum');
assert.deepEqual(db.STATE.config.weather, ['sun'], 'multi-select values must be deduplicated');
assert.equal(Object.values(db.STATE.list).flat().find(item => item.uid === firstUid)?.checked, true, 'regeneration must preserve packing progress');
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Voce prova' && item.custom), true, 'regeneration must preserve custom items');

assert.equal(await Ctrl.exportPDF(), true);
assert.equal(printCalled, true);
const shareUrl = await Ctrl.createShareUrl();
assert.match(shareUrl, /^https:\/\/packlist\.example\/[#][gb]\./);
assert.doesNotMatch(shareUrl, /[?&]list=/, 'compact links must use the shorter hash format');
let pdfLink = '';
class FakePdf {
    setFontSize() {} text() {} autoTable() {} getNumberOfPages() { return 1; } setPage() {} setTextColor() {}
    textWithLink(text, x, y, options) { pdfLink = options.url; }
    save() {}
}
window.jspdf = { jsPDF: FakePdf };
assert.equal(await Ctrl.exportPDF(), true);
assert.equal(pdfLink, shareUrl, 'PDF footer must link to the editable shared list');
window.jspdf = null;

for (const filter of ['all', 'clothing', 'tech', 'essentials']) {
    Ctrl.setFilter(filter);
    assert.equal(db.STATE.filter, filter);
    assert.equal(JSON.parse(localStorage.getItem('packlist_state')).filter, filter, 'filters must be persisted');
}
Ctrl.setFilter('invalid-filter');
assert.equal(db.STATE.filter, 'all');
assert.equal(await Ctrl.copyList(), true);
Ctrl.showStatsSummary();
assert.equal(alertCalled, true);
Ctrl.uncheckAll();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.checked), false);
const validStateBeforeUpdate = localStorage.getItem('packlist_state');
localStorage.setItem('packlist_state_backup', validStateBeforeUpdate);
localStorage.setItem('packlist_state', '{broken');
assert.equal(Ctrl.loadState(), true, 'a broken primary state must restore the update backup');
assert.ok(Object.keys(db.STATE.list).length > 0, 'PWA update recovery must preserve the list');
Ctrl.resetState();
assert.equal(Object.keys(db.STATE.list).length, 0);
assert.equal(db.STATE.filter, 'all');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../js/modules/controller.js', import.meta.url), 'utf8');
const fab = {
    'filter-all': 'setFilter', 'filter-clothing': 'setFilter', 'filter-tech': 'setFilter', 'filter-essentials': 'setFilter',
    copyListBtn: 'copyList', exportPdfBtn: 'exportPDF', shareListBtn: 'shareList', uncheckAllBtn: 'uncheckAll', showStatsBtn: 'showStatsSummary', resetSessionBtn: 'resetState'
};
for (const [id, action] of Object.entries(fab)) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(app, new RegExp(id));
    assert.match(controller, new RegExp(`function ${action}\\b`));
}
assert.match(app, /searchClear\?\.addEventListener\('click'/);
assert.match(app, /function setupFabActions\(\)/);
assert.doesNotMatch(app, /function setupGlobalControls\(\)/);
assert.equal((app.match(/function setupTemplateActions\(\)/g) || []).length, 1);
assert.equal((app.match(/function setupFabActions\(\)/g) || []).length, 1);
assert.match(app, /function handleControlClick\(event\)/);
assert.match(app, /Ctrl\.toggleWeather\(weatherButton\.dataset\.weather\)/);
assert.match(app, /Ctrl\.toggleActivity\(activityButton\.dataset\.activity\)/);
assert.match(app, /const fabItem = event\.target\.closest/);
assert.match(app, /Ctrl\.updateItemOptions/);
assert.match(controller, /CompressionStream/);
assert.match(controller, /navigator\.share/);
assert.match(html, /data-weather="sun"/);
assert.match(html, /id="act-trekking" data-activity="trekking"/);
assert.doesNotMatch(`${app}\n${readFileSync(new URL('../js/modules/ui.js', import.meta.url), 'utf8')}`, /renderActivities/);

console.log('Packlist Pro interaction smoke test passed');
