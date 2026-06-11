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
Ctrl.toggleActivity('trekking');
Ctrl.toggleLaundry();
assert.deepEqual(db.STATE.config.weather, ['sun']);
assert.deepEqual(db.STATE.config.activities, ['trekking']);
assert.equal(db.STATE.config.laundry, true);
assert.equal(elements.get('w-sun').classList.contains('active'), true);
assert.equal(elements.get('act-trekking').classList.contains('active'), true);
assert.equal(elements.get('laundryToggle').classList.contains('active'), true);

Ctrl.generateList();
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
assert.equal(Ctrl.toggleItemChecked(firstItem.uid), true);
assert.equal(Object.values(db.STATE.list).flat().filter(item => item.checked).length, 1);

assert.equal(Ctrl.exportPDF(), true);
assert.equal(printCalled, true);

for (const filter of ['all', 'clothing', 'tech', 'essentials']) {
    Ctrl.setFilter(filter);
    assert.equal(db.STATE.filter, filter);
}
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
assert.match(html, /data-weather="sun"/);
assert.match(readFileSync(new URL('../js/modules/ui.js', import.meta.url), 'utf8'), /button\.dataset\.activity = a\.id/);

console.log('Packlist Pro interaction smoke test passed');
