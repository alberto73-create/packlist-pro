(() => {
    'use strict';

    const STATE_STORAGE_KEY = 'packlist_state';
    const STATE_BACKUP_KEY = 'packlist_state_backup';
    const DEFAULT_CONFIG = {
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

    const clampInteger = (value, fallback, min, max) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
    };

    const normalizeTransportMode = mode => ({
        auto: 'car',
        macchina: 'car',
        auto_macchina: 'car',
        moto: 'motorcycle',
        aereo: 'plane',
        treno: 'train',
        treno_regionale: 'train',
        backpack: 'walking',
        zaino: 'walking',
        viaggio_zaino: 'walking',
        trekking: 'walking',
        a_piedi_trekking: 'walking'
    })[mode] || mode;

    const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
    const toast = message => window.App?.U?.toast ? window.App.U.toast(message) : console.info(`[Packlist Pro] ${message}`);
    const getState = () => window.App?.STATE || readStoredState();
    const getAllItems = state => Object.values(state?.list || {}).flat();

    function normalizeBaggages(baggages = []) {
        const normalized = (Array.isArray(baggages) ? baggages : []).map((bag, index) => ({
            id: String(bag?.id || `b${index + 1}`),
            name: String(bag?.name || `Bagaglio ${index + 1}`).trim() || `Bagaglio ${index + 1}`,
            limit: Math.max(0, Number(bag?.limit) || 0)
        }));
        return normalized.length ? normalized : [{ id: 'b1', name: 'Bagaglio 1', limit: 0 }];
    }

    function normalizeConfig(config = {}) {
        const normalized = { ...DEFAULT_CONFIG, ...config };
        const requestedTransports = Array.isArray(normalized.transports) && normalized.transports.length
            ? normalized.transports
            : normalized.transport ? [normalized.transport] : [];
        normalized.transports = [...new Set(requestedTransports.map(normalizeTransportMode).filter(Boolean))];
        normalized.transport = normalized.transports[0] || '';
        normalized.weather = [...new Set(Array.isArray(normalized.weather) ? normalized.weather.filter(Boolean) : [])];
        normalized.activities = [...new Set(Array.isArray(normalized.activities) ? normalized.activities.filter(Boolean) : [])];
        normalized.nights = clampInteger(normalized.nights, DEFAULT_CONFIG.nights, 0, 90);
        normalized.laundryFreq = clampInteger(normalized.laundryFreq, DEFAULT_CONFIG.laundryFreq, 1, 14);
        normalized.laundryBuffer = clampInteger(normalized.laundryBuffer, DEFAULT_CONFIG.laundryBuffer, 0, 5);
        normalized.laundry = Boolean(normalized.laundry);
        return normalized;
    }

    function normalizeList(list = {}, baggages = []) {
        const normalizedBaggages = normalizeBaggages(baggages);
        const validIds = new Set(normalizedBaggages.map(bag => bag.id));
        const fallbackId = normalizedBaggages[0].id;
        if (!list || typeof list !== 'object' || Array.isArray(list)) return {};
        return Object.fromEntries(Object.entries(list).map(([cat, items]) => [String(cat), (Array.isArray(items) ? items : []).map(item => ({
            ...item,
            n: String(item.n || ''),
            cat: String(item.cat || cat),
            q: Math.max(1, Number.parseInt(item.q, 10) || 1),
            w: Math.max(1, Number.parseInt(item.w, 10) || 100),
            uid: item.uid || uid(),
            checked: Boolean(item.checked),
            worn: Boolean(item.worn),
            bulky: Boolean(item.bulky),
            custom: Boolean(item.custom),
            baggageId: validIds.has(item.baggageId) ? item.baggageId : fallbackId
        }))]));
    }

    function readStoredState() {
        try {
            const parsed = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) || 'null');
            if (!parsed || typeof parsed !== 'object') return null;
            return parsed;
        } catch {
            return null;
        }
    }

    function bytesToBase64Url(bytes) {
        let binary = '';
        bytes.forEach(byte => { binary += String.fromCharCode(byte); });
        return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    }

    function base64UrlToBytes(value) {
        const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
        return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
    }

    function encodeSharedState(data) {
        return `b.${bytesToBase64Url(new TextEncoder().encode(JSON.stringify(data)))}`;
    }

    function decodeSharedState(value) {
        try {
            const [format, payload] = String(value || '').split('.', 2);
            if (format !== 'b' || !payload) return null;
            return JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload)));
        } catch {
            return null;
        }
    }

    function compactItem(item, baggageIndexes) {
        const values = [item.n, item.q, item.w, item.checked ? 1 : 0, item.worn ? 1 : 0, item.bulky ? 1 : 0, item.custom ? 1 : 0, baggageIndexes.get(item.baggageId) || 0];
        while (values[values.length - 1] === 0) values.pop();
        return values;
    }

    function compactSharedState(state) {
        const config = state.config || DEFAULT_CONFIG;
        const baggageIndexes = new Map((state.baggages || []).map((bag, index) => [bag.id, index]));
        return [
            4,
            [config.nights, config.gender, config.transport, config.transports || [], config.weather || [], config.activities || [], config.laundry ? 1 : 0, config.laundryFreq, config.laundryBuffer],
            state.listName || '',
            (state.baggages || []).map(bag => [bag.name, bag.limit || 0]),
            Object.entries(state.list || {}).map(([cat, items]) => [cat, items.map(item => compactItem(item, baggageIndexes))])
        ];
    }

    function expandSharedState(shared) {
        if (!Array.isArray(shared) || shared[0] !== 4) return null;
        const config = shared[1] || [];
        const baggages = normalizeBaggages((shared[3] || []).map((bag, index) => ({ id: `b${index + 1}`, name: bag[0], limit: bag[1] })));
        const list = Object.fromEntries((shared[4] || []).map(([cat, items]) => [String(cat), (Array.isArray(items) ? items : []).map(values => ({
            n: String(values[0] || ''),
            q: Math.max(1, Number(values[1]) || 1),
            w: Math.max(1, Number(values[2]) || 100),
            checked: Boolean(values[3]),
            worn: Boolean(values[4]),
            bulky: Boolean(values[5]),
            custom: Boolean(values[6]),
            cat: String(cat),
            s: 'U',
            v: 1,
            uid: uid(),
            baggageId: baggages[Number(values[7]) || 0]?.id || baggages[0].id
        }))]));
        return {
            schema: 1,
            config: normalizeConfig({
                nights: config[0],
                gender: config[1],
                transport: config[2],
                transports: config[3],
                weather: config[4],
                activities: config[5],
                laundry: Boolean(config[6]),
                laundryFreq: config[7],
                laundryBuffer: config[8]
            }),
            list: normalizeList(list, baggages),
            listName: String(shared[2] || '').trim(),
            baggages,
            baggageSetup: true,
            filter: 'all'
        };
    }

    function preloadSharedListV4() {
        const url = new URL(window.location.href);
        const encoded = url.hash.slice(1) || url.searchParams.get('list');
        const restored = expandSharedState(decodeSharedState(encoded));
        if (!restored) return false;
        try {
            const previous = localStorage.getItem(STATE_STORAGE_KEY);
            if (previous) localStorage.setItem(STATE_BACKUP_KEY, previous);
            localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(restored));
            url.searchParams.delete('list');
            url.hash = '';
            window.history.replaceState({}, '', url);
            window.__PACKLIST_V4_IMPORTED = true;
            return true;
        } catch (error) {
            console.warn('[Share v4] Import lista condivisa non riuscito:', error);
            return false;
        }
    }

    async function createShareUrl() {
        const state = getState();
        if (!state) return window.location.href;
        const url = new URL(window.location.href);
        url.search = '';
        if (url.pathname.endsWith('/index.html')) url.pathname = url.pathname.slice(0, -'index.html'.length);
        url.hash = encodeSharedState(compactSharedState(state));
        return url.toString();
    }

    async function shareList() {
        const state = getState();
        if (!getAllItems(state).length) {
            toast('Nessuna lista da condividere');
            return false;
        }
        const url = await createShareUrl();
        if (navigator.share) {
            try {
                await navigator.share({ title: state.listName ? `Packlist Pro · ${state.listName}` : 'Packlist Pro', text: 'Ecco la mia lista di viaggio', url });
                return true;
            } catch (error) {
                if (error?.name === 'AbortError') return false;
            }
        }
        await navigator.clipboard?.writeText(url);
        toast('Link della lista copiato negli appunti');
        return true;
    }

    async function exportPDF() {
        if (window.App?.Ctrl?.exportPDF) return window.App.Ctrl.exportPDF();
        toast('Genera prima la packlist, poi esporta il PDF');
        return false;
    }

    function bindCaptureActions() {
        document.addEventListener('click', event => {
            const button = event.target.closest?.('#shareQuickBtn,#shareListBtn');
            if (!button) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            shareList().catch(error => { console.warn('[Share v4] Condivisione fallita:', error); toast('Impossibile condividere la lista'); });
        }, true);
    }

    preloadSharedListV4();
    bindCaptureActions();
    document.addEventListener('DOMContentLoaded', () => {
        if (window.__PACKLIST_V4_IMPORTED) setTimeout(() => toast('Lista condivisa importata'), 250);
    });
    window.PacklistShareV4 = { createShareUrl, shareList, exportPDF };
})();
