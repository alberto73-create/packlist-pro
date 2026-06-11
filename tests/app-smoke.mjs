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
globalThis.window = { jspdf: null, print() { printCalled = true; } };
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

const initialItems = Object.values(db.STATE.list).flat().length;
Ctrl.setupEventDelegation();
const input = element('custom-input');
input.value = 'Voce prova';
elements.set('custom-input', input);
const addButton = element('add-button');
addButton.dataset = { cat: 'Essenziali', input: 'custom-input' };
const clickTarget = element('target');
clickTarget.closest = selector => selector === '[data-action="add"]' ? addButton : null;
elements.get('results').listeners.click({ target: clickTarget });
assert.equal(Object.values(db.STATE.list).flat().length, initialItems + 1);

const firstItem = Object.values(db.STATE.list).flat()[0];
const firstUid = firstItem.uid;
assert.equal(Ctrl.toggleItemChecked(firstUid), true);
assert.equal(Object.values(db.STATE.list).flat().filter(item => item.checked).length, 1);
Ctrl.setConfig({ nights: 999, laundryFreq: 0, laundryBuffer: 99, weather: ['sun', 'sun'] });
Ctrl.generateList();
assert.equal(db.STATE.config.nights, 90, 'nights must respect the UI maximum');
assert.equal(db.STATE.config.laundryFreq, 1, 'laundry frequency must respect the UI minimum');
assert.equal(db.STATE.config.laundryBuffer, 5, 'laundry buffer must respect the UI maximum');
assert.deepEqual(db.STATE.config.weather, ['sun'], 'multi-select values must be deduplicated');
assert.equal(Object.values(db.STATE.list).flat().find(item => item.uid === firstUid)?.checked, true, 'regeneration must preserve packing progress');
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Voce prova' && item.custom), true, 'regeneration must preserve custom items');

assert.equal(Ctrl.exportPDF(), true);
assert.equal(printCalled, true);

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
Ctrl.resetState();
assert.equal(Object.keys(db.STATE.list).length, 0);
assert.equal(db.STATE.filter, 'all');

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const controller = readFileSync(new URL('../js/modules/controller.js', import.meta.url), 'utf8');
const fab = {
    'filter-all': 'setFilter', 'filter-clothing': 'setFilter', 'filter-tech': 'setFilter', 'filter-essentials': 'setFilter',
    copyListBtn: 'copyList', exportPdfBtn: 'exportPDF', uncheckAllBtn: 'uncheckAll', showStatsBtn: 'showStatsSummary', resetSessionBtn: 'resetState'
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
assert.match(app, /button\.addEventListener\('click', \(\) => Ctrl\.toggleWeather/);
assert.match(app, /button\.addEventListener\('click', \(\) => Ctrl\.toggleActivity/);
assert.match(html, /data-weather="sun"/);
assert.match(readFileSync(new URL('../js/modules/ui.js', import.meta.url), 'utf8'), /button\.dataset\.activity = a\.id/);

console.log('Packlist Pro interaction smoke test passed');
