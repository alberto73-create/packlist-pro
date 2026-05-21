// js/modules/controller.js - Logica di Controllo Packlist Pro v9.5 Fixed
// Architettura STATE-based con gestione completa della lista

import { STATE, setState, DB, ACTIVITIES, PER_NIGHT, DAYTRIP_EXCLUDE, WARNINGS, FILTER_MAP } from './db.js';
import { U } from './utils.js';
import * as View from './ui.js';

/**
 * Calcola le quantità degli item in base alla configurazione
 */
function calculateQty(item, config) {
    const nights = config.nights || 0;
    const laundry = config.laundry;
    const laundryFreq = config.laundryFreq || 3;
    const laundryBuffer = config.laundryBuffer || 1;
    
    // Gita in giornata: quantità fissa o 0 se escluso
    if (nights === 0) {
        if (DAYTRIP_EXCLUDE.has(item.n)) return 0;
        return item.q === 'f' ? 1 : (item.v || 1);
    }
    
    // Quantità fissa
    if (item.q === 'f') {
        let qty = item.v || 1;
        
        // Buffer lavanderia
        if (laundry && laundryFreq > 0) {
            const daysNeeded = nights + 1;
            const washes = Math.floor((daysNeeded - 1) / laundryFreq);
            if (['Mutande', 'Calze', 'Canottiere/Sottogiacca'].includes(item.n)) {
                qty += washes * laundryBuffer;
            }
        }
        return qty;
    }
    
    // Quantità per notte
    if (item.q === 'n') {
        let baseQty = nights + 1; // notti + 1 giorno
        
        // Riduzione per lavanderia
        if (laundry && laundryFreq > 0 && PER_NIGHT.has(item.n)) {
            const daysPerLoad = laundryFreq;
            const loads = Math.ceil((nights + 1) / daysPerLoad);
            baseQty = loads * laundryBuffer + laundryBuffer;
        }
        
        return Math.max(1, baseQty);
    }
    
    return item.v || 1;
}

/**
 * Genera la lista completa dagli item del database
 */
export function generateList() {
    const config = STATE.config;
    const newList = {};
    
    // 1. Item base (sempre inclusi)
    for (const item of DB.base) {
        const qty = calculateQty(item, config);
        if (qty <= 0) continue;
        
        // Filtro gender
        if (item.s !== 'U' && item.s !== config.gender) continue;
        
        addToCategory(newList, item.cat, { ...item, q: qty, uid: U.uid(), custom: false });
    }
    
    // 2. Item lavanderia (se attiva)
    if (config.laundry && config.nights > 0) {
        for (const item of DB.laundry) {
            addToCategory(newList, item.cat, { ...item, q: item.v || 1, uid: U.uid(), custom: false });
        }
    }
    
    // 3. Item meteo
    for (const weatherType of config.weather) {
        const items = DB.weather[weatherType] || [];
        for (const item of items) {
            addToCategory(newList, item.cat, { ...item, q: item.v || 1, uid: U.uid(), custom: false });
        }
    }
    
    // 4. Item trasporto
    const transportItems = DB.transport[config.transport] || [];
    for (const item of transportItems) {
        addToCategory(newList, item.cat, { ...item, q: item.v || 1, uid: U.uid(), custom: false });
    }
    
    // 5. Item attività extra
    for (const actId of config.activities) {
        const items = DB.extra[actId] || [];
        for (const item of items) {
            const qty = calculateQty(item, config);
            if (qty <= 0) continue;
            addToCategory(newList, item.cat, { ...item, q: qty, uid: U.uid(), custom: false });
        }
    }
    
    // Aggiorna stato e UI
    setState({ list: newList });
    View.list(STATE, U);
    View.stats(STATE, U);
    updateWarnings();
    
    return newList;
}

/**
 * Aggiunge un item a una categoria
 */
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

/**
 * Rimuove un item dalla lista
 */
export function removeItem(uid) {
    for (const cat in STATE.list) {
        const idx = STATE.list[cat].findIndex(i => i.uid === uid);
        if (idx >= 0) {
            const removed = STATE.list[cat].splice(idx, 1)[0];
            setState({ lastRemoved: { cat, item: removed, idx } });
            
            // Rimuovi dall'UI
            const row = document.querySelector(`.item-row[data-uid="${uid}"]`);
            if (row) row.remove();
            
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
        worn: false
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

/**
 * Carica lo stato da localStorage
 */
export function loadState() {
    try {
        const saved = localStorage.getItem('packlist_state');
        if (saved) {
            const parsed = JSON.parse(saved);
            setState({
                config: { ...STATE.config, ...parsed.config },
                list: parsed.list || {},
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
        config: { ...DB }, // Default config
        list: {},
        lastRemoved: null,
        filter: 'all'
    });
    View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    View.stats(STATE, U);
}

/**
 * Imposta un filtro sulla lista
 */
export function setFilter(filterType) {
    setState({ filter: filterType });
    View.updateFilterUI(filterType);
    View.list(STATE, U);
}

/**
 * Cerca nella lista
 */
export function searchItems(term) {
    View.filterListBySearch(term);
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
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
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
export function setupEventDelegation() {
    const results = document.getElementById('results');
    if (!results) return;
    
    results.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('.item-row');
        if (!row) return;
        
        const uid = row.dataset.uid;
        const cat = row.dataset.cat;
        
        // Checkbox toggle
        if (target.type === 'checkbox' || target.classList.contains('item-content')) {
            toggleItemChecked(uid);
            return;
        }
        
        // Bottone worn
        if (target.closest('.ia-btn.worn')) {
            toggleWorn(uid);
            return;
        }
        
        // Bottone edit peso
        if (target.closest('.ia-btn.edit')) {
            const item = STATE.list[cat]?.find(i => i.uid === uid);
            const newWeight = prompt(`Modifica peso per "${item?.n}" (grammi):`, item?.w || 100);
            if (newWeight !== null) {
                editItemWeight(uid, newWeight);
            }
            return;
        }
        
        // Bottone delete
        if (target.closest('.ia-btn.del')) {
            if (confirm('Eliminare questo item?')) {
                removeItem(uid);
            }
            return;
        }
        
        // Bottone add custom
        if (target.closest('[data-action="add"]')) {
            const btn = target.closest('[data-action="add"]');
            const inputId = btn.dataset.input;
            const input = document.getElementById(inputId);
            if (input && input.value.trim()) {
                addCustomItem(btn.dataset.cat, input.value);
                input.value = '';
            }
            return;
        }
    });
    
    // Keyboard navigation
    results.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const row = e.target.closest('.item-row');
            if (row && e.target.classList.contains('item-content')) {
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
    
    // Banner daytrip
    View.updateDaytripBanner(config.nights === 0);
    
    // Toggle lavanderia
    View.updateLaundryToggle(config.laundry);
    
    // Bottoni meteo
    View.updateWeatherButtons(config.weather);
    
    // Bottoni attività
    View.updateActivityButtons(config.activities);
}

/**
 * Imposta la configurazione
 */
export function setConfig(newConfig) {
    setState({ config: { ...STATE.config, ...newConfig } });
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
    generateList();
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
    generateList();
}

/**
 * Attiva/disattiva lavanderia
 */
export function toggleLaundry() {
    setConfig({ laundry: !STATE.config.laundry });
    generateList();
}
