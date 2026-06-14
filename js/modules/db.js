import { DB_DATA, DAYTRIP_EXCLUDE_DATA, PER_NIGHT_DATA, WARNING_MESSAGES } from './db-data.js';

// js/modules/db.js - Database e Costanti Packlist Pro v9.5 Fixed
export const APP_VERSION = "1.10.1";
export const DB_VERSION = "9.5";

// Configurazione di default
export const DEFAULT_CONFIG = {
  nights: 1, 
  gender: 'U', 
  transport: 'car',
  transports: ['car'],
  weather: [], 
  activities: [],
  laundry: false, 
  laundryFreq: 3, 
  laundryBuffer: 1
};
// Dati inline del database (ex data.json)
const INLINE_DB = {
  "version": "1.00.21",
  "lastUpdate": "2024-05-23",
  "categories": [
    { "id": "clothing", "name": "Abbigliamento", "icon": "👕", "essential": true },
    { "id": "shoes", "name": "Scarpe", "icon": "👟", "essential": true },
    { "id": "toiletries", "name": "Igiene", "icon": "🪥", "essential": true },
    { "id": "electronics", "name": "Elettronica", "icon": "🔌", "essential": false },
    { "id": "documents", "name": "Documenti", "icon": "📄", "essential": true },
    { "id": "firstaid", "name": "Primo Soccorso", "icon": "🩹", "essential": true },
    { "id": "misc", "name": "Varie", "icon": "🎒", "essential": false }
  ],
  "activities": [
    { "id": "beach", "name": "Mare", "icon": "🏖️", "category": "clothing" },
    { "id": "mountain", "name": "Montagna", "icon": "🏔️", "category": "clothing" },
    { "id": "city", "name": "Città", "icon": "🏙️", "category": "clothing" },
    { "id": "sport", "name": "Sport", "icon": "⚽", "category": "clothing" },
    { "id": "formal", "name": "Formale", "icon": "👔", "category": "clothing" },
    { "id": "hiking", "name": "Trekking", "icon": "🥾", "category": "shoes" }
  ],
  "items": [
    { "id": "tshirt", "name": "Maglietta", "category": "clothing", "weight": 0.2, "defaultQty": 3, "activities": ["beach", "city", "sport"] },
    { "id": "pants", "name": "Pantaloni", "category": "clothing", "weight": 0.5, "defaultQty": 2, "activities": ["city", "mountain", "formal"] },
    { "id": "jacket", "name": "Giacca", "category": "clothing", "weight": 0.8, "defaultQty": 1, "activities": ["mountain", "city"] },
    { "id": "swimsuit", "name": "Costume", "category": "clothing", "weight": 0.15, "defaultQty": 1, "activities": ["beach"] },
    { "id": "hboots", "name": "Scarponi", "category": "shoes", "weight": 1.2, "defaultQty": 1, "activities": ["mountain", "hiking"] },
    { "id": "sneakers", "name": "Sneakers", "category": "shoes", "weight": 0.6, "defaultQty": 1, "activities": ["city", "sport"] },
    { "id": "toothbrush", "name": "Spazzolino", "category": "toiletries", "weight": 0.05, "defaultQty": 1, "activities": [] },
    { "id": "charger", "name": "Caricabatterie", "category": "electronics", "weight": 0.1, "defaultQty": 1, "activities": [] },
    { "id": "passport", "name": "Passaporto", "category": "documents", "weight": 0.05, "defaultQty": 1, "activities": [] }
  ],
  "settings": {
    "selectedActivities": [],
    "nights": 3,
    "laundryFreq": 0,
    "unit": "kg"
  }
};

let db = {};
let statsLog = [];

// Stato globale dell'applicazione
export let STATE = {
  config: { ...DEFAULT_CONFIG },
  list: {},
  listName: '',
  baggages: [{ id: 'b1', name: 'Bagaglio 1', limit: 0 }],
  baggageSetup: false,
  lastRemoved: null,
  filter: 'all'
};

export function setState(newState) {
  STATE = { ...STATE, ...newState };
}

/**
 * Carica il database dai dati inline - Versione Ottimizzata
 */
export async function loadDatabase() {
    try {
        // Usa i dati inline invece di fetch
        const data = INLINE_DB;

        db = data;
        
        if (!db.settings) db.settings = { selectedActivities: [], nights: 3, laundryFreq: 0 };
        if (!db.settings.selectedActivities) db.settings.selectedActivities = [];

        console.log(`[DB] Database caricato: ${db.version || DB_VERSION}`);
        
        // Costruisci cache per lookup più veloci
        rebuildCaches();
        
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

export function getState() {
  return STATE;
}

// Attività che si moltiplicano per notte
// Mappatura filtri per categorie
export const FILTER_MAP = {
  clothing: ['Abbigliamento Base', 'Abbigliamento', 'Trekking', 'Nuoto', 'Spiaggia', 'Lavoro', 'Ciclismo', 'Sport Invernali', 'Moto Pro', 'Fitness', 'Bambini', 'Tecnico'],
  tech: ['Tech', 'Lavoro', 'Fotografia', 'Moto', 'Trasporto'],
  essentials: ['Essenziali', 'Igiene', 'Salute', 'Comfort', 'Zaino', 'Accessori', 'Camping']
};

// Database completo inline
// I dati modificabili vivono in db-data.js; qui preserviamo gli export pubblici.
export const DB = DB_DATA;
export const PER_NIGHT = new Set(PER_NIGHT_DATA);
export const DAYTRIP_EXCLUDE = new Set(DAYTRIP_EXCLUDE_DATA);

const WARNING_CHECKS = [
  s => (s.config.transports || [s.config.transport]).includes('plane') && Object.values(s.list).flat().some(i => i.n.includes('Coltellino')),
  s => (s.config.transports || [s.config.transport]).includes('plane') && Object.values(s.list).flat().some(i => i.n.includes('Accendino')),
  s => s.config.nights === 0 && s.config.laundry,
  s => s.config.nights > 6 && !s.config.laundry,
];
export const WARNINGS = WARNING_CHECKS.map((check, index) => ({ check, msg: WARNING_MESSAGES[index] || '' }));
