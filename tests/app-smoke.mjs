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
        appendChild(child) { this.children.push(child); }, select() {},
        remove() {}, focus() {},
        addEventListener(type, listener) { this.listeners ??= {}; this.listeners[type] = listener; },
        querySelector() { return null; }, querySelectorAll() { return []; }, closest() { return null; }, matches() { return false; }
    };
}

const ids = [
    'results', 'statsBar', 'progressFill', 'progressPct', 'itemsCount', 'weightSuitcase', 'weightTotal',
    'wornChip', 'wornWeight', 'weightFill', 'daytripBanner', 'laundryToggle', 'laundryFreqBox', 'nights',
    'gender', 'transport', 'laundryFreq', 'laundryBuffer', 'warningsBox', 'templateSelect', 'templateName', 'itemBaggage', 'baggageSetupModal', 'baggageSetupNames', 'statsSummaryModal', 'statsSummaryContent', 'statsSummaryClose',
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
let clipboardText = '';
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async value => { clipboardText = value; } } }, configurable: true });
let printCalled = false;
globalThis.window = { jspdf: null, location: new URL('https://packlist.example/index.html?old=1'), history: { replaceState() {} }, print() { printCalled = true; } };
let alertCalled = false;
globalThis.alert = () => { alertCalled = true; };
globalThis.confirm = () => true;
globalThis.prompt = () => null;

const Ctrl = await import('../js/modules/controller.js');
const db = await import('../js/modules/db.js');

assert.equal(Object.values(db.DB).flatMap(value => Array.isArray(value) ? value : []).some(item => ['Sole','Pioggia','Freddo'].includes(item?.cat)), false, 'weather conditions must not become item categories');
const longTripWarning = db.WARNINGS.at(-1);
assert.equal(longTripWarning.check({ config: { nights: 7, laundry: false } }), true, 'long-trip warning must appear above six nights without laundry');
assert.equal(longTripWarning.check({ config: { nights: 6, laundry: false } }), false, 'long-trip warning must stay hidden at six nights');
assert.equal(longTripWarning.check({ config: { nights: 7, laundry: true } }), false, 'long-trip warning must stay hidden when laundry is active');

const powerbank = db.DB.base.find(item => item.n === 'Powerbank');
powerbank.transportModes = ['car'];
Ctrl.setConfig({ transport: 'moto' });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), false, 'items incompatible with the selected transport must be excluded');
Ctrl.setConfig({ transport: 'auto' });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), true, 'items compatible with the selected transport must be included');
powerbank.transportModes = ['walking'];
Ctrl.setConfig({ transports: ['motorcycle', 'walking'] });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), true, 'an item must be included when at least one selected transport matches');
delete powerbank.transportModes;

powerbank.weatherModes = ['rain'];
Ctrl.setConfig({ transport: 'auto', weather: ['sun'] });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), false, 'items incompatible with the selected weather must be excluded');
Ctrl.setConfig({ weather: ['sun', 'rain'] });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Powerbank'), true, 'an item must be included when at least one selected weather matches');
delete powerbank.weatherModes;
Ctrl.setConfig({ weather: [] });

const pants = db.DB.base.find(item => item.n === 'Pantaloni casual');
pants.quantityRule = { type: 'perDay', base: 1, every: 3, min: 1, max: 0, laundry: true };
Ctrl.setConfig({ nights: 5, transport: 'auto', laundry: false });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Pantaloni casual').q, 2, 'six travel days with one item every three days must produce two items');
const underwearRule = db.DB.base.find(item => item.n === 'Mutande');
underwearRule.quantityRule = { type: 'perDay', base: 1, every: 1, min: 1, max: 0, laundry: true };
Ctrl.setConfig({ nights: 9, laundry: true, laundryFreq: 4, laundryBuffer: 1 });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 4, 'laundry frequency and buffer must account for underwear worn at departure');
Ctrl.setConfig({ nights: 1, laundry: false });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 1, 'one night must not pack two underwear when one is worn at departure');
delete pants.quantityRule;
delete underwearRule.quantityRule;
Ctrl.setConfig({ laundry: false });

Ctrl.toggleWeather('sun');
Ctrl.toggleWeather('rain');
Ctrl.toggleWeather('cold');
Ctrl.toggleActivity('citta');
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.n === 'Zainetto urbano'), true, 'city activity must add urban travel items');
Ctrl.toggleActivity('citta');
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
assert.equal(underwear.q, 15);
Ctrl.toggleLaundry();
underwear = Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande');
assert.equal(underwear.q, 3, 'laundry must reduce daily clothes and account for departure-worn underwear');
Ctrl.setConfig({ nights: 6, laundry: false, laundryFreq: 3, laundryBuffer: 0 });
Ctrl.generateList();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 6, 'without laundry daily clothes must cover travel days minus the departure-worn item');
Ctrl.toggleLaundry();
assert.equal(Object.values(db.STATE.list).flat().find(item => item.n === 'Mutande').q, 2, 'with laundry and zero buffer daily clothes must account for the departure-worn item');

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
printCalled = false;
navigator.onLine = false;
const originalPrint = window.print;
delete window.print;
window.jspdf = { jsPDF: class BrokenPdf { constructor() { throw new Error('PDF engine unavailable'); } } };
clipboardText = '';
assert.equal(await Ctrl.exportPDF(), true, 'PDF failures must fall back instead of throwing');
assert.match(clipboardText, /Packlist Pro/, 'PDF fallback must copy the list when printing is unavailable');
window.print = originalPrint;
navigator.onLine = true;
window.jspdf = null;
assert.equal(Ctrl.saveTemplate('Rio'), true);
assert.equal(db.STATE.listName, 'Rio', 'saved template name must become the list name');
assert.equal(JSON.parse(localStorage.getItem('packlist_state')).listName, 'Rio', 'list name must be persisted');
Ctrl.setConfig({ transport: 'car', transports: ['car', 'train'] });
const shareUrl = await Ctrl.createShareUrl();
assert.match(shareUrl, /^https:\/\/packlist\.example\/[#]b\./, 'new links must use the universally readable base64 format');
assert.doesNotMatch(shareUrl, /[?&]list=/, 'compact links must use the shorter hash format');
assert.match(shareUrl, /[#]b\./, 'multi-baggage shared state must remain compact');
const encodedShareState = shareUrl.split('#b.')[1];
const sharedPayload = JSON.parse(Buffer.from(encodedShareState, 'base64url').toString());
assert.equal(sharedPayload[0], 4, 'new links must use the unified multi-transport schema');
assert.deepEqual(sharedPayload[1][3], ['car', 'train'], 'shared links must include every selected transport');
const pdfShareUrl = await Ctrl.createPdfShareUrl();
assert.match(pdfShareUrl, /^https:\/\/packlist-pro\.vercel\.app\/#b\./, 'PDF links must use the public editable Packlist Pro URL');
const pdfSharedPayload = JSON.parse(Buffer.from(pdfShareUrl.split('#b.')[1], 'base64url').toString());
assert.deepEqual(pdfSharedPayload, sharedPayload, 'the PDF link must preserve the complete editable shared-list payload');
let execCopyCalls = 0;
document.execCommand = command => { execCopyCalls += 1; return command === 'copy'; };
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async () => { throw new Error('Clipboard permission denied'); } } }, configurable: true });
assert.equal(await Ctrl.shareList(), true, 'sharing must fall back when the Clipboard API rejects the write');
assert.equal(execCopyCalls, 1, 'sharing must use the legacy copy fallback after a Clipboard API failure');
let promptedShareUrl = '';
document.execCommand = () => false;
window.prompt = (_message, value) => { promptedShareUrl = value; };
Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
assert.equal(await Ctrl.shareList(), true, 'sharing must still provide the link when no copy API is available');
assert.equal(promptedShareUrl, shareUrl, 'manual fallback must expose the exact share URL');
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async value => { clipboardText = value; } } }, configurable: true });
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
assert.equal(pdfLink, pdfShareUrl, 'the entire PDF call-to-action must link to the public editable shared list');
assert.deepEqual(pdfLinkRegion, { x: 14, y: 278, width: 182, height: 12 }, 'the PDF link must cover the whole call-to-action row');
assert.equal(pdfTitle, 'Packlist Pro · Rio', 'the saved list name must appear in the PDF');
assert.match(pdfFilename, /^packlist_Rio_\d{4}-\d{2}-\d{2}\.pdf$/, 'the saved list name must appear in the PDF filename');
window.jspdf = null;

window.location = new URL(shareUrl);
assert.equal(await Ctrl.loadSharedListFromUrl(), true, 'shared multi-baggage list must load');
assert.deepEqual(db.STATE.baggages.map(bag => [bag.name, bag.limit]), [['Zaino 40L', 0], ['Trolley cabina', 10]], 'shared URL must preserve baggage names and limits');
assert.equal(Object.values(db.STATE.list).flat().some(item => item.baggageId === db.STATE.baggages[1].id), true, 'shared URL must preserve item baggage assignments');
assert.deepEqual(db.STATE.config.transports, ['car', 'train'], 'shared URL must preserve every selected transport');
const temporaryBag = Ctrl.addBaggage('Temporaneo');
assert.equal(Ctrl.deleteBaggage(temporaryBag.id, db.STATE.baggages[0].id), true, 'empty baggage can be deleted');

for (const filter of ['all', 'clothing', 'tech', 'essentials']) {
    Ctrl.setFilter(filter);
    assert.equal(db.STATE.filter, filter);
    assert.equal(JSON.parse(localStorage.getItem('packlist_state')).filter, filter, 'filters must be persisted');
}
Ctrl.setFilter('invalid-filter');
assert.equal(db.STATE.filter, 'all');
Ctrl.setFilter('clothing');
assert.equal(await Ctrl.copyList(), true);
assert.match(clipboardText, /Filtro: clothing/);
assert.doesNotMatch(clipboardText, /Caricabatterie USB-C/, 'copy must respect the active clothing filter');
db.setState({ list: {} });
Ctrl.setConfig({ gender: 'U', transports: ['car'], transport: 'car', weather: ['sun'], activities: ['trekking', 'speleo'] });
Ctrl.generateList();
const backupLight = Object.values(db.STATE.list).flat().find(item => item.n === 'Luce di backup');
assert.ok(backupLight, 'Speleo list should include Luce di backup before saving');
Ctrl.updateItemOptions(backupLight.uid, { quantity: 3, weight: backupLight.w, worn: backupLight.worn, bulky: backupLight.bulky, baggageId: backupLight.baggageId });
Ctrl.toggleItemChecked(backupLight.uid);
const wetBag = Object.values(db.STATE.list).flat().find(item => item.n === 'Sacchetto per vestiti bagnati');
assert.ok(wetBag, 'Speleo list should include wet-clothes bag before removal');
Ctrl.removeItem(wetBag.uid);
Ctrl.addCustomItem('Speleo', 'Talismano grotta', 12, 1, db.STATE.baggages[0]?.id);
assert.equal(Ctrl.saveTemplate('Speleo Lucia'), true, 'saving a full list snapshot must succeed');
const savedTemplate = JSON.parse(localStorage.getItem('packlist_templates'))['Speleo Lucia'];
assert.equal(savedTemplate.schemaVersion, 2, 'new saved lists must use snapshot schema');
assert.ok(savedTemplate.snapshot?.list, 'new saved lists must include a list snapshot');
db.setState({ list: {}, listName: '', config: { ...db.DEFAULT_CONFIG } });
assert.equal(Ctrl.loadTemplate('Speleo Lucia'), true, 'loading a saved snapshot must succeed');
const restoredItems = Object.values(db.STATE.list).flat();
const restoredLight = restoredItems.find(item => item.n === 'Luce di backup');
assert.equal(restoredLight?.q, 3, 'saved item quantity must be restored');
assert.equal(restoredLight?.checked, true, 'saved checked state must be restored');
assert.equal(restoredItems.some(item => item.n === 'Sacchetto per vestiti bagnati'), false, 'removed items must not reappear when loading a snapshot');
assert.ok(restoredItems.some(item => item.n === 'Talismano grotta' && item.custom), 'manual custom items must be restored');
assert.ok(db.STATE.config.activities.includes('speleo'), 'speleo activity must be restored from saved snapshots');
assert.equal(restoredItems.some(item => Number(item.q) <= 0), false, 'restored snapshot must not contain 0x items');
localStorage.setItem('packlist_templates', JSON.stringify({ Legacy: { gender: 'U', transport: 'car', transports: ['car'], weather: ['sun'], activities: ['forra_speleo'], nights: 0 } }));
assert.equal(Ctrl.loadTemplate('Legacy'), true, 'legacy settings-only templates must still load');
assert.deepEqual(db.STATE.config.activities, ['speleo'], 'legacy forra_speleo activity must migrate to speleo');
assert.ok(Object.values(db.STATE.list).flat().some(item => item.n === 'Luce di backup'), 'legacy templates without snapshots should regenerate using migrated speleo');
Ctrl.setFilter('all');
Ctrl.showStatsSummary();
assert.equal(elements.get('statsSummaryModal').classList.contains('visible'), true, 'stats must open a non-blocking modal');
assert.equal(alertCalled, false, 'stats must not use blocking native alert');
Ctrl.uncheckAll();
assert.equal(Object.values(db.STATE.list).flat().some(item => item.checked), false);
const removable = Object.values(db.STATE.list).flat()[0];
Ctrl.toggleItemChecked(removable.uid);
assert.equal(Ctrl.removeChecked(), 1, 'remove checked must remove exactly the selected item');
assert.equal(Object.values(db.STATE.list).flat().some(item => item.uid === removable.uid), false);
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
    copyListBtn: 'copyList', exportPdfBtn: 'exportPDF', exportCsvBtn: 'exportStatsCSV', shareListBtn: 'shareList', uncheckAllBtn: 'uncheckAll', removeCheckedBtn: 'removeChecked', showStatsBtn: 'showStatsSummary', resetSessionBtn: 'resetState'
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
assert.doesNotMatch(controller, /new CompressionStream/, 'new shared links must not require a compression API on the receiving browser');
assert.match(controller, /navigator\.share/);
assert.match(html, /data-weather="sun"/);
assert.match(html, /id="act-trekking" data-activity="trekking"/);
assert.match(html, /id="act-speleo" data-activity="speleo"/);
assert.match(html, /<span>Speleo<\/span>/);
assert.ok(Array.isArray(db.DB.extra.speleo), 'DB_DATA.extra.speleo must exist');
for (const requiredSpeleoItem of ['Luce di backup', 'Custodia impermeabile telefono', 'Cambio asciutto post escursione', 'Sacchetto per vestiti bagnati']) {
    assert.ok(db.DB.extra.speleo.some(item => item.n === requiredSpeleoItem), `Speleo must include ${requiredSpeleoItem}`);
}
db.setState({ list: {} });
Ctrl.setConfig({ gender: 'U', transports: ['car'], transport: 'car', weather: ['sun'], activities: ['trekking', 'ferrata', 'speleo'] });
Ctrl.generateList();
const trekkingFerrataSpeleoItems = Object.values(db.STATE.list).flat().map(item => item.n);
for (const sharedName of ['Scarponi trekking', 'Calze trekking', 'Casco (ferrata/alpinismo)', 'Guanti da ferrata', 'Torcia frontale', 'Borraccia', 'Kit primo soccorso', 'Snack energetici', 'Mappa/GPS', 'Coperta termica']) {
    assert.ok(trekkingFerrataSpeleoItems.includes(sharedName), `${sharedName} must be generated for Trekking/Ferrata/Speleo`);
    assert.equal(trekkingFerrataSpeleoItems.filter(name => name === sharedName).length, 1, `${sharedName} must not be duplicated`);
}
assert.doesNotMatch(`${app}\n${readFileSync(new URL('../js/modules/ui.js', import.meta.url), 'utf8')}`, /renderActivities/);

console.log('Packlist Pro interaction smoke test passed');
