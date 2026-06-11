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

    if (nights === 0) {
        if (DAYTRIP_EXCLUDE.has(item.n)) return 0;
        return 1;
    }

    if (item.q === 'n') {
        if (!config.laundry) return totalDays;

        // Con lavanderia servono capi sufficienti fino al prossimo lavaggio,
        // più il buffer scelto, mai più dei giorni totali del viaggio.
        const laundryFreq = Math.max(1, Number(config.laundryFreq) || 3);
        const laundryBuffer = Math.max(0, Number(config.laundryBuffer) || 0);
        return Math.max(1, Math.min(totalDays, laundryFreq + laundryBuffer));
    }

    return 1;
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
        const qty = calculateQty(item, config);
        if (qty <= 0) continue;
        
        // Filtro gender
        if (item.s !== 'U' && item.s !== config.gender) continue;
        
        addGeneratedItem(newList, item, qty, previousItems);
    }
    
    // 2. Item lavanderia (se attiva)
    if (config.laundry && config.nights > 0) {
        for (const item of DB.laundry) {
            addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
        }
    }
    
    // 3. Item meteo
    for (const weatherType of config.weather) {
        const items = DB.weather[weatherType] || [];
        for (const item of items) {
            addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
        }
    }
    
    // 4. Item trasporto
    const transportItems = DB.transport[config.transport] || [];
    for (const item of transportItems) {
        addGeneratedItem(newList, item, calculateQty(item, config), previousItems);
    }
    
    // 5. Item attività extra
    for (const actId of config.activities) {
        const items = DB.extra[actId] || [];
        for (const item of items) {
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

export function updateItemOptions(uid, { quantity, worn, bulky }) {
    for (const cat in STATE.list) {
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (!item) continue;
        item.q = Math.max(1, Math.min(99, Number.parseInt(quantity, 10) || 1));
        item.worn = Boolean(worn);
        item.bulky = Boolean(bulky);
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
export function addCustomItem(cat, name, weight = 100, volume = 1) {
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
        bulky: false
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

/**
 * Salva lo stato in localStorage
 */
export function saveState() {
    try {
        const toSave = {
            config: STATE.config,
            list: STATE.list,
            filter: STATE.filter
        };
        localStorage.setItem('packlist_state', JSON.stringify(toSave));
    } catch (e) {
        console.warn('[Controller] Salvataggio fallito:', e);
    }
}

function normalizeList(list = {}) {
    return Object.fromEntries(Object.entries(list).map(([cat, items]) => [cat, (items || []).map(item => ({
        ...item,
        q: Math.max(1, Number.parseInt(item.q, 10) || 1),
        worn: Boolean(item.worn),
        bulky: Boolean(item.bulky)
    }))]));
}

/**
 * Carica lo stato da localStorage
 */
export function loadState() {
    try {
        const saved = localStorage.getItem('packlist_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            setState({
                config: normalizeConfig(parsed.config),
                list: normalizeList(parsed.list),
                filter: parsed.filter || 'all'
            });
            return true;
        }
    } catch (e) {
        console.warn('[Controller] Caricamento fallito:', e);
    }
    return false;
}

/**
 * Reset completo dello stato
 */
export function resetState() {
    localStorage.removeItem('packlist_state');
    setState({
        config: { ...DEFAULT_CONFIG },
        list: {},
        lastRemoved: null,
        filter: 'all'
    });
    updateConfigUI();
    View.updateFilterUI('all');
    View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    View.stats(STATE, U);
    updateWarnings();
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
    saveTemplates(templates);
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

    const lines = ['Packlist Pro', ''];
    Object.entries(STATE.list).forEach(([cat, items]) => {
        lines.push(cat);
        items.forEach(item => {
            const check = item.checked ? '✓' : '□';
            const worn = item.worn ? ' (indossato)' : '';
            lines.push(`${check} ${item.q}x ${item.n}${worn}`);
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

    alert([
        '📊 Statistiche Packlist',
        `Item: ${done}/${all.length}`,
        `Peso totale: ${U.weight(totalG)}`,
        `In valigia: ${U.weight(suitcaseG)}`,
        `Indossato: ${U.weight(wornG)}`
    ].join('\n'));
}

export function exportPDF() {
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
    doc.setFontSize(18);
    doc.text('Packlist Pro', 14, 18);
    doc.setFontSize(10);
    doc.text(`${STATE.config.nights} notti · ${STATE.config.transport}`, 14, 26);

    const rows = [];
    Object.entries(STATE.list).forEach(([cat, items]) => {
        items.forEach(item => rows.push([
            cat,
            item.n,
            `${item.q}`,
            U.weight((item.w || 100) * item.q),
            item.checked ? 'Sì' : 'No',
            item.worn ? 'Sì' : 'No'
        ]));
    });

    if (typeof doc.autoTable === 'function') {
        doc.autoTable({
            head: [['Categoria', 'Item', 'Qtà', 'Peso', 'Preso', 'Indossato']],
            body: rows,
            startY: 34,
            styles: { fontSize: 8 }
        });
    } else {
        let y = 36;
        rows.forEach(row => {
            if (y > 280) { doc.addPage(); y = 20; }
            doc.text(row.join(' · '), 14, y);
            y += 6;
        });
    }

    doc.save(`packlist_${new Date().toISOString().slice(0, 10)}.pdf`);
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
    
    const headers = ['Categoria', 'Item', 'Quantità', 'Peso (g)', 'Volume', 'Preso', 'Indossato'];
    const rows = all.map(item => [
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

function compactSharedState() {
    return {
        v: 1,
        c: STATE.config,
        l: Object.entries(STATE.list).map(([cat, items]) => [cat, items.map(item => [
            item.n, item.q, item.w, item.checked ? 1 : 0, item.worn ? 1 : 0, item.bulky ? 1 : 0, item.custom ? 1 : 0
        ])])
    };
}

export async function createShareUrl() {
    const url = new URL(window.location.href);
    url.searchParams.set('list', await encodeSharedState(compactSharedState()));
    return url.toString();
}

export async function shareList() {
    if (!getAllItems().length) {
        U.toast('Nessuna lista da condividere');
        return false;
    }
    const url = await createShareUrl();
    if (navigator.share) {
        await navigator.share({ title: 'Packlist Pro', text: 'Ecco la mia lista di viaggio', url });
        return true;
    }
    await navigator.clipboard.writeText(url);
    U.toast('Link della lista copiato negli appunti');
    return true;
}

export async function loadSharedListFromUrl() {
    const url = new URL(window.location.href);
    const encoded = url.searchParams.get('list');
    if (!encoded) return false;
    try {
        const shared = await decodeSharedState(encoded);
        if (shared?.v !== 1 || !Array.isArray(shared.l)) throw new Error('Formato lista non valido');
        const list = Object.fromEntries(shared.l.map(([cat, items]) => [String(cat), items.map((values) => ({
            n: String(values[0]), q: Math.max(1, Number(values[1]) || 1), w: Math.max(1, Number(values[2]) || 100),
            checked: Boolean(values[3]), worn: Boolean(values[4]), bulky: Boolean(values[5]), custom: Boolean(values[6]),
            cat: String(cat), s: 'U', v: 1, uid: U.uid()
        }))]));
        setState({ config: normalizeConfig(shared.c), list: normalizeList(list), filter: 'all' });
        saveState();
        url.searchParams.delete('list');
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
            if (category && input?.value.trim()) {
                addCustomItem(category, input.value);
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
            View.openItemOptions(item);
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
            if (category && e.target.value.trim()) {
                e.preventDefault();
                addCustomItem(category, e.target.value);
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
