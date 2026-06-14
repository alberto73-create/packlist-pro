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
    'gender', 'transport', 'laundryFreq', 'laundryBuffer', 'warningsBox', 'templateSelect', 'templateName', 'itemBaggage', 'baggageSetupModal', 'baggageSetupNames',
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

const longTripWarning = db.WARNINGS.at(-1);
assert.equal(longTripWarning.check({ config: { nights: 7, laundry: false } }), true, 'long-trip warning must appear above six nights without laundry');
assert.equal(longTripWarning.check({ config: { nights: 6, laundry: false } }), false, 'long-trip warning must stay hidden at six nights');
assert.equal(longTripWarning.check({ config: { nights: 7, laundry: true } }), false, 'long-trip warning must stay hidden when laundry is active');

const powerbank = db.DB.base.find(item => item.n === 'Powerbank');
powerbank.transportModes = ['auto'];
Ctrl.setConfig({ transport: 'moto' });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), false, 'items incompatible with the selected transport must be excluded');
Ctrl.setConfig({ transport: 'auto' });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), true, 'items compatible with the selected transport must be included');
delete powerbank.transportModes;

const pants = db.DB.base.find(item => item.n === 'Pantaloni casual');
pants.quantityRule = { type: 'perDay', base: 1, every: 3, min: 1, max: 0, laundry: true };
Ctrl.setConfig({ nights: 5, transport: 'auto', laundry: false });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Pantaloni casual').q, 2, 'six travel days with one item every three days must produce two items');
const underwearRule = db.DB.base.find(item => item.n === 'Mutande');
underwearRule.quantityRule = { type: 'perDay', base: 1, every: 1, min: 1, max: 0, laundry: true };
Ctrl.setConfig({ nights: 9, laundry: true, laundryFreq: 4, laundryBuffer: 1 });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 5, 'laundry frequency and buffer must cap daily clothing quantities');
delete pants.quantityRule;
delete underwearRule.quantityRule;
Ctrl.setConfig({ laundry: false });

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

const baggages = Ctrl.configureBaggages(['Zaino 40L', 'Trolley 10kg']);
assert.equal(baggages.length, 2);
assert.equal(Object.values(db.STATE.list).flat().every(item => item.baggageId === baggages[0].id), true, 'initial setup assigns all items to the first baggage');
assert.equal(Ctrl.updateBaggage(baggages[1].id, { name: 'Trolley cabina', limit: 10 }), true);
assert.equal(Ctrl.updateItemOptions(firstUid, { quantity: 5, weight: 275, worn: false, bulky: true, baggageId: baggages[1].id }), true);
assert.equal(Object.values(db.STATE.list).flat().find(item => item.uid === firstUid).baggageId, baggages[1].id, 'item options move an item between baggages');
assert.equal(Ctrl.moveAllBaggageItems(baggages[1].id, baggages[0].id), true);
assert.equal(Object.values(db.STATE.list).flat().every(item => item.baggageId === baggages[0].id), true, 'bulk move reassigns all baggage items');
Ctrl.updateItemOptions(firstUid, { quantity: 5, weight: 275, worn: false, bulky: true, baggageId: baggages[1].id });

assert.equal(await Ctrl.exportPDF(), true);
assert.equal(printCalled, true);
assert.equal(Ctrl.saveTemplate('Rio'), true);
assert.equal(db.STATE.listName, 'Rio', 'saved template name must become the list name');
assert.equal(JSON.parse(localStorage.getItem('packlist_state')).listName, 'Rio', 'list name must be persisted');
const shareUrl = await Ctrl.createShareUrl();
assert.match(shareUrl, /^https:\/\/packlist\.example\/[#][gb]\./);
assert.doesNotMatch(shareUrl, /[?&]list=/, 'compact links must use the shorter hash format');
assert.match(shareUrl, /[#][gb]\./, 'multi-baggage shared state must remain compact');
let pdfLink = '';
let pdfLinkRegion = null;
let pdfFilename = '';
let pdfTitle = '';
class FakePdf {
    setFontSize() {} autoTable() {} addPage() {} getNumberOfPages() { return 1; } setPage() {} setTextColor() {} setFillColor() {} roundedRect() {}
    text(text, x, y) { if (x === 14 && y === 18) pdfTitle = text; }
    link(x, y, width, height, options) { pdfLink = options.url; pdfLinkRegion = { x, y, width, height }; }
    save(filename) { pdfFilename = filename; }
}
window.jspdf = { jsPDF: FakePdf };
assert.equal(await Ctrl.exportPDF(), true);
assert.equal(pdfLink, shareUrl, 'the entire PDF call-to-action must link to the editable shared list');
assert.deepEqual(pdfLinkRegion, { x: 14, y: 278, width: 182, height: 12 }, 'the PDF link must cover the whole call-to-action row');
assert.equal(pdfTitle, 'Packlist Pro · Rio', 'the saved list name must appear in the PDF');
assert.match(pdfFilename, /^packlist_Rio_\d{4}-\d{2}-\d{2}\.pdf$/, 'the saved list name must appear in the PDF filename');
window.jspdf = null;

window.location = new URL(shareUrl);
assert.equal(await Ctrl.loadSharedListFromUrl(), true, 'shared multi-baggage list must load');
assert.deepEqual(db.STATE.baggages.map(bag => [bag.name, bag.limit]), [['Zaino 40L', 0], ['Trolley cabina', 10]], 'shared URL must preserve baggage names and limits');
assert.equal(Object.values(db.STATE.list).flat().some(item => item.baggageId === db.STATE.baggages[1].id), true, 'shared URL must preserve item baggage assignments');
const temporaryBag = Ctrl.addBaggage('Temporaneo');
assert.equal(Ctrl.deleteBaggage(temporaryBag.id, db.STATE.baggages[0].id), true, 'empty baggage can be deleted');

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
