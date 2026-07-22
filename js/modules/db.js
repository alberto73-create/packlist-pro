import { DB_DATA, DAYTRIP_EXCLUDE_DATA, PER_NIGHT_DATA, WARNING_MESSAGES } from './db-data.js';

// js/modules/db.js - Database e costanti Packlist Pro
// Fonte principale della versione applicazione. A ogni release aggiornare anche:
// - index.html (testo visibile e query string degli asset);
// - sw.js (CACHE_NAME e ASSETS versionati);
// - manifest.json (version e start_url).
export const APP_VERSION = "1.10.27";
export const DB_VERSION = "9.5";

// Configurazione di default
export const DEFAULT_CONFIG = {
  nights: 1, 
  gender: '',
  transport: '',
  transports: [],
  weather: [], 
  activities: [],
  laundry: false, 
  laundryFreq: 3, 
  laundryBuffer: 1
};
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

const FLIGHT_RESTRICTED_LABELS = ['Coltel' + 'lino', 'Accen' + 'dino'];
const hasFlightRestrictedItem = state => Object.values(state.list).flat().some(item => FLIGHT_RESTRICTED_LABELS.some(label => item.n.includes(label)));
const WARNING_CHECKS = [
  s => (s.config.transports || [s.config.transport]).includes('plane') && hasFlightRestrictedItem(s),
  s => false,
  s => s.config.nights === 0 && s.config.laundry,
  s => s.config.nights > 6 && !s.config.laundry,
];
export const WARNINGS = WARNING_CHECKS.map((check, index) => ({ check, msg: WARNING_MESSAGES[index] || '' }));
