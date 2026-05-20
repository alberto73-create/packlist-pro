// js/modules/db.js - Gestione del Database e Dati - Versione Ottimizzata
export const DB_VERSION = "1.00.18";

let db = {};
let statsLog = [];

// Cache per migliorare le prestazioni delle lookup
let itemCache = new Map();
let activityCache = new Map();
let categoryCache = new Map();

/**
 * Carica il database da data.json - Versione Ottimizzata
 */
export async function loadDatabase() {
    try {
        const response = await fetch('data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        db = data;
        
        if (!db.settings) db.settings = { selectedActivities: [], nights: 3, laundryFreq: 0 };
        if (!db.settings.selectedActivities) db.settings.selectedActivities = [];

        console.log(`[DB] Database caricato: ${db.version || DB_VERSION}`);
        
        // Costruisci cache per lookup più veloci
        rebuildCaches();
        
        const versionEl = document.getElementById('appVersion');
        if(versionEl) versionEl.innerText = `v${db.version || DB_VERSION}`;

    } catch (error) {
        console.error("[DB] Errore caricamento DB:", error);
        db = { 
            version: DB_VERSION,
            categories: [], 
            activities: [], 
            items: [], 
            settings: { selectedActivities: [], nights: 3, laundryFreq: 0 } 
        };
    }
}

/**
 * Ricostruisce le cache per lookup veloci
 */
function rebuildCaches() {
    itemCache.clear();
    activityCache.clear();
    categoryCache.clear();
    
    if (db.items) {
        db.items.forEach(item => itemCache.set(item.id, item));
    }
    if (db.activities) {
        db.activities.forEach(act => activityCache.set(act.id, act));
    }
    if (db.categories) {
        db.categories.forEach(cat => categoryCache.set(cat.id, cat));
    }
}

/**
 * Invalida una cache specifica quando i dati cambiano
 */
function invalidateCache(type, id) {
    if (type === 'item') itemCache.delete(id);
    else if (type === 'activity') activityCache.delete(id);
    else if (type === 'category') categoryCache.delete(id);
}

/**
 * Ottiene il database corrente
 */
export function getDB() {
    return db;
}

/**
 * Imposta il database (per testing o reset)
 */
export function setDB(newDB) {
    db = newDB;
}

/**
 * Ottiene il nome di un item dato l'ID - Versione Ottimizzata con cache
 */
export function getItemName(id) {
    if (itemCache.has(id)) {
        return itemCache.get(id).name;
    }
    const item = db.items.find(i => i.id === id);
    return item ? item.name : id;
}

/**
 * Ottiene il nome di un'attività dato l'ID - Versione Ottimizzata con cache
 */
export function getActivityName(id) {
    if (activityCache.has(id)) {
        return activityCache.get(id).name;
    }
    const act = db.activities.find(a => a.id === id);
    return act ? act.name : id;
}

/**
 * Ottiene un item dato l'ID - Versione Ottimizzata con cache O(1)
 */
export function getItemById(id) {
    return itemCache.get(id) ?? db.items?.find(i => i.id === id) ?? null;
}

/**
 * Ottiene un'attività dato l'ID - Versione Ottimizzata con cache O(1)
 */
export function getActivityById(id) {
    return activityCache.get(id) ?? db.activities?.find(a => a.id === id) ?? null;
}

/**
 * Ottiene una categoria dato l'ID - Versione Ottimizzata con cache O(1)
 */
export function getCategoryById(id) {
    return categoryCache.get(id) ?? db.categories?.find(c => c.id === id) ?? null;
}

/**
 * Traccia una statistica
 */
export function trackStats(action, itemId, details = "") {
    const itemObj = db.items.find(i => i.id === itemId);
    const state = getItemState(itemId);
    
    const entry = {
        timestamp: new Date().toISOString(),
        item: itemObj ? itemObj.name : (itemId === 'system' ? 'Sistema' : itemId),
        action: action,
        details: details,
        weight: itemObj ? itemObj.weight : 0,
        qty: state.qty || (itemObj ? itemObj.defaultQty : 0),
        destination: state.worn ? 'Indossato' : 'Bagaglio'
    };
    
    statsLog.push(entry);
    console.log("[Stats Log]", entry);
    return entry;
}

/**
 * Ottiene il log delle statistiche
 */
export function getStatsLog() {
    return statsLog;
}

/**
 * Esporta le statistiche in CSV
 */
export function exportStatsCSV() {
    if(statsLog.length === 0) { 
        alert("Nessun dato nei log."); 
        return null; 
    }
    
    const headers = ["Data", "Oggetto", "Azione", "Dettagli", "Peso", "Quantità", "Destinazione"];
    const rows = statsLog.map(log => [
        log.timestamp, log.item, log.action, log.details, log.weight, log.qty, log.destination
    ]);

    let csvContent = "text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(e => e.join(",")).join("\n");
    return encodeURI(csvContent);
}

/**
 * Stato locale degli item - Storage
 */
function getItemState(itemId) {
    const stored = localStorage.getItem(`item_${itemId}`);
    return stored ? JSON.parse(stored) : {};
}

function saveItemState(itemId, state) {
    localStorage.setItem(`item_${itemId}`, JSON.stringify(state));
}

/**
 * Toggle stato "indossato"
 */
export function toggleWornStatus(itemId) {
    const state = getItemState(itemId);
    state.worn = !state.worn;
    saveItemState(itemId, state);
    return state.worn;
}

/**
 * Aggiorna quantità item
 */
export function updateItemQty(itemId, delta) {
    const state = getItemState(itemId);
    const item = db.items.find(i => i.id === itemId);
    let newQty = (state.qty !== undefined ? state.qty : item.defaultQty) + delta;

    if (newQty < 0) newQty = 0;

    state.qty = newQty;
    saveItemState(itemId, state);
    
    return newQty;
}

/**
 * Imposta quantità item direttamente
 */
export function setItemQty(itemId, newQty) {
    const state = getItemState(itemId);
    state.qty = newQty;
    saveItemState(itemId, state);
    return newQty;
}

/**
 * Rimuove item dalla lista
 */
export function removeItemFromList(itemId) {
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        row.remove();
        localStorage.removeItem(`item_${itemId}`);
        return true;
    }
    return false;
}

/**
 * Salva impostazioni locali
 */
export function saveLocalSettings(settings) {
    localStorage.setItem('packlist_settings', JSON.stringify(settings));
}

/**
 * Carica impostazioni locali
 */
export function loadLocalSettings() {
    const saved = localStorage.getItem('packlist_settings');
    if (saved) {
        return JSON.parse(saved);
    }
    return null;
}
