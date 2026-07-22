// js/modules/packlist-generator.js - Regole pure per la generazione della packlist

/**
 * @typedef {Object} PacklistConfig
 * @property {number} nights
 * @property {string} gender
 * @property {string[]} transports
 * @property {string[]} weather
 * @property {string[]} activities
 * @property {boolean} laundry
 * @property {number} laundryFreq
 * @property {number} laundryBuffer
 */

/**
 * @typedef {Object} PacklistItem
 * @property {string} n Nome dell'articolo.
 * @property {string} cat Categoria dell'articolo.
 * @property {string} [s] Genere compatibile (`U`, `M` o `F`).
 * @property {number|string} [q] Quantità legacy o iniziale.
 * @property {string[]} [transportModes]
 * @property {string[]} [weatherModes]
 * @property {{type?: string, base?: number, every?: number, min?: number, max?: number, laundry?: boolean}} [quantityRule]
 * @property {string} [uid]
 * @property {number} [w]
 * @property {boolean} [custom]
 * @property {boolean} [checked]
 * @property {boolean} [worn]
 * @property {boolean} [bulky]
 * @property {string} [baggageId]
 */

const LEGACY_TRANSPORT_KEYS = { car: 'auto', motorcycle: 'moto', plane: 'aereo', walking: 'backpack' };

/** @param {string} mode */
export function normalizeTransportMode(mode) {
    return ({ auto: 'car', macchina: 'car', auto_macchina: 'car', moto: 'motorcycle', aereo: 'plane', treno: 'train', treno_regionale: 'train', backpack: 'walking', zaino: 'walking', viaggio_zaino: 'walking', trekking: 'walking', a_piedi_trekking: 'walking' })[mode] || mode;
}

/** @param {PacklistItem} item @param {string[]} transports */
export function isTransportCompatible(item, transports) {
    const selected = (Array.isArray(transports) ? transports : []).map(normalizeTransportMode);
    const modes = Array.isArray(item.transportModes) && item.transportModes.length ? item.transportModes.map(normalizeTransportMode) : ['tutti'];
    return modes.includes('tutti') || selected.some(transport => modes.includes(transport));
}

/** @param {PacklistItem} item @param {string[]} selectedWeather */
export function isWeatherCompatible(item, selectedWeather) {
    const modes = Array.isArray(item.weatherModes) && item.weatherModes.length ? item.weatherModes : ['tutti'];
    return modes.includes('tutti') || (Array.isArray(selectedWeather) && selectedWeather.some(weather => modes.includes(weather)));
}

/** @param {PacklistItem} item */
function isDepartureWornDailyItem(item) {
    return item.cat === 'Abbigliamento Base' && /^(Mutande|Calze|Canottiere\/Sottogiacca|T-shirt)$/i.test(item.n || '');
}

/**
 * Calcola la quantità da portare senza leggere o modificare lo stato globale.
 * @param {PacklistItem} item
 * @param {PacklistConfig} config
 * @param {Set<string>} daytripExclude
 */
export function calculateItemQuantity(item, config, daytripExclude = new Set()) {
    const nights = Math.max(0, Number(config.nights) || 0);
    const totalDays = nights + 1;
    const legacyRule = item.q === 'n'
        ? { type: 'perDay', base: 1, every: 1, min: 1, max: 0, laundry: true }
        : { type: 'fixed', base: 1, every: 1, min: 1, max: 0, laundry: false };
    const rule = { ...legacyRule, ...(item.quantityRule || {}) };

    if (nights === 0) return daytripExclude.has(item.n) ? 0 : Math.max(1, Number(rule.min) || 1);

    let coveredDays = totalDays;
    if (config.laundry && rule.laundry) {
        coveredDays = Math.min(totalDays, Math.max(1, Number(config.laundryFreq) || 3) + Math.max(0, Number(config.laundryBuffer) || 0));
    }
    if (rule.type === 'perDay' && isDepartureWornDailyItem(item)) coveredDays = Math.max(1, coveredDays - 1);
    let quantity = rule.type === 'fixed'
        ? Math.max(1, Number(rule.base) || 1)
        : Math.ceil(coveredDays / Math.max(1, Number(rule.every) || 1)) * Math.max(1, Number(rule.base) || 1);
    quantity = Math.max(Math.max(0, Number(rule.min) || 0), quantity);
    return Number(rule.max) > 0 ? Math.min(quantity, Number(rule.max)) : quantity;
}

function itemKey(category, name) {
    return `${category}\u0000${name}`;
}

/**
 * Genera una lista nuova preservando gli attributi utente degli articoli già presenti.
 * Non accede al DOM, allo storage o allo stato globale: è quindi testabile in isolamento.
 * @param {{base?: PacklistItem[], laundry?: PacklistItem[], weather?: Record<string, PacklistItem[]>, transport?: Record<string, PacklistItem[]>, extra?: Record<string, PacklistItem[]>}} database
 * @param {PacklistConfig} config
 * @param {Record<string, PacklistItem[]>} previousList
 * @param {{id: string}[]} baggages
 * @param {Set<string>} daytripExclude
 * @param {() => string} createId
 * @returns {Record<string, PacklistItem[]>}
 */
export function generatePacklist(database, config, previousList = {}, baggages = [], daytripExclude = new Set(), createId = () => crypto.randomUUID()) {
    const previousItems = new Map(Object.values(previousList).flat().filter(item => !item.custom).map(item => [itemKey(item.cat, item.n), item]));
    const customItems = Object.values(previousList).flat().filter(item => item.custom);
    /** @type {Record<string, PacklistItem[]>} */
    const list = {};
    const addItem = (item, filterGender = false) => {
        if (!isTransportCompatible(item, config.transports)) return;
        if (!isWeatherCompatible(item, config.weather)) return;
        const quantity = calculateItemQuantity(item, config, daytripExclude);
        if (quantity <= 0 || (filterGender && item.s && item.s !== 'U' && item.s !== config.gender)) return;
        const previous = previousItems.get(itemKey(item.cat, item.n));
        const generated = { ...item, q: quantity, uid: previous?.uid || createId(), w: previous?.w ?? item.w, checked: previous?.checked || false, worn: previous?.worn ?? false, bulky: previous?.bulky ?? false, baggageId: previous?.baggageId || baggages[0]?.id || 'b1', custom: false };
        if (!list[item.cat]) list[item.cat] = [];
        if (!list[item.cat].some(existing => existing.n === item.n)) list[item.cat].push(generated);
    };

    (database.base || []).forEach(item => addItem(item, true));
    if (config.laundry && config.nights > 0) (database.laundry || []).forEach(item => addItem(item));
    (config.weather || []).forEach(weather => (database.weather?.[weather] || []).forEach(item => addItem(item)));
    (config.transports || []).forEach(transport => (database.transport?.[LEGACY_TRANSPORT_KEYS[transport] || transport] || []).forEach(item => addItem(item)));
    (config.activities || []).forEach(activity => (database.extra?.[activity] || []).forEach(item => addItem(item)));
    customItems.forEach(item => { (list[item.cat] ||= []).push(item); });
    return list;
}
