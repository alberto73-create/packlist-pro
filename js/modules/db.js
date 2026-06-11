// js/modules/db.js - Database e Costanti Packlist Pro v9.5 Fixed
export const APP_VERSION = "1.1.1";
export const DB_VERSION = "9.5";

// Configurazione di default
export const DEFAULT_CONFIG = {
  nights: 1, 
  gender: 'U', 
  transport: 'auto',
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
export const PER_NIGHT = new Set(['trekking','nuoto','lavoro','fitness','ciclismo','sport_invernali','bambini','alpinismo','ferrata']);

// Item esclusi in modalità gita in giornata (0 notti)
export const DAYTRIP_EXCLUDE = new Set([
  'Mutande','Calze','Canottiere/Sottogiacca','T-shirt','Pigiama','Pantaloni casual',
  'Spazzolino/Dentifricio','Deodorante','Tagliaunghie/Pinzetta','Kit Barba','Trucchi base',
  'Profumo','Laptop + Caricatore','Camicia','Agenda/Penne','Mouse/Tastiera','Adattatore HDMI',
  'Abito elegante','Scarpe eleganti','Cintura','Tenda','Sacco a pelo','Tappetino isolante',
  'Kit cucina camping','Pannolini','Cambio vestiti bimbo','Multipresa viaggio','Cuffie',
  'Cuscino viaggio','Disinfettante mani','Sacco biancheria sporca','Lucchetto TSA',
  'Detersivo monodose','Filo stendino viaggio','Sacchetto biancheria','Pigiama'
]);

// Avvisi da mostrare in base alla configurazione
export const WARNINGS = [
  {
    check: s => s.config.transport === 'aereo' && Object.values(s.list).flat().some(i => i.n.includes('Coltellino')),
    msg: '✈️ Attenzione: il coltellino multiuso non è consentito in cabina'
  },
  {
    check: s => s.config.transport === 'aereo' && Object.values(s.list).flat().some(i => i.n.includes('Accendino')),
    msg: '✈️ Attenzione: gli accendini sono vietati in aereo'
  },
  {
    check: s => s.config.nights === 0 && s.config.laundry,
    msg: '🧺 Lavanderia non necessaria per gite in giornata'
  },
  {
    check: s => s.config.nights > 7 && !s.config.laundry,
    msg: `👔 Viaggio lungo senza lavanderia: considera l'attivazione per ottimizzare i bagagli`
  },
];

// Mappatura filtri per categorie
export const FILTER_MAP = {
  clothing: ['Abbigliamento Base', 'Abbigliamento', 'Trekking', 'Nuoto', 'Spiaggia', 'Lavoro', 'Ciclismo', 'Sport Invernali', 'Moto Pro', 'Fitness', 'Bambini', 'Tecnico'],
  tech: ['Tech', 'Lavoro', 'Fotografia', 'Moto', 'Trasporto'],
  essentials: ['Essenziali', 'Igiene', 'Salute', 'Comfort', 'Zaino', 'Accessori', 'Camping']
};

// Database completo inline
export const DB = {
  base: [
    {n:"Mutande",q:"n",cat:"Abbigliamento Base",s:"U",w:50,v:1},
    {n:"Calze",q:"n",cat:"Abbigliamento Base",s:"U",w:80,v:1},
    {n:"Canottiere/Sottogiacca",q:"n",cat:"Abbigliamento Base",s:"U",w:120,v:1},
    {n:"T-shirt",q:"n",cat:"Abbigliamento Base",s:"U",w:180,v:1},
    {n:"Pigiama",q:"f",cat:"Abbigliamento Base",s:"U",w:300,v:2},
    {n:"Pantaloni casual",q:"f",cat:"Abbigliamento Base",s:"U",w:400,v:2,worn:true},
    {n:"Documenti/Patente",q:"f",cat:"Essenziali",s:"U",w:30,v:1},
    {n:"Portafoglio/Contanti",q:"f",cat:"Essenziali",s:"U",w:100,v:1},
    {n:"Cellulare + Cavo",q:"f",cat:"Tech",s:"U",w:250,v:1},
    {n:"Powerbank",q:"f",cat:"Tech",s:"U",w:250,v:1},
    {n:"Multipresa viaggio",q:"f",cat:"Tech",s:"U",w:300,v:2},
    {n:"Cuffie",q:"f",cat:"Tech",s:"U",w:200,v:1},
    {n:"Spazzolino/Dentifricio",q:"f",cat:"Igiene",s:"U",w:80,v:1},
    {n:"Deodorante",q:"f",cat:"Igiene",s:"U",w:100,v:1},
    {n:"Tagliaunghie/Pinzetta",q:"f",cat:"Igiene",s:"U",w:50,v:1},
    {n:"Kit Barba",q:"f",cat:"Igiene",s:"M",w:200,v:1},
    {n:"Trucchi base",q:"f",cat:"Igiene",s:"F",w:300,v:2},
    {n:"Tachipirina/Oki",q:"f",cat:"Salute",s:"U",w:50,v:1},
    {n:"Cerotti assortiti",q:"f",cat:"Salute",s:"U",w:40,v:1},
    {n:"Disinfettante mani",q:"f",cat:"Salute",s:"U",w:100,v:1},
  ],
  laundry: [
    {n:"Detersivo monodose",q:"f",cat:"Igiene",s:"U",w:30,v:1},
    {n:"Filo stendino viaggio",q:"f",cat:"Accessori",s:"U",w:50,v:1},
    {n:"Sacchetto biancheria",q:"f",cat:"Accessori",s:"U",w:30,v:1},
  ],
  weather: {
    sun: [
      {n:"Occhiali da sole",q:"f",cat:"Accessori",s:"U",w:80,v:1},
      {n:"Crema solare SPF50",q:"f",cat:"Salute",s:"U",w:200,v:1},
      {n:"Cappellino",q:"f",cat:"Accessori",s:"U",w:100,v:1},
    ],
    rain: [
      {n:"Ombrello piccolo",q:"f",cat:"Accessori",s:"U",w:300,v:2},
      {n:"Guscio/Impermeabile",q:"f",cat:"Abbigliamento",s:"U",w:600,v:2},
      {n:"Scarpe waterproof",q:"f",cat:"Abbigliamento",s:"U",w:800,v:3},
      {n:"Sacca impermeabile",q:"f",cat:"Accessori",s:"U",w:150,v:1},
    ],
    cold: [
      {n:"Maglia termica",q:"f",cat:"Abbigliamento",s:"U",w:200,v:2},
      {n:"Guanti/Berretto",q:"f",cat:"Accessori",s:"U",w:150,v:1},
      {n:"Burrocacao",q:"f",cat:"Salute",s:"U",w:30,v:1},
      {n:"Sciarpa",q:"f",cat:"Accessori",s:"U",w:200,v:2},
      {n:"Giacca pesante",q:"f",cat:"Abbigliamento",s:"U",w:900,v:3,worn:true},
    ],
  },
  transport: {
    auto: [
      {n:"Occhiali guida",q:"f",cat:"Trasporto",s:"U",w:80,v:1},
      {n:"Cavo ricarica auto",q:"f",cat:"Tech",s:"U",w:150,v:1},
      {n:"Kit emergenza auto",q:"f",cat:"Trasporto",s:"U",w:400,v:2},
    ],
    moto: [
      {n:"Kit foratura",q:"f",cat:"Moto",s:"U",w:300,v:1},
      {n:"Grasso catena spray",q:"f",cat:"Moto",s:"U",w:200,v:1},
      {n:"Panno visiera",q:"f",cat:"Moto",s:"U",w:30,v:1},
      {n:"Bloccadisco",q:"f",cat:"Moto",s:"U",w:400,v:2},
      {n:"Guanti moto",q:"f",cat:"Moto",s:"U",w:300,v:2,worn:true},
    ],
    aereo: [
      {n:"Passaporto",q:"f",cat:"Essenziali",s:"U",w:50,v:1},
      {n:"Liquidi <100ml",q:"f",cat:"Igiene",s:"U",w:300,v:1},
      {n:"Tappi orecchie",q:"f",cat:"Comfort",s:"U",w:20,v:1},
      {n:"Adattatore prese",q:"f",cat:"Tech",s:"U",w:100,v:1},
      {n:"Cuscino viaggio",q:"f",cat:"Comfort",s:"U",w:200,v:3},
    ],
    backpack: [
      {n:"Sacco biancheria sporca",q:"f",cat:"Zaino",s:"U",w:60,v:1},
      {n:"Asciugamano microfibra",q:"f",cat:"Igiene",s:"U",w:200,v:2},
      {n:"Lucchetto TSA",q:"f",cat:"Zaino",s:"U",w:100,v:1},
      {n:"Coprizaino pioggia",q:"f",cat:"Zaino",s:"U",w:150,v:1},
    ],
  },
  extra: {
    trekking: [
      {n:"Scarponi trekking",q:"f",cat:"Trekking",s:"U",w:1200,v:3,worn:true},
      {n:"Calze trekking",q:"n",cat:"Trekking",s:"U",w:100,v:1},
      {n:"Borraccia 1L",q:"f",cat:"Trekking",s:"U",w:250,v:2},
      {n:"Coltellino multiuso",q:"f",cat:"Trekking",s:"U",w:120,v:1},
      {n:"Bastoncini",q:"f",cat:"Trekking",s:"U",w:400,v:3},
      {n:"Kit primo soccorso",q:"f",cat:"Salute",s:"U",w:200,v:1},
      {n:"Mappa/GPS",q:"f",cat:"Trekking",s:"U",w:80,v:1},
    ],
    nuoto: [
      {n:"Costume",q:"f",cat:"Nuoto",s:"U",w:200,v:1},
      {n:"Cuffia/Occhialini",q:"f",cat:"Nuoto",s:"U",w:80,v:1},
      {n:"Infradito",q:"f",cat:"Nuoto",s:"U",w:250,v:2},
      {n:"Telo mare",q:"f",cat:"Nuoto",s:"U",w:400,v:3},
      {n:"Maschera snorkeling",q:"f",cat:"Nuoto",s:"U",w:300,v:2},
    ],
    spiaggia: [
      {n:"Costume",q:"f",cat:"Spiaggia",s:"U",w:200,v:1},
      {n:"Infradito",q:"f",cat:"Spiaggia",s:"U",w:250,v:2},
      {n:"Telo mare",q:"f",cat:"Spiaggia",s:"U",w:400,v:3},
      {n:"Borsa termica",q:"f",cat:"Spiaggia",s:"U",w:300,v:3},
      {n:"Libro/Kindle",q:"f",cat:"Spiaggia",s:"U",w:250,v:1},
      {n:"Pareo",q:"f",cat:"Spiaggia",s:"U",w:150,v:1},
    ],
    lavoro: [
      {n:"Laptop + Caricatore",q:"f",cat:"Lavoro",s:"U",w:2200,v:2},
      {n:"Camicia",q:"n",cat:"Lavoro",s:"U",w:250,v:1},
      {n:"Agenda/Penne",q:"f",cat:"Lavoro",s:"U",w:200,v:1},
      {n:"Mouse/Tastiera",q:"f",cat:"Lavoro",s:"U",w:400,v:2},
      {n:"Adattatore HDMI",q:"f",cat:"Lavoro",s:"U",w:80,v:1},
    ],
    cena: [
      {n:"Abito elegante",q:"f",cat:"Abbigliamento",s:"U",w:500,v:2},
      {n:"Scarpe eleganti",q:"f",cat:"Abbigliamento",s:"U",w:700,v:3,worn:true},
      {n:"Profumo",q:"f",cat:"Igiene",s:"U",w:150,v:1},
      {n:"Cintura",q:"f",cat:"Abbigliamento",s:"U",w:100,v:1},
    ],
    ciclismo: [
      {n:"Casco ciclismo",q:"f",cat:"Ciclismo",s:"U",w:300,v:3,worn:true},
      {n:"Abbigliamento tecnico bici",q:"n",cat:"Ciclismo",s:"U",w:200,v:1},
      {n:"Guanti ciclismo",q:"f",cat:"Ciclismo",s:"U",w:80,v:1,worn:true},
      {n:"Kit riparazione bici",q:"f",cat:"Ciclismo",s:"U",w:250,v:1},
      {n:"Crema antifrizione",q:"f",cat:"Ciclismo",s:"U",w:100,v:1},
      {n:"Borraccia bici",q:"f",cat:"Ciclismo",s:"U",w:200,v:2},
    ],
    sport_invernali: [
      {n:"Tuta da sci",q:"f",cat:"Sport Invernali",s:"U",w:1500,v:3,worn:true},
      {n:"Casco sci/neve",q:"f",cat:"Sport Invernali",s:"U",w:400,v:3,worn:true},
      {n:"Occhiali da neve",q:"f",cat:"Sport Invernali",s:"U",w:150,v:2,worn:true},
      {n:"Calze termiche sci",q:"n",cat:"Sport Invernali",s:"U",w:120,v:1},
      {n:"Guanti sci",q:"f",cat:"Sport Invernali",s:"U",w:200,v:2,worn:true},
      {n:"Scaldacollo",q:"f",cat:"Sport Invernali",s:"U",w:80,v:1,worn:true},
      {n:"Crema protezione sole neve",q:"f",cat:"Salute",s:"U",w:150,v:1},
    ],
    moto_adv: [
      {n:"Tuta antipioggia intera",q:"f",cat:"Moto Pro",s:"U",w:800,v:3},
      {n:"Sottotuta tecnico",q:"f",cat:"Moto Pro",s:"U",w:350,v:2},
      {n:"Interfono carico",q:"f",cat:"Moto Pro",s:"U",w:150,v:1},
      {n:"Paragambe",q:"f",cat:"Moto Pro",s:"U",w:500,v:2},
    ],
    camping: [
      {n:"Tenda",q:"f",cat:"Camping",s:"U",w:2000,v:3},
      {n:"Sacco a pelo",q:"f",cat:"Camping",s:"U",w:1200,v:3},
      {n:"Tappetino isolante",q:"f",cat:"Camping",s:"U",w:500,v:3},
      {n:"Torcia frontale",q:"f",cat:"Camping",s:"U",w:100,v:1},
      {n:"Accendino",q:"f",cat:"Camping",s:"U",w:20,v:1},
      {n:"Borraccia 1L",q:"f",cat:"Camping",s:"U",w:250,v:2},
      {n:"Kit cucina camping",q:"f",cat:"Camping",s:"U",w:600,v:3},
      {n:"Repellente insetti",q:"f",cat:"Salute",s:"U",w:150,v:1},
    ],
    foto: [
      {n:"Corpo macchina",q:"f",cat:"Fotografia",s:"U",w:700,v:2},
      {n:"Obiettivi extra",q:"f",cat:"Fotografia",s:"U",w:500,v:2},
      {n:"Schede SD extra",q:"f",cat:"Fotografia",s:"U",w:20,v:1},
      {n:"Batterie extra",q:"f",cat:"Fotografia",s:"U",w:100,v:1},
      {n:"Treppiede leggero",q:"f",cat:"Fotografia",s:"U",w:800,v:3},
      {n:"Kit pulizia lenti",q:"f",cat:"Fotografia",s:"U",w:80,v:1},
    ],
    fitness: [
      {n:"Scarpe running",q:"f",cat:"Fitness",s:"U",w:600,v:3,worn:true},
      {n:"Abbigliamento tecnico",q:"n",cat:"Fitness",s:"U",w:200,v:1},
      {n:"Fascia sudore",q:"f",cat:"Fitness",s:"U",w:40,v:1},
      {n:"Bracciale porta-telefono",q:"f",cat:"Fitness",s:"U",w:60,v:1},
      {n:"Asciugamano palestra",q:"f",cat:"Fitness",s:"U",w:150,v:2},
    ],
    bambini: [
      {n:"Pannolini",q:"n",cat:"Bambini",s:"U",w:50,v:2},
      {n:"Salviette umidificate",q:"f",cat:"Bambini",s:"U",w:150,v:2},
      {n:"Cambio vestiti bimbo",q:"n",cat:"Bambini",s:"U",w:300,v:2},
      {n:"Marsupio/Zaino bimbo",q:"f",cat:"Bambini",s:"U",w:800,v:3},
      {n:"Termometro",q:"f",cat:"Bambini",s:"U",w:50,v:1},
      {n:"Giochi viaggio",q:"f",cat:"Bambini",s:"U",w:200,v:2},
      {n:"Crema solare bimbi",q:"f",cat:"Salute",s:"U",w:150,v:1},
    ],
    alpinismo: [
      {n:"Corda (60m)",q:"f",cat:"Tecnico",s:"U",w:3600,v:3},
      {n:"Imbrago",q:"f",cat:"Tecnico",s:"U",w:450,v:2},
      {n:"Casco alpinismo",q:"f",cat:"Tecnico",s:"U",w:350,v:3,worn:true},
      {n:"Ramponi",q:"f",cat:"Tecnico",s:"U",w:900,v:2},
      {n:"Piccozza",q:"f",cat:"Tecnico",s:"U",w:500,v:2},
      {n:"Kit rinvii/moschettoni",q:"f",cat:"Tecnico",s:"U",w:800,v:2},
      {n:"Kit primo soccorso",q:"f",cat:"Tecnico",s:"U",w:200,v:1},
    ],
    ferrata: [
      {n:"Set Ferrata (Y-longe)",q:"f",cat:"Tecnico",s:"U",w:550,v:2},
      {n:"Imbrago leggero",q:"f",cat:"Tecnico",s:"U",w:400,v:2},
      {n:"Casco (ferrata/alpinismo)",q:"f",cat:"Tecnico",s:"U",w:350,v:3,worn:true},
      {n:"Guanti da ferrata",q:"f",cat:"Tecnico",s:"U",w:100,v:1,worn:true},
      {n:"Moschettone a ghiera extra",q:"f",cat:"Tecnico",s:"U",w:80,v:1},
    ],
  }
};
