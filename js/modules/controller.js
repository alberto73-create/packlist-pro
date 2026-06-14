// js/modules/controller.js - Logica di Controllo Packlist Pro v9.5 Fixed
// Architettura STATE-based con gestione completa della lista

import { STATE, setState, DEFAULT_CONFIG, DB, DAYTRIP_EXCLUDE, WARNINGS } from './db.js';
import { U } from './utils.js';
import * as View from './ui.js';

/**
 * Calcola le quantità degli item in base alla configurazione
 */
function calculateQty(item, config) {
    const nights = Math.max(0, Number(config.nights) || 0);
    const totalDays = nights + 1;
    const legacyRule = item.q === 'n'
        ? { type: 'perDay', base: 1, every: 1, min: 1, max: 0, laundry: true }
        : { type: 'fixed', base: 1, every: 1, min: 1, max: 0, laundry: false };
    const rule = { ...legacyRule, ...(item.quantityRule || {}) };

    if (nights === 0) {
        if (DAYTRIP_EXCLUDE.has(item.n)) return 0;
        return Math.max(1, Number(rule.min) || 1);
    }

    let coveredDays = totalDays;
    if (config.laundry && rule.laundry) {
        coveredDays = Math.min(totalDays, Math.max(1, Number(config.laundryFreq) || 3) + Math.max(0, Number(config.laundryBuffer) || 0));
    }
    let qty = rule.type === 'fixed'
        ? Math.max(1, Number(rule.base) || 1)
        : Math.ceil(coveredDays / Math.max(1, Number(rule.every) || 1)) * Math.max(1, Number(rule.base) || 1);
    qty = Math.max(Math.max(0, Number(rule.min) || 0), qty);
    if (Number(rule.max) > 0) qty = Math.min(qty, Number(rule.max));
    return qty;
}

function isTransportCompatible(item, transport) {
    const modes = Array.isArray(item.transportModes) && item.transportModes.length ? item.transportModes : ['tutti'];
    return modes.includes('tutti') || modes.includes(transport);
}

/**
 * Genera la lista completa dagli item del database
 */
export function generateList() {
    const config = STATE.config;
    const previousItems = new Map(
        Object.values(STATE.list).flat().filter(item => !item.custom).map(item => [itemKey(item.cat, item.n), item])
    );
    const customItems = Object.values(STATE.list).flat().filter(item => item.custom);
    const newList = {};
    
    // 1. Item base (sempre inclusi)
    for (const item of DB.base) {
        if (!isTransportCompatible(item, config.transport)) continue;
        const qty = calculateQty(item, config);
        if (qty <= 0) continue;
        
        // Filtro gender
        if (item.s !== 'U' && item.s !== config.gender) continue;
        
        addGeneratedItem(newList, item, qty, previousItems);
    }
    
    // 2. Item lavanderia (se attiva)
    if (config.laundry && config.nights > 0) {
        for (const item of DB.laundry) {
            if (!isTransportCompatible(item, config.transport)) continue;
            addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
        }
    }
    
    // 3. Item meteo
    for (const weatherType of config.weather) {
        const items = DB.weather[weatherType] || [];
        for (const item of items) {
            if (!isTransportCompatible(item, config.transport)) continue;
            addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
        }
    }
    
    // 4. Item trasporto
    const transportItems = DB.transport[config.transport === 'trekking' ? 'backpack' : config.transport] || [];
    for (const item of transportItems) {
        if (!isTransportCompatible(item, config.transport)) continue;
        addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
    }
    
    // 5. Item attività extra
    for (const actId of config.activities) {
        const items = DB.extra[actId] || [];
        for (const item of items) {
            if (!isTransportCompatible(item, config.transport)) continue;
            const qty = calculateQty(item, config);
            if (qty <= 0) continue;
            addGeneratedItem(newList, item, qty, previousItems);
        }
    }
    
    // Gli item personali e lo stato di packing non devono andare persi quando cambia la configurazione.
    for (const item of customItems) {
        if (!newList[item.cat]) newList[item.cat] = [];
        newList[item.cat].push(item);
    }

    // Aggiorna stato e UI
    setState({ list: newList });
    View.list(STATE, U);
    View.stats(STATE, U);
    updateWarnings();
    saveState();
    
    return newList;
}

/**
 * Aggiunge un item a una categoria
 */
function itemKey(cat, name) {
    return `${cat}\u0000${name}`;
}

function addGeneratedItem(list, item, qty, previousItems) {
    const previous = previousItems.get(itemKey(item.cat, item.n));
    addToCategory(list, item.cat, {
        ...item,
        q: qty,
        uid: previous?.uid || U.uid(),
        w: previous?.w ?? item.w,
        checked: previous?.checked || false,
        worn: previous?.worn ?? false,
        bulky: previous?.bulky ?? false,
        baggageId: previous?.baggageId || STATE.baggages[0]?.id || 'b1',
        custom: false
    });
}

function addToCategory(list, cat, item) {
    if (!list[cat]) list[cat] = [];
    // Evita duplicati basati sul nome
    const exists = list[cat].some(i => i.n === item.n);
    if (!exists) {
        list[cat].push(item);
    }
}

/**
 * Aggiorna gli avvisi in base alla configurazione
 */
function updateWarnings() {
    const warningContainer = document.getElementById('warningsBox');
    if (!warningContainer) return;
    
    warningContainer.innerHTML = '';
    
    for (const warning of WARNINGS) {
        if (warning.check(STATE)) {
            const div = document.createElement('div');
            div.className = 'warning-msg';
            div.textContent = warning.msg;
            warningContainer.appendChild(div);
        }
    }
}

/**
 * Toggle checkbox item
 */
export function toggleItemChecked(uid) {
    for (const cat in STATE.list) {
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (item) {
            item.checked = !item.checked;
            View.updateItemRow(uid, item.checked);
            View.stats(STATE, U);
            saveState();
            return item.checked;
        }
    }
    return false;
}

/**
 * Toggle worn status
 */
export function toggleWorn(uid) {
    for (const cat in STATE.list) {
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (item) {
            item.worn = !item.worn;
            View.applyWornStatus(uid, item.worn);
            View.stats(STATE, U);
            saveState();
            return item.worn;
        }
    }
    return false;
}

export function updateItemOptions(uid, { quantity, weight, worn, bulky, baggageId }) {
    for (const cat in STATE.list) {
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (!item) continue;
        item.q = Math.max(1, Math.min(99, Number.parseInt(quantity, 10) || 1));
        item.w = Math.max(1, Math.min(50000, Number.parseInt(weight, 10) || item.w || 100));
        item.worn = Boolean(worn);
        item.bulky = Boolean(bulky);
        if (STATE.baggages.some(bag => bag.id === baggageId)) item.baggageId = baggageId;
        View.list(STATE, U);
        View.stats(STATE, U);
        saveState();
        return true;
    }
    return false;
}

/**
 * Rimuove un item dalla lista
 */
export function removeItem(uid) {
    for (const cat in STATE.list) {
        const idx = STATE.list[cat].findIndex(i => i.uid === uid);
        if (idx >= 0) {
            const removed = STATE.list[cat].splice(idx, 1)[0];
            setState({ lastRemoved: { cat, item: removed, idx } });
            
            if (STATE.list[cat].length === 0) delete STATE.list[cat];
            View.list(STATE, U);
            View.stats(STATE, U);
            saveState();
            return true;
        }
    }
    return false;
}

/**
 * Aggiunge un item custom
 */
export function addCustomItem(cat, name, weight = 100, volume = 1, baggageId = STATE.baggages[0]?.id) {
    if (!name.trim()) return null;
    
    const item = {
        n: name.trim(),
        q: 1,
        cat: cat,
        s: 'U',
        w: parseInt(weight) || 100,
        v: parseInt(volume) || 1,
        uid: U.uid(),
        custom: true,
        checked: false,
        worn: false,
        bulky: false,
        baggageId: STATE.baggages.some(bag => bag.id === baggageId) ? baggageId : STATE.baggages[0]?.id || 'b1'
    };
    
    if (!STATE.list[cat]) STATE.list[cat] = [];
    STATE.list[cat].push(item);
    
    View.list(STATE, U);
    View.stats(STATE, U);
    saveState();
    
    return item;
}

/**
 * Modifica il peso di un item
 */
export function editItemWeight(uid, newWeight) {
    for (const cat in STATE.list) {
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (item) {
            item.w = parseInt(newWeight) || 100;
            View.list(STATE, U); // Rerender per aggiornare peso visualizzato
            View.stats(STATE, U);
            saveState();
            return true;
        }
    }
    return false;
}

const STATE_STORAGE_KEY = 'packlist_state';
const STATE_BACKUP_KEY = 'packlist_state_backup';

/**
 * Salva lo stato mantenendo anche l'ultima copia valida per gli aggiornamenti PWA.
 */
export function saveState() {
    try {
        const previous = localStorage.getItem(STATE_STORAGE_KEY);
        if (previous) localStorage.setItem(STATE_BACKUP_KEY, previous);
        const toSave = {
            schema: 1,
            config: STATE.config,
            list: STATE.list,
            listName: STATE.listName,
            baggages: STATE.baggages,
            baggageSetup: STATE.baggageSetup,
            filter: STATE.filter
        };
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(toSave));
        return true;
    } catch (e) {
        console.warn('[Controller] Salvataggio fallito:', e);
        return false;
    }
}

function normalizeBaggages(baggages = []) {
    const normalized = (Array.isArray(baggages) ? baggages : []).map((bag, index) => ({
        id: String(bag?.id || `b${index + 1}`),
        name: String(bag?.name || `Bagaglio ${index + 1}`).trim() || `Bagaglio ${index + 1}`,
        limit: Math.max(0, Number(bag?.limit) || 0)
    }));
    return normalized.length ? normalized : [{ id: 'b1', name: 'Bagaglio 1', limit: 0 }];
}

function normalizeList(list = {}, baggages = STATE.baggages) {
    if (!list || typeof list !== 'object' || Array.isArray(list)) return {};
    const validIds = new Set(normalizeBaggages(baggages).map(bag => bag.id));
    const fallbackId = normalizeBaggages(baggages)[0].id;
    return Object.fromEntries(Object.entries(list).map(([cat, items]) => [cat, (Array.isArray(items) ? items : []).map(item => ({
        ...item,
        q: Math.max(1, Number.parseInt(item.q, 10) || 1),
        w: Math.max(1, Number.parseInt(item.w, 10) || 100),
        worn: Boolean(item.worn),
        bulky: Boolean(item.bulky),
        baggageId: validIds.has(item.baggageId) ? item.baggageId : fallbackId
    }))]));
}

function parseStoredState(value) {
    if (!value) return null;
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const baggages = normalizeBaggages(parsed.baggages);
    return {
        config: normalizeConfig(parsed.config),
        list: normalizeList(parsed.list, baggages),
        listName: String(parsed.listName || '').trim(),
        baggages,
        baggageSetup: Boolean(parsed.baggageSetup),
        filter: parsed.filter || 'all'
    };
}

/**
 * Carica lo stato principale o, se non leggibile dopo un aggiornamento, la copia di sicurezza.
 */
export function loadState() {
    for (const key of [STATE_STORAGE_KEY, STATE_BACKUP_KEY]) {
        try {
            const restored = parseStoredState(localStorage.getItem(key));
            if (!restored) continue;
            setState(restored);
            if (key === STATE_BACKUP_KEY) {
                localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({ schema: 1, ...restored }));
                U.toast('Lista ripristinata dopo l’aggiornamento');
            }
            return true;
        } catch (e) {
            console.warn(`[Controller] Stato non leggibile (${key}):`, e);
        }
    }
    return false;
}

/**
 * Reset completo dello stato
 */
export function resetState() {
    localStorage.removeItem(STATE_STORAGE_KEY);
    localStorage.removeItem(STATE_BACKUP_KEY);
    setState({
        config: { ...DEFAULT_CONFIG },
        list: {},
        listName: '',
        baggages: [{ id: 'b1', name: 'Bagaglio 1', limit: 0 }],
        baggageSetup: false,
        lastRemoved: null,
        filter: 'all'
    });
    updateConfigUI();
    View.updateFilterUI('all');
    View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    View.stats(STATE, U);
    updateWarnings();
    View.openBaggageSetup();
    U.toast('Sessione resettata');
}

/**
 * Imposta un filtro sulla lista
 */
export function setFilter(filterType) {
    const filter = filterType === 'all' || FILTER_MAP_KEYS.has(filterType) ? filterType : 'all';
    setState({ filter });
    View.updateFilterUI(filter);
    View.list(STATE, U);
    saveState();
}

/**
 * Cerca nella lista
 */
export function searchItems(term) {
    View.filterListBySearch(term);
}


export function configureBaggages(names) {
    const cleanNames = (Array.isArray(names) ? names : []).map(name => String(name).trim()).filter(Boolean).slice(0, 12);
    const baggages = (cleanNames.length ? cleanNames : ['Bagaglio 1']).map((name, index) => ({ id: `b${Date.now().toString(36)}-${index}`, name, limit: 0 }));
    const firstId = baggages[0].id;
    getAllItems().forEach(item => { item.baggageId = firstId; });
    setState({ baggages, baggageSetup: true });
    View.list(STATE, U); View.stats(STATE, U); saveState();
    return baggages;
}

export function addBaggage(name = '') {
    const index = STATE.baggages.length + 1;
    const bag = { id: `b${Date.now().toString(36)}-${index}`, name: String(name).trim() || `Bagaglio ${index}`, limit: 0 };
    setState({ baggages: [...STATE.baggages, bag], baggageSetup: true });
    View.list(STATE, U); saveState(); return bag;
}

export function updateBaggage(id, { name, limit }) {
    const bag = STATE.baggages.find(entry => entry.id === id); if (!bag) return false;
    bag.name = String(name || bag.name).trim() || bag.name;
    bag.limit = Math.max(0, Number(limit) || 0);
    View.list(STATE, U); View.stats(STATE, U); saveState(); return true;
}

export function moveAllBaggageItems(fromId, toId) {
    if (fromId === toId || !STATE.baggages.some(bag => bag.id === toId)) return false;
    getAllItems().filter(item => item.baggageId === fromId).forEach(item => { item.baggageId = toId; });
    View.list(STATE, U); View.stats(STATE, U); saveState(); return true;
}

export function deleteBaggage(id, moveToId = null) {
    if (STATE.baggages.length <= 1) return false;
    if (moveToId && !STATE.baggages.some(bag => bag.id === moveToId && bag.id !== id)) return false;
    for (const cat of Object.keys(STATE.list)) {
        if (moveToId) STATE.list[cat].forEach(item => { if (item.baggageId === id) item.baggageId = moveToId; });
        else STATE.list[cat] = STATE.list[cat].filter(item => item.baggageId !== id);
        if (!STATE.list[cat].length) delete STATE.list[cat];
    }
    setState({ baggages: STATE.baggages.filter(bag => bag.id !== id) });
    View.list(STATE, U); View.stats(STATE, U); saveState(); return true;
}

const TEMPLATE_KEY = 'packlist_templates';
const FILTER_MAP_KEYS = new Set(['clothing', 'tech', 'essentials']);

function getTemplates() {
    try {
        return JSON.parse(localStorage.getItem(TEMPLATE_KEY) || '{}');
    } catch (e) {
        console.warn('[Controller] Lettura template fallita:', e);
        return {};
    }
}

function saveTemplates(templates) {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(templates));
}

function getAllItems() {
    return Object.values(STATE.list).flat();
}

export function loadTemplateDropdown() {
    View.loadTemplateDropdown(getTemplates);
}

export function saveTemplate(name) {
    const cleanName = name.trim();
    if (!cleanName) {
        U.toast('Inserisci un nome per il template');
        return false;
    }

    const templates = getTemplates();
    templates[cleanName] = { ...STATE.config };
    setState({ listName: cleanName });
    saveTemplates(templates);
    saveState();
    loadTemplateDropdown();

    const input = document.getElementById('templateName');
    if (input) input.value = '';
    U.toast(`Template "${cleanName}" salvato`);
    return true;
}

export function loadTemplate(name) {
    const template = getTemplates()[name];
    if (!template) {
        U.toast('Template non trovato');
        return false;
    }

    setConfig({ ...DEFAULT_CONFIG, ...template });
    setState({ listName: name.trim() });
    const nights = document.getElementById('nights');
    const gender = document.getElementById('gender');
    const transport = document.getElementById('transport');
    const laundryFreq = document.getElementById('laundryFreq');
    const laundryBuffer = document.getElementById('laundryBuffer');

    if (nights) nights.value = STATE.config.nights;
    if (gender) gender.value = STATE.config.gender;
    if (transport) transport.value = STATE.config.transport;
    if (laundryFreq) laundryFreq.value = STATE.config.laundryFreq;
    if (laundryBuffer) laundryBuffer.value = STATE.config.laundryBuffer;

    generateList();
    U.toast(`Template "${name}" caricato`);
    return true;
}

export function deleteTemplate(name) {
    const templates = getTemplates();
    if (!templates[name]) return false;

    delete templates[name];
    saveTemplates(templates);
    loadTemplateDropdown();
    U.toast(`Template "${name}" eliminato`);
    return true;
}

export function uncheckAll() {
    getAllItems().forEach(item => {
        item.checked = false;
    });
    View.list(STATE, U);
    View.stats(STATE, U);
    saveState();
    U.toast('Spunte azzerate');
}

export async function copyList() {
    const all = getAllItems();
    if (!all.length) {
        U.toast('Nessuna lista da copiare');
        return false;
    }

    const lines = [STATE.listName ? `Packlist Pro · ${STATE.listName}` : 'Packlist Pro', ''];
    STATE.baggages.forEach(bag => {
        const bagItems = getAllItems().filter(item => item.baggageId === bag.id);
        if (!bagItems.length) return;
        lines.push(`🎒 ${bag.name}`);
        Object.entries(STATE.list).forEach(([cat, items]) => {
            const assigned = items.filter(item => item.baggageId === bag.id);
            if (!assigned.length) return;
            lines.push(cat);
            assigned.forEach(item => {
                const check = item.checked ? '✓' : '□';
                const worn = item.worn ? ' (indossato)' : '';
                lines.push(`${check} ${item.q}x ${item.n}${worn}`);
            });
        });
        lines.push('');
    });

    const text = lines.join('\n').trim();
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        const area = document.createElement('textarea');
        area.value = text;
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        area.remove();
    }
    U.toast('Lista copiata');
    return true;
}

export function showStatsSummary() {
    const all = getAllItems();
    if (!all.length) {
        U.toast('Nessuna statistica disponibile');
        return;
    }

    const done = all.filter(i => i.checked).length;
    const wornG = all.filter(i => i.worn).reduce((s, i) => s + (i.w || 100) * i.q, 0);
    const totalG = all.reduce((s, i) => s + (i.w || 100) * i.q, 0);
    const suitcaseG = all.filter(i => !i.worn).reduce((s, i) => s + (i.w || 100) * i.q, 0);

    const baggageLines = STATE.baggages.map(bag => {
        const weight = all.filter(item => item.baggageId === bag.id && !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
        return `${bag.name}: ${U.weight(weight)}${bag.limit ? ` / ${bag.limit} kg` : ''}`;
    });
    alert([
        '📊 Statistiche Packlist',
        `Item: ${done}/${all.length}`,
        `Peso totale: ${U.weight(totalG)}`,
        `In valigia: ${U.weight(suitcaseG)}`,
        `Indossato: ${U.weight(wornG)}`,
        '', 'Bagagli:', ...baggageLines
    ].join('\n'));
}

export async function exportPDF() {
    const all = getAllItems();
    if (!all.length) {
        U.toast('Nessuna lista da esportare');
        return false;
    }

    const jsPDF = window.jspdf?.jsPDF;
    if (!jsPDF) {
        U.toast('Modulo PDF non disponibile: apro la stampa per salvare come PDF');
        window.print();
        return true;
    }

    const doc = new jsPDF();
    const listName = String(STATE.listName || '').trim();
    const documentTitle = listName ? `Packlist Pro · ${listName}` : 'Packlist Pro';
    doc.setFontSize(18);
    doc.text(documentTitle, 14, 18);
    doc.setFontSize(10);
    doc.text(`${STATE.config.nights} notti · ${STATE.config.transport}`, 14, 26);

    let nextY = 34;
    for (const bag of STATE.baggages) {
        const rows = [];
        Object.entries(STATE.list).forEach(([cat, items]) => {
            items.filter(item => item.baggageId === bag.id).forEach(item => rows.push([
                cat, item.n, `${item.q}`, U.weight((item.w || 100) * item.q), item.checked ? 'Sì' : 'No', item.worn ? 'Sì' : 'No'
            ]));
        });
        if (!rows.length) continue;
        const bagWeight = getAllItems().filter(item => item.baggageId === bag.id && !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
        if (nextY > 248) { doc.addPage(); nextY = 20; }
        doc.setFontSize(12); doc.setTextColor?.(17, 24, 39);
        doc.text(`${bag.name} · ${U.weight(bagWeight)}${bag.limit ? ` / limite ${bag.limit} kg` : ''}`, 14, nextY);
        if (typeof doc.autoTable === 'function') {
            doc.autoTable({ head: [['Categoria', 'Item', 'Qtà', 'Peso', 'Preso', 'Indossato']], body: rows, startY: nextY + 4, margin: { bottom: 24 }, styles: { fontSize: 8 } });
            nextY = (doc.lastAutoTable?.finalY || nextY + rows.length * 6 + 12) + 10;
        } else {
            nextY += 7;
            rows.forEach(row => { if (nextY > 268) { doc.addPage(); nextY = 20; } doc.text(row.join(' · '), 14, nextY); nextY += 6; });
            nextY += 6;
        }
    }

    const shareUrl = await createShareUrl();
    const pageCount = doc.getNumberOfPages?.() || 1;
    const cta = { x: 14, y: 278, width: 182, height: 12 };
    for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage?.(page);
        doc.setFillColor?.(90, 103, 242);
        doc.roundedRect?.(cta.x, cta.y, cta.width, cta.height, 3, 3, 'F');
        doc.setFillColor?.(255, 255, 255);
        doc.roundedRect?.(cta.x + 4, cta.y + 2.5, 7, 6.5, 1.4, 1.4, 'F');
        doc.setFillColor?.(139, 92, 246);
        doc.roundedRect?.(cta.x + 5.2, cta.y + 4.1, 4.6, 4.1, 1, 1, 'F');
        doc.setFontSize(9);
        doc.setTextColor?.(255, 255, 255);
        doc.text('Clicca qui per modificare gratuitamente la tua lista', cta.x + 15, cta.y + 7.5);
        if (typeof doc.link === 'function') doc.link(cta.x, cta.y, cta.width, cta.height, { url: shareUrl });
        else if (typeof doc.textWithLink === 'function') doc.textWithLink('Apri la lista', cta.x + 15, cta.y + 7.5, { url: shareUrl });
    }

    const safeName = listName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
    const namePart = safeName ? `_${safeName}` : '';
    doc.save(`packlist${namePart}_${new Date().toISOString().slice(0, 10)}.pdf`);
    U.toast('PDF esportato');
    return true;
}

/**
 * Esporta statistiche CSV
 */
export function exportStatsCSV() {
    const all = Object.values(STATE.list).flat();
    if (!all.length) {
        U.toast('Nessun dato da esportare');
        return;
    }
    
    const headers = ['Bagaglio', 'Categoria', 'Item', 'Quantità', 'Peso (g)', 'Volume', 'Preso', 'Indossato'];
    const rows = all.map(item => [
        STATE.baggages.find(bag => bag.id === item.baggageId)?.name || 'Bagaglio 1',
        item.cat,
        item.n,
        item.q,
        item.w,
        item.v,
        item.checked ? 'Sì' : 'No',
        item.worn ? 'Sì' : 'No'
    ]);
    
    const csvCell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `packlist_stats_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    U.toast('Statistiche esportate!');
}

/**
 * Inizializza i listener per gli eventi
 */

function bytesToBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value) {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
    return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}

async function encodeSharedState(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    if (typeof CompressionStream === 'undefined') return `b.${bytesToBase64Url(bytes)}`;
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return `g.${bytesToBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()))}`;
}

async function decodeSharedState(value) {
    const [format, payload] = value.split('.', 2);
    let bytes = base64UrlToBytes(payload || '');
    if (format === 'g') {
        if (typeof DecompressionStream === 'undefined') throw new Error('Compressione URL non supportata');
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return JSON.parse(new TextDecoder().decode(bytes));
}

function compactItem(item, baggageIndexes) {
    const values = [item.n, item.q, item.w, item.checked ? 1 : 0, item.worn ? 1 : 0, item.bulky ? 1 : 0, item.custom ? 1 : 0, baggageIndexes.get(item.baggageId) || 0];
    while (values[values.length - 1] === 0) values.pop();
    return values;
}

function compactSharedState() {
    const config = STATE.config;
    const baggageIndexes = new Map(STATE.baggages.map((bag, index) => [bag.id, index]));
    return [
        3,
        [config.nights, config.gender, config.transport, config.weather, config.activities, config.laundry ? 1 : 0, config.laundryFreq, config.laundryBuffer],
        STATE.listName || '',
        STATE.baggages.map(bag => [bag.name, bag.limit || 0]),
        Object.entries(STATE.list).map(([cat, items]) => [cat, items.map(item => compactItem(item, baggageIndexes))])
    ];
}

function expandSharedState(shared) {
    if (Array.isArray(shared) && shared[0] === 3) {
        const config = shared[1] || [];
        const baggages = normalizeBaggages((shared[3] || []).map((bag, index) => ({ id: `b${index + 1}`, name: bag[0], limit: bag[1] })));
        return { c: { nights: config[0], gender: config[1], transport: config[2], weather: config[3], activities: config[4], laundry: Boolean(config[5]), laundryFreq: config[6], laundryBuffer: config[7] }, n: String(shared[2] || '').trim(), b: baggages, l: shared[4] };
    }
    if (Array.isArray(shared) && shared[0] === 2) {
        const config = shared[1] || [];
        return { c: { nights: config[0], gender: config[1], transport: config[2], weather: config[3], activities: config[4], laundry: Boolean(config[5]), laundryFreq: config[6], laundryBuffer: config[7] }, l: shared[2], n: String(shared[3] || '').trim(), b: normalizeBaggages([]) };
    }
    if (shared?.v === 1) return { c: shared.c, l: shared.l, n: String(shared.n || '').trim(), b: normalizeBaggages(shared.b) };
    throw new Error('Formato lista non valido');
}

export async function createShareUrl() {
    const url = new URL(window.location.href);
    url.search = '';
    if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
    url.hash = await encodeSharedState(compactSharedState());
    return url.toString();
}

export async function shareList() {
    if (!getAllItems().length) {
        U.toast('Nessuna lista da condividere');
        return false;
    }
    const url = await createShareUrl();
    if (navigator.share) {
        try {
            await navigator.share({ title: STATE.listName ? `Packlist Pro · ${STATE.listName}` : 'Packlist Pro', text: 'Ecco la mia lista di viaggio', url });
            return true;
        } catch (error) {
            if (error?.name === 'AbortError') return false;
            console.warn('[Controller] Web Share non disponibile, uso gli appunti:', error);
        }
    }
    try {
        await navigator.clipboard.writeText(url);
        U.toast('Link della lista copiato negli appunti');
        return true;
    } catch (error) {
        console.warn('[Controller] Copia link fallita:', error);
        U.toast('Impossibile condividere la lista');
        return false;
    }
}

export async function loadSharedListFromUrl() {
    const url = new URL(window.location.href);
    const encoded = url.hash.slice(1) || url.searchParams.get('list');
    if (!encoded) return false;
    try {
        const shared = expandSharedState(await decodeSharedState(encoded));
        if (!Array.isArray(shared.l)) throw new Error('Formato lista non valido');
        const baggages = normalizeBaggages(shared.b);
        const list = Object.fromEntries(shared.l.map(([cat, items]) => [String(cat), items.map((values) => ({
            n: String(values[0]), q: Math.max(1, Number(values[1]) || 1), w: Math.max(1, Number(values[2]) || 100),
            checked: Boolean(values[3]), worn: Boolean(values[4]), bulky: Boolean(values[5]), custom: Boolean(values[6]),
            cat: String(cat), s: 'U', v: 1, uid: U.uid(), baggageId: baggages[Number(values[7]) || 0]?.id || baggages[0].id
        }))]));
        setState({ config: normalizeConfig(shared.c), list: normalizeList(list, baggages), listName: shared.n || '', baggages, baggageSetup: true, filter: 'all' });
        saveState();
        url.searchParams.delete('list');
        url.hash = '';
        window.history.replaceState({}, '', url);
        U.toast('Lista condivisa importata');
        return true;
    } catch (error) {
        console.warn('[Controller] Link condiviso non valido:', error);
        U.toast('Impossibile importare la lista condivisa');
        return false;
    }
}

export function setupEventDelegation() {
    const results = document.getElementById('results');
    if (!results) return;
    
    results.addEventListener('click', (e) => {
        const target = e.target;

        // Bottone add custom: si trova fuori da .item-row, quindi va gestito prima.
        if (target.closest('[data-action="add"]')) {
            const addRow = target.closest('.add-custom');
            const category = addRow?.closest('.cat-box')?.dataset.cat;
            const input = addRow?.querySelector('input');
            const baggageId = addRow?.closest('.baggage-section')?.dataset.baggageId;
            if (category && input?.value.trim()) {
                addCustomItem(category, input.value, 100, 1, baggageId);
                input.value = '';
            }
            return;
        }

        const row = target.closest('.item-row');
        if (!row) return;
        
        const uid = row.dataset.uid;
        const cat = row.dataset.cat;
        
        if (target.closest('[data-action="options"]')) {
            const item = STATE.list[cat]?.find(i => i.uid === uid);
            View.openItemOptions(item, STATE.baggages, U);
            return;
        }
        
        // Bottone delete - usa data-action
        if (target.closest('[data-action="del"]')) {
            if (confirm('Eliminare questo item?')) {
                removeItem(uid);
            }
            return;
        }
        
        // Checkbox toggle: .item-content ha pointer-events:none, quindi spesso
        // il target reale è direttamente la .item-row. Escludiamo solo azioni e campi.
        if (!target.closest('.item-actions, button, input, select, textarea, .add-custom')) {
            toggleItemChecked(uid);
            return;
        }
    });
    
    // Keyboard navigation
    results.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target.matches('.add-custom input')) {
            const addRow = e.target.closest('.add-custom');
            const category = addRow?.closest('.cat-box')?.dataset.cat;
            const baggageId = addRow?.closest('.baggage-section')?.dataset.baggageId;
            if (category && e.target.value.trim()) {
                e.preventDefault();
                addCustomItem(category, e.target.value, 100, 1, baggageId);
                e.target.value = '';
            }
            return;
        }

        if (e.key === 'Enter' || e.key === ' ') {
            const row = e.target.closest('.item-row');
            if (row && !e.target.closest('button, input, select, textarea')) {
                e.preventDefault();
                toggleItemChecked(row.dataset.uid);
            }
        }
    });
}

/**
 * Aggiorna l'UI in base alla configurazione corrente
 */
export function updateConfigUI() {
    const config = STATE.config;

    const nights = document.getElementById('nights');
    const gender = document.getElementById('gender');
    const transport = document.getElementById('transport');
    const laundryFreq = document.getElementById('laundryFreq');
    const laundryBuffer = document.getElementById('laundryBuffer');

    if (nights) nights.value = config.nights;
    if (gender) gender.value = config.gender;
    if (transport) transport.value = config.transport;
    if (laundryFreq) laundryFreq.value = config.laundryFreq;
    if (laundryBuffer) laundryBuffer.value = config.laundryBuffer;
    
    // Banner daytrip
    View.updateDaytripBanner(config.nights === 0);
    
    // Toggle lavanderia
    View.updateLaundryToggle(config.laundry);
    const laundryInfo = document.getElementById('laundryInfo');
    if (laundryInfo) {
        const totalDays = config.nights + 1;
        const laundryQty = Math.min(totalDays, config.laundryFreq + config.laundryBuffer);
        laundryInfo.textContent = config.laundry
            ? `Con lavaggio ogni ${config.laundryFreq} giorni: massimo ${laundryQty} capi per ogni elemento giornaliero.`
            : '';
        laundryInfo.classList.toggle('visible', config.laundry && config.nights > 0);
    }
    
    // Bottoni meteo
    View.updateWeatherButtons(config.weather);
    
    // Bottoni attività
    View.updateActivityButtons(config.activities);
}

/**
 * Imposta la configurazione
 */
function clampInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

function normalizeConfig(config = {}) {
    const normalized = { ...DEFAULT_CONFIG, ...STATE.config, ...config };
    normalized.weather = Array.isArray(normalized.weather) ? [...new Set(normalized.weather)] : [];
    normalized.activities = Array.isArray(normalized.activities) ? [...new Set(normalized.activities)] : [];
    normalized.nights = clampInteger(normalized.nights, DEFAULT_CONFIG.nights, 0, 90);
    normalized.laundryFreq = clampInteger(normalized.laundryFreq, DEFAULT_CONFIG.laundryFreq, 1, 14);
    normalized.laundryBuffer = clampInteger(normalized.laundryBuffer, DEFAULT_CONFIG.laundryBuffer, 0, 5);
    normalized.laundry = Boolean(normalized.laundry);
    if (normalized.transport === 'backpack') normalized.transport = 'trekking';
    return normalized;
}

export function setConfig(newConfig) {
    setState({ config: normalizeConfig(newConfig) });
    saveState();
    updateConfigUI();
}

/**
 * Attiva/disattiva un'attività
 */
export function toggleActivity(actId) {
    const activities = [...STATE.config.activities];
    const idx = activities.indexOf(actId);
    
    if (idx >= 0) {
        activities.splice(idx, 1);
    } else {
        activities.push(actId);
    }
    
    setConfig({ activities });
    // Rigenera la lista solo se è già stata generata
    if (Object.keys(STATE.list).length > 0) {
        generateList();
    }
}

/**
 * Attiva/disattiva meteo
 */
export function toggleWeather(weatherType) {
    const weather = [...STATE.config.weather];
    const idx = weather.indexOf(weatherType);
    
    if (idx >= 0) {
        weather.splice(idx, 1);
    } else {
        weather.push(weatherType);
    }
    
    setConfig({ weather });
    // Rigenera la lista solo se è già stata generata
    if (Object.keys(STATE.list).length > 0) {
        generateList();
    }
}

/**
 * Attiva/disattiva lavanderia
 */
export function toggleLaundry() {
    setConfig({ laundry: !STATE.config.laundry });
    // Rigenera la lista solo se è già stata generata
    if (Object.keys(STATE.list).length > 0) {
        generateList();
    }
}
