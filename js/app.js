// ============================================================
//  Packlist Pro — App Logic v1.00.16
//  Database-driven con calcolo intelligente per notti
// ============================================================

let PACKLIST_DATA = null;

// Carica il database JSON
async function loadDatabase() {
    try {
        const response = await fetch('data.json');
        if (!response.ok) throw new Error('Impossibile caricare data.json');
        PACKLIST_DATA = await response.json();
        console.log('[App] Database caricato:', PACKLIST_DATA.version);
        return true;
    } catch (error) {
        console.error('[App] Errore caricamento database:', error);
        return false;
    }
}

// ── CONFIG & STATE ───────────────────────────────────────────
const DEFAULT_CONFIG = {
    nights: 3, gender: 'M', transport: 'auto',
    weather: [], activities: [], laundry: false, laundryFreq: 3, laundryBuffer: 1
};

let STATE = {
    config: { ...DEFAULT_CONFIG },
    list: {},
    lastRemoved: null,
    filter: 'all',
    currentTemplateName: ''
};

// ── ACTIVITIES ───────────────────────────────────────────────
const ACTIVITIES = [
    {id:'trekking',label:'Trekking',icon:'⛰️'},{id:'piscina',label:'Piscina',icon:'🏊‍♂️'},
    {id:'spiaggia',label:'Spiaggia',icon:'🏖️'},{id:'citta',label:'Città',icon:'🏙️'},
    {id:'lavoro',label:'Lavoro',icon:'💼'},{id:'cena',label:'Cena Elegante',icon:'🍽️'},
    {id:'ciclismo',label:'Bici/Ciclismo',icon:'🚴'},{id:'sport_invernali',label:'Sci/Neve',icon:'⛷️'},
    {id:'moto_adv',label:'Moto Pro',icon:'🏍️'},{id:'camping',label:'Campeggio',icon:'⛺'},
    {id:'foto',label:'Fotografia',icon:'📸'},{id:'fitness',label:'Run/Fitness',icon:'🏋️'},
    {id:'bambini',label:'Con Bambini',icon:'👶'},{id:'alpinismo',label:'Alpinismo',icon:'🏔️'},
    {id:'ferrata',label:'Via Ferrata',icon:'🧗'},
];

const NAME_ALIASES = {
    'guscio impermeabile':'guscio/impermeabile','guscio gore-tex':'guscio/impermeabile',
    'giacca gore-tex':'guscio/impermeabile','giacca impermeabile leggera':'guscio/impermeabile',
    'giacca antipioggia':'guscio/impermeabile','copri-tuta impermeabile':'guscio/impermeabile',
    'giacca leggera antipioggia':'guscio/impermeabile',
    'zaino tecnico':'zaino tecnico (30-40l)','kit soccorso tecnico':'kit primo soccorso',
    'kit soccorso ferrata':'kit primo soccorso','kit pronto soccorso':'kit primo soccorso',
    'kit pronto soccorso bambino':'kit primo soccorso','kit pronto soccorso rapido':'kit primo soccorso',
    'borraccia 1l':'borraccia','borraccia bici':'borraccia','borraccia pieghevole':'borraccia',
    'occhiali uv':'occhiali da sole','occhiali uv ferrata':'occhiali da sole',
    'occhiali uv neve':'occhiali da sole','occhiali polarizzati':'occhiali da sole',
    'occhiali ghiacciaio cat.4':'occhiali da sole','visiera/occhiali ciclismo':'occhiali da sole',
    'crema spf alta':'crema solare spf50','spf alto':'crema solare spf50',
    'spf alto neve':'crema solare spf50','spf 50+ labbra/viso':'crema solare spf50',
    'crema spf':'crema solare spf50','spf':'crema solare spf50',
    'protezione solare waterproof':'crema solare spf50','spf 30+ compatto':'crema solare spf50',
    'ciabatte hotel':'ciabatte','acqua 1l':'acqua','fodera termica giacca':'fodera termica'
};

const normalizeName = n => NAME_ALIASES[(n||'').trim().toLowerCase()] || (n||'').trim().toLowerCase();

const WARNINGS = [
    { check: s => s.config.transport==='aereo' && Object.values(s.list).flat().some(i=>i.n.includes('Coltellino')), msg:'✈️ Attenzione: il coltellino multiuso non è consentito in cabina'},
    { check: s => s.config.transport==='aereo' && Object.values(s.list).flat().some(i=>i.n.includes('Accendino')), msg:'✈️ Attenzione: gli accendini sono vietati in aereo'},
    { check: s => s.config.nights===0 && s.config.laundry, msg:'🧺 Lavanderia non necessaria per gite in giornata'},
    { check: s => s.config.nights>7 && !s.config.laundry, msg:`👔 Viaggio lungo senza lavanderia: considera l'attivazione per ottimizzare i bagagli`},
];

const FILTER_MAP = {
    clothing:['Abbigliamento Base','Abbigliamento','Trekking','Piscina','Spiaggia','Città','Lavoro','Cena Elegante','Ciclismo','Sport Invernali','Moto Pro','Fitness','Bambini','Tecnico'],
    tech:['Tech','Lavoro','Fotografia','Moto','Trasporto'],
    essentials:['Essenziali','Igiene','Salute','Comfort','Zaino','Accessori','Camping','Lavanderia','Sicurezza','Città']
};

// ── DATABASE LOGIC ────────────────────────────────────────────
// Nota: Il database è caricato da data.json tramite loadDatabase()

// Calcola la quantità basata sul tipo (fixed o nights) e sul numero di notti
function calculateQty(item, nights) {
    if (item.type === 'fixed') {
        return item.baseQty;
    } else if (item.type === 'nights') {
        // Formula: baseQty + ceil(nights * ratio)
        // Esempio: mutande (ratio 1) per 3 notti = 1 + 3 = 4
        // Esempio: camicie lavoro (ratio 0.5) per 7 notti = 1 + ceil(3.5) = 5
        const additional = Math.ceil(nights * (item.ratio || 1));
        return Math.max(item.baseQty, additional);
    }
    return item.baseQty || 1;
}

// Genera la lista dal database JSON considerando tutta la configurazione
function generateListFromDB(config) {
    if (!PACKLIST_DATA) {
        console.error('[App] Database non caricato');
        return {};
    }
    
    const { nights, gender, transport, laundry, laundryFreq, laundryBuffer, weather, activities } = config;
    const isDaytrip = nights === 0;
    
    // Calcola notti effettive per il calcolo quantità
    let nCalc;
    if (isDaytrip) { nCalc = 1; }
    else if (laundry) { nCalc = Math.min(nights, laundryFreq) + laundryBuffer; }
    else { nCalc = nights <= 2 ? nights : nights + 1; }
    nCalc = Math.max(1, nCalc);
    
    const list = {};
    const seenByName = new Map(); // Per deduplicazione
    
    // Funzione helper per aggiungere item
    const addItem = (item, qtyMultiplier = 1, categoryOverride = null) => {
        if (!item || !item.id || !item.name) return;
        
        // Filtra per giorno/notte (se specificato)
        if (isDaytrip && item.overnight) return;
        
        // Filtra per genere (se specificato)
        if (item.gender && item.gender !== 'U' && item.gender !== gender) return;
        
        // Calcola quantità
        let qty;
        if (item.type === 'fixed') {
            qty = item.baseQty;
        } else if (item.type === 'nights') {
            const additional = Math.ceil(nCalc * (item.ratio || 1));
            qty = Math.max(item.baseQty, additional);
        } else {
            qty = item.baseQty || 1;
        }
        qty = qty * qtyMultiplier;
        
        // Normalizza nome per deduplicazione
        const normalizedName = normalizeName(item.name);
        
        // Usa categoria override o cerca nel database
        let category = categoryOverride || 'Essenziali';
        if (!categoryOverride) {
            for (const cat of PACKLIST_DATA.categories) {
                if (cat.items.some(i => i.id === item.id)) {
                    category = cat.name;
                    break;
                }
            }
        }
        
        if (!list[category]) list[category] = [];
        
        // Gestione deduplicazione: tieni la quantità massima
        if (seenByName.has(normalizedName)) {
            const existing = seenByName.get(normalizedName);
            existing.q = Math.max(existing.q, qty);
        } else {
            const newItem = {
                id: item.id,
                n: item.name,
                cat: category,
                q: qty,
                w: item.weight || 100,
                checked: false,
                custom: false,
                overnight: !!item.overnight
            };
            list[category].push(newItem);
            seenByName.set(normalizedName, newItem);
        }
    };
    
    // Aggiungi tutti gli items base da tutte le categorie
    // Nota: Il database attuale non ha flag weather/activity/transport/gender
    // Quindi aggiungiamo tutto e filtriamo solo per overnight se daytrip
    PACKLIST_DATA.categories.forEach(cat => {
        cat.items.forEach(item => {
            // Salta solo items overnight per gite in giornata
            if (isDaytrip && item.overnight) return;
            
            // Salta items di genere specifico se non corrispondono
            if (item.gender && item.gender !== 'U' && item.gender !== gender) return;
            
            addItem(item, nCalc, cat.name);
        });
    });
    
    // Rimuovi categorie vuote
    Object.keys(list).forEach(cat => {
        if (!list[cat].length) delete list[cat];
    });
    
    if (!Object.keys(list).length) {
        U.toast("Nessun item! Seleziona un'attività ⚠️", 'error');
    }
    
    return list;
}


// ── UTILITIES ────────────────────────────────────────────────
const U = {
    uid: (() => {
        let counter = Date.now();
        return () => `${counter.toString(36)}-${Math.random().toString(36).substr(2,9)}`;
    })(),
    weight: g => {
        const grams = (g && !isNaN(g) && g > 0) ? g : 0;
        return grams < 1000 ? `${grams} g` : `${Number((grams/1000).toFixed(1))} kg`;
    },
    esc: (() => {
        const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'};
        return t => !t ? '' : String(t).replace(/[&<>"']/g, c => map[c]);
    })(),
    stripEmoji: s => s.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,''),
    clone: obj => typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)),
    _tid: null,
    _statsCache: null,
    
    // Gestione Statistiche Locali - Traccia tutte le modifiche
    getStats() {
        if (this._statsCache !== null) return this._statsCache;
        try {
            const data = localStorage.getItem('packlist_stats');
            this._statsCache = data ? JSON.parse(data) : {};
            return this._statsCache;
        } catch { return {}; }
    },
    trackStats(action, name, weight, qty = 1, extraData = {}) {
        const stats = this.getStats();
        const normalizedName = name.trim().toLowerCase();
        if (!stats[normalizedName]) {
            stats[normalizedName] = { 
                name: name.trim(), 
                count: 0, 
                removedCount: 0, 
                totalWeight: 0, 
                lastAdded: null, 
                lastRemoved: null,
                weightChanges: [],
                qtyChanges: [],
                destinationChanges: [],
                allActions: []
            };
        }
        
        const timestamp = new Date().toISOString();
        const actionRecord = { action, timestamp, weight, qty, ...extraData };
        stats[normalizedName].allActions.push(actionRecord);
        
        if (action === 'add') {
            stats[normalizedName].count += qty;
            stats[normalizedName].totalWeight += (weight || 0) * qty;
            stats[normalizedName].lastAdded = timestamp;
        } else if (action === 'remove') {
            stats[normalizedName].removedCount += qty;
            stats[normalizedName].lastRemoved = timestamp;
        } else if (action === 'weight_change') {
            stats[normalizedName].weightChanges.push({ oldWeight: null, newWeight: weight, timestamp });
        } else if (action === 'qty_change') {
            stats[normalizedName].qtyChanges.push({ oldQty: null, newQty: qty, timestamp });
        } else if (action === 'destination') {
            stats[normalizedName].destinationChanges.push({ destination: extraData.destination || 'unknown', timestamp });
        }
        
        this._statsCache = stats;
        localStorage.setItem('packlist_stats', JSON.stringify(stats));
    },
    exportStats() {
        const stats = this.getStats();
        let csv = 'Data,Oggetto,Azione,Dettagli,Peso (g),Quantità,Destinazione\n';
        for (const key in stats) {
            const item = stats[key];
            // Esporta tutte le azioni registrate
            if (item.allActions && item.allActions.length > 0) {
                item.allActions.forEach(act => {
                    const date = act.timestamp ? new Date(act.timestamp).toLocaleString('it-IT') : '';
                    const actionLabel = U._getActionLabel(act.action);
                    const details = [];
                    if (act.action === 'weight_change') details.push(`Peso: ${act.newWeight}g`);
                    if (act.action === 'qty_change') details.push(`Qty: ${act.qty}x`);
                    if (act.action === 'destination') details.push(`Dest: ${act.destination || 'N/A'}`);
                    if (act.action === 'remove') details.push('Eliminato');
                    if (act.action === 'add') details.push('Aggiunto');
                    csv += `"${date}","${item.name}",${actionLabel},"${details.join('; ')}",${act.weight || ''},${act.qty || ''},"${act.destination || ''}"\n`;
                });
            } else {
                // Fallback per vecchi dati
                const dateAdded = item.lastAdded ? new Date(item.lastAdded).toLocaleString('it-IT') : '';
                const avgWeight = item.count > 0 ? Math.round(item.totalWeight / item.count) : 0;
                csv += `"${dateAdded}","${item.name}",ADD,"Aggiunto ${item.count} volte",${avgWeight},${item.count},""\n`;
            }
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `packlist_log_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },
    _getActionLabel(action) {
        const labels = {
            'add': 'AGGIUNTA',
            'remove': 'ELIMINAZIONE',
            'weight_change': 'MODIFICA PESO',
            'qty_change': 'MODIFICA QTY',
            'destination': 'DESTINAZIONE'
        };
        return labels[action] || action.toUpperCase();
    },
    invalidateStatsCache() { this._statsCache = null; },
    showStatsModal() {
        const stats = this.getStats();
        const items = Object.values(stats).sort((a,b) => b.count - a.count);
        
        if (items.length === 0) {
            alert('Nessuna statistica disponibile. Aggiungi qualche oggetto personalizzato per iniziare!');
            return;
        }
        
        let html = '<div style="max-height:60vh;overflow-y:auto;text-align:left;">';
        html += '<h3>📊 Statistiche Oggetti Personalizzati</h3>';
        html += '<table style="width:100%;border-collapse:collapse;"><tr><th style="border-bottom:2px solid #ccc;padding:8px;">Oggetto</th><th style="border-bottom:2px solid #ccc;padding:8px;text-align:center;">Aggiunti</th><th style="border-bottom:2px solid #ccc;padding:8px;text-align:center;"> Rimossi</th><th style="border-bottom:2px solid #ccc;padding:8px;text-align:right;">Peso Medio</th></tr>';
        
        items.forEach(item => {
            const avgWeight = item.count > 0 ? Math.round(item.totalWeight / item.count) : 0;
            const removedCount = item.removedCount || 0;
            html += `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${U.esc(item.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.count}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${removedCount}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${avgWeight}g</td></tr>`;
        });
        
        html += '</table><br>';
        html += '<button onclick="U.exportStats()" style="background:#4CAF50;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">📥 Scarica Report CSV</button>';
        html += '<button onclick="document.querySelector(\'.stats-modal\').remove()" style="background:#f44336;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin-left:10px;">Chiudi</button>';
        html += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'stats-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `<div style="background:white;padding:20px;border-radius:10px;max-width:600px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);">${html}</div>`;
        document.body.appendChild(modal);
    },
    
    toast(msg, type = 'success', undoCb = null) {
        clearTimeout(this._tid);
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        if (undoCb) el.onclick = () => { undoCb(); el.remove(); };
        document.body.appendChild(el);
        this._tid = setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(10px)';
            el.style.transition = '.3s';
            setTimeout(() => el.remove(), 300);
        }, undoCb ? 4500 : 2600);
    }
};

// ── STORAGE ──────────────────────────────────────────────────
const Storage = {
    KEY: 'packlist_v10014',
    TPL_KEY: 'packlist_tpl_v10014',
    VERSION: 1,
    _t: null,
    queueSave() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 280); },
    save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({ v: this.VERSION, list: STATE.list, config: STATE.config }));
        } catch(e) {
            if (e.name === 'QuotaExceededError') U.toast('⚠️ Memoria piena!', 'error');
        }
    },
    load() { try { const r = localStorage.getItem(this.KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
    getTpl() { try { return JSON.parse(localStorage.getItem(this.TPL_KEY) || '{}'); } catch { return {}; } },
    setTpl(obj) { try { localStorage.setItem(this.TPL_KEY, JSON.stringify(obj)); } catch(e) { U.toast('⚠️ Impossibile salvare template.', 'error'); } }
};

// ── VIEW ─────────────────────────────────────────────────────
const View = {
    list() {
        const res = document.getElementById('results');
        if (!Object.keys(STATE.list).length) {
            res.innerHTML = `<div class="empty-state"><div class="es-icon">🎒</div><p>Configura il viaggio e clicca "Genera Packlist"!</p></div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        const filter = STATE.filter;
        for (const cat in STATE.list) {
            const items = STATE.list[cat];
            if (!items?.length) continue;
            if (filter !== 'all') {
                const allowedCats = FILTER_MAP[filter] || [];
                if (!allowedCats.includes(cat)) continue;
            }
            const sorted = [...items].sort((a,b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
            const doneCount = sorted.filter(i => i.checked).length;
            const box = document.createElement('div');
            box.className = 'cat-box';
            box.dataset.cat = cat;
            box.innerHTML = `<div class="cat-header"><span class="cat-name">${U.esc(cat)}</span><span class="cat-count">${doneCount}/${items.length}</span></div>`;
            sorted.forEach(item => {
                const row = document.createElement('div');
                row.className = `item-row ${item.checked ? 'taken' : 'pending'}`;
                row.dataset.uid = item.uid;
                row.dataset.cat = cat;
                row.setAttribute('role', 'checkbox');
                row.setAttribute('aria-checked', item.checked);
                row.setAttribute('tabindex', '0');
                const bulkBadge = item.v >= 3 ? `<span class="badge" title="Ingombrante">📦</span>` : '';
                const wornBadge = item.worn ? `<span class="badge" title="Da indossare in viaggio">🧥</span>` : '';
                const protectedBadge = item.custom ? `<span class="badge" title="Item personale">⭐</span>` : '';
                const wDisplay = U.weight((item.w || 100) * item.q);
                row.innerHTML = `
                    <div class="item-content">
                        <span class="qty">${item.q}x</span>
                        <span class="item-text">${U.esc(item.n)}${bulkBadge}${wornBadge}${protectedBadge}</span>
                        <span class="item-weight">${wDisplay}</span>
                    </div>
                    <div class="item-actions">
                        <button class="ia-btn settings" data-action="settings" data-cat="${U.esc(cat)}" data-uid="${item.uid}" title="Impostazioni item">⚙️</button>
                        <button class="ia-btn del" data-action="del" data-cat="${U.esc(cat)}" data-uid="${item.uid}" title="Rimuovi">❌</button>
                    </div>`;
                box.appendChild(row);
            });
            const inputId = `add-${cat.replace(/\W/g,'')}`;
            const addRow = document.createElement('div');
            addRow.className = 'add-custom';
            addRow.innerHTML = `<input type="text" id="${inputId}" placeholder="+ Aggiungi item..." autocomplete="off"><button class="btn-sm" data-action="add" data-cat="${U.esc(cat)}" data-input="${inputId}">+ Add</button>`;
            box.appendChild(addRow);
            frag.appendChild(box);
        }
        if (frag.children.length === 0) {
            res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>Nessun item in questa categoria.</p></div>`;
        } else {
            res.innerHTML = '';
            res.appendChild(frag);
        }
    },
    stats() {
        const bar = document.getElementById('statsBar');
        const all = Object.values(STATE.list).flat();
        if (!all.length) { bar.classList.remove('visible'); return; }
        bar.classList.add('visible');
        const done = all.filter(i => i.checked).length, total = all.length;
        const pct = total ? Math.round(done / total * 100) : 0;
        document.getElementById('progressFill').style.width = `${pct}%`;
        const pctEl = document.getElementById('progressPct');
        pctEl.textContent = `${pct}%`;
        pctEl.className = 'pct-display' + (pct === 0 ? ' zero' : pct === 100 ? ' done' : ' mid');
        document.getElementById('itemsCount').textContent = `${done}/${total}`;
        const totalG = all.reduce((s,i) => s + (i.w||100) * i.q, 0);
        const wornG = all.filter(i => i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);
        const suitcaseG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);
        const wClass = suitcaseG === 0 ? 'neutral' : (suitcaseG >= 10000 ? 'heavy' : suitcaseG >= 5000 ? 'mid' : 'light');
        const sEl = document.getElementById('weightSuitcase');
        sEl.textContent = U.weight(suitcaseG);
        sEl.className = `chip-val ${wClass}`;
        document.getElementById('weightTotal').textContent = U.weight(totalG);
        const wornChip = document.getElementById('wornChip');
        if (wornG > 0) { wornChip.style.display = 'flex'; document.getElementById('wornWeight').textContent = U.weight(wornG); }
        else { wornChip.style.display = 'none'; }
        const fillEl = document.getElementById('weightFill');
        fillEl.style.width = `${Math.min(suitcaseG / 25000 * 100, 100)}%`;
        fillEl.className = `weight-fill ${wClass}`;
        const wt = document.querySelector('.weight-track');
        if(wt) wt.style.display = done > 0 ? 'block' : 'none';
    }
};

// ── CONTROLLER ───────────────────────────────────────────────
const Ctrl = {
    rerender() { View.list(); View.stats(); Storage.queueSave(); },

    syncConfig() {
        const oldNights = STATE.config.nights;
        STATE.config.nights = parseInt(document.getElementById('nights').value) || 0;
        STATE.config.gender = document.getElementById('gender').value;
        STATE.config.transport = document.getElementById('transport').value;
        STATE.config.laundryFreq = Math.max(1, parseInt(document.getElementById('laundryFreq').value) || 3);
        STATE.config.laundryBuffer = Math.max(0, parseInt(document.getElementById('laundryBuffer').value) || 1);
        STATE.config.activities = [...document.querySelectorAll('.act-btn.active')].map(el => el.id.replace('act-',''));
        
        // Se le notti sono cambiate, rigenera la lista dal database
        if (oldNights !== STATE.config.nights && PACKLIST_DATA) {
            STATE.list = generateListFromDB(STATE.config);
            console.log('[App] Lista rigenerata per', STATE.config.nights, 'notti');
        }
        
        const isDaytrip = STATE.config.nights === 0;
        document.getElementById('daytripBanner').classList.toggle('visible', isDaytrip);
        this._updateLaundryInfo();
        Storage.queueSave();
        this.rerender();
    },

    _updateLaundryInfo() {
        const info = document.getElementById('laundryInfo');
        if (!STATE.config.laundry || STATE.config.nights === 0) { info.classList.remove('visible'); return; }
        const n = STATE.config.nights, freq = STATE.config.laundryFreq, buf = STATE.config.laundryBuffer;
        const nCalc = Math.min(n, freq) + buf;
        info.textContent = `🧺 Porti ${nCalc} cambi — coprono ${Math.min(n, freq)} gg + ${buf} riserva (lavi e riusi)`;
        info.classList.add('visible');
    },

    toggleWeather(type) {
        const btn = document.getElementById(`w-${type}`);
        const idx = STATE.config.weather.indexOf(type);
        if (idx > -1) { STATE.config.weather.splice(idx,1); btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); }
        else { STATE.config.weather.push(type); btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); }
        Storage.queueSave();
    },

    toggleLaundry() {
        STATE.config.laundry = !STATE.config.laundry;
        document.getElementById('laundryToggle').classList.toggle('active', STATE.config.laundry);
        document.getElementById('laundryToggle').setAttribute('aria-pressed', STATE.config.laundry);
        document.getElementById('laundryFreqBox').classList.toggle('visible', STATE.config.laundry);
        this._updateLaundryInfo();
        Storage.queueSave();
    },

    toggleItem(cat, uid) { const item = STATE.list[cat]?.find(i => i.uid === uid); if (!item) return; item.checked = !item.checked; this.rerender(); },
    
    // Funzione unificata per le impostazioni dell'item (cappotto + bilancia + quantità in uno)
    editItemSettings(cat, uid) {
        const item = STATE.list[cat]?.find(i => i.uid === uid);
        if (!item) return;
        
        // Mostra menu con tutte le opzioni
        const currentStatus = item.worn ? 'Indossato 🧥' : 'In valigia 🎒';
        const options = [
            `1. [INDOSSATO/BAGAGLIO] Toggle stato: ${currentStatus}`,
            `2. [MODIFICA PESO] Attuale: ${U.weight(item.w)}`,
            `3. [MODIFICA QUANTITÀ] Attuale: ${item.q}x`,
            `4. Annulla`
        ].join('\n');
        
        const choice = prompt(`⚙️ IMPOSTAZIONI: "${item.n}"\n\n${options}\n\nScegli un'opzione (1-4):`);
        
        if (choice === '1') {
            const oldStatus = item.worn ? 'Indossato' : 'In valigia';
            item.worn = !item.worn;
            this.rerender();
            U.trackStats('destination', item.n, item.w, item.q);
            U.toast(`📦 Destinazione: ${oldStatus} → ${item.worn ? 'Indossato 🧥' : 'In valigia 🎒'}`);
        } else if (choice === '2') {
            const val = prompt(`[MODIFICA PESO]\nPeso attuale di "${item.n}": ${U.weight(item.w)}\n\nNuovo peso in grammi:`, item.w);
            if (val !== null) {
                const num = parseInt(val);
                if (isNaN(num) || num <= 0) {
                    U.toast('❌ Peso non valido!', 'error');
                } else {
                    const old = item.w;
                    item.w = num;
                    this.rerender();
                    U.trackStats('weight_change', item.n, num, item.q);
                    U.toast(`⚖️ Peso: ${U.weight(old)} → ${U.weight(num)}`);
                }
            }
        } else if (choice === '3') {
            const val = prompt(`[MODIFICA QUANTITÀ]\nQuantità attuale di "${item.n}": ${item.q}x\n\nNuova quantità:`, item.q);
            if (val !== null) {
                const num = parseInt(val);
                if (isNaN(num) || num <= 0) {
                    U.toast('❌ Quantità non valida!', 'error');
                } else {
                    const old = item.q;
                    item.q = num;
                    this.rerender();
                    U.trackStats('qty_change', item.n, item.w, num);
                    U.toast(`🔢 Quantità: ${old}x → ${num}x`);
                }
            }
        }
        // choice === '4' o null: annulla
    },

    editWeight(cat, uid) {
        const item = STATE.list[cat]?.find(i => i.uid === uid);
        if (!item) return;
        const val = prompt(`Peso attuale di "${item.n}": ${U.weight(item.w)}\n\nNuovo peso in grammi:`, item.w);
        if (val === null) return;
        const num = parseInt(val);
        if (isNaN(num) || num <= 0) return U.toast('❌ Peso non valido!', 'error');
        const old = item.w;
        item.w = num;
        this.rerender();
        U.toast(`⚖️ Peso: ${U.weight(old)} → ${U.weight(num)}`);
    },

    removeItem(cat, uid) {
        if (!STATE.list[cat]) return;
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (!item) return;
        if (item.custom && !confirm(`Rimuovere "${item.n}"?`)) return;
        // Registra statistica rimozione
        U.trackStats('remove', item.n, item.w || 100, item.q || 1);
        STATE.list[cat] = STATE.list[cat].filter(i => i.uid !== uid);
        if (!STATE.list[cat].length) delete STATE.list[cat];
        this.rerender();
        U.toast('🗑️ Item rimosso');
    },

    addCustom(cat, inputId) {
        const input = document.getElementById(inputId);
        const rawName = input?.value.trim();
        if (!rawName) return;
        
        // Chiedi il peso stimato
        const weightStr = prompt(`Inserisci il peso stimato di "${rawName}" in grammi (es. 150):`, "100");
        if (weightStr === null) return; // Annullato
        const weight = parseInt(weightStr) || 100;
        
        if (!STATE.list[cat]) STATE.list[cat] = [];
        
        const newItem = { n: rawName, q: 1, checked: false, uid: U.uid(), w: weight, v: 1, worn: false, custom: true };
        STATE.list[cat].push(newItem);
        
        // Registra statistica
        U.trackStats('add', rawName, weight, 1);
        
        input.value = '';
        this.rerender();
        U.toast('⭐ Item aggiunto!');
        setTimeout(() => input?.focus(), 40);
    },

    uncheckAll() {
        let count = 0;
        for (const c in STATE.list) {
            if (!STATE.list[c]) continue;
            STATE.list[c].forEach(i => { if (i.checked) { i.checked = false; count++; } });
        }
        if (count === 0) return U.toast('Nessuna spunta da azzerare ℹ️', 'warning');
        this.rerender();
        U.toast(`🧹 ${count} spunte azzerate! Lista intatta.`);
    },

    clearSearch() {
        const input = document.getElementById('searchItems');
        input.value = '';
        document.getElementById('searchClear').classList.remove('visible');
        this.filterList();
        input.focus();
    },

    resetSession() {
        if (!confirm('♻️ RESET SESSIONE\n\nVerranno azzerati lista, configurazioni, meteo e attività.\nI template salvati rimarranno intatti.\n\nContinuare?')) return;
        STATE.list = {};
        STATE.config = { ...DEFAULT_CONFIG };
        STATE.filter = 'all';
        STATE.currentTemplateName = '';
        document.getElementById('nights').value = DEFAULT_CONFIG.nights;
        document.getElementById('gender').value = DEFAULT_CONFIG.gender;
        document.getElementById('transport').value = DEFAULT_CONFIG.transport;
        document.getElementById('laundryFreq').value = DEFAULT_CONFIG.laundryFreq;
        document.getElementById('laundryBuffer').value = DEFAULT_CONFIG.laundryBuffer;
        document.getElementById('searchItems').value = '';
        document.getElementById('searchClear').classList.remove('visible');
        document.getElementById('templateSelect').value = '';
        STATE.config.weather = [];
        document.querySelectorAll('.weather-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        STATE.config.activities = [];
        document.querySelectorAll('.act-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        STATE.config.laundry = false;
        document.getElementById('laundryToggle').classList.remove('active');
        document.getElementById('laundryToggle').setAttribute('aria-pressed','false');
        document.getElementById('laundryFreqBox').classList.remove('visible');
        document.getElementById('laundryInfo').classList.remove('visible');
        document.getElementById('daytripBanner').classList.remove('visible');
        document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
        document.getElementById('filter-all').classList.add('active-filter');
        localStorage.removeItem(Storage.KEY);
        this.rerender();
        U.toast('♻️ Sessione completamente resettata!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    restoreConfig(cfg) {
        if (cfg.nights != null) document.getElementById('nights').value = cfg.nights;
        if (cfg.gender) document.getElementById('gender').value = cfg.gender;
        if (cfg.transport) document.getElementById('transport').value = cfg.transport;
        if (cfg.laundryFreq != null) document.getElementById('laundryFreq').value = cfg.laundryFreq;
        if (cfg.laundryBuffer != null) document.getElementById('laundryBuffer').value = cfg.laundryBuffer;
        document.getElementById('laundryToggle').classList.toggle('active', !!cfg.laundry);
        document.getElementById('laundryFreqBox').classList.toggle('visible', !!cfg.laundry);
        document.getElementById('daytripBanner').classList.toggle('visible', cfg.nights === 0);
        document.querySelectorAll('.weather-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        (cfg.weather || []).forEach(w => { const b = document.getElementById(`w-${w}`); if(b) { b.classList.add('active'); b.setAttribute('aria-pressed','true'); } });
        document.querySelectorAll('.act-btn').forEach(b => b.classList.remove('active'));
        (cfg.activities || []).forEach(id => { const b = document.getElementById(`act-${id}`); if(b) b.classList.add('active'); });
        this._updateLaundryInfo();
    },

    saveTemplate() {
        const name = document.getElementById('templateName').value.trim();
        if (!name) return U.toast('Inserisci un nome ⚠️', 'error');
        const tpl = Storage.getTpl();
        tpl[name] = { config: U.clone(STATE.config), list: U.clone(STATE.list) };
        Storage.setTpl(tpl);
        this.loadTemplateDropdown();
        U.toast(`💾 "${name}" salvato!`);
        document.getElementById('templateName').value = '';
    },

    loadTemplate(name) {
        const tpl = Storage.getTpl()[name];
        if (!tpl) return;
        if (!confirm(`📂 Caricare "${name}"?`)) { document.getElementById('templateSelect').value = ''; return; }
        STATE.list = U.clone(tpl.list || {});
        STATE.config = U.clone(tpl.config || { ...DEFAULT_CONFIG });
        Object.values(STATE.list).flat().forEach(i => i.checked = false);
        this.restoreConfig(STATE.config);
        this.rerender();
        STATE.currentTemplateName = name;
        U.toast(`📂 "${name}" caricato!`);
        document.getElementById('templateSelect').value = '';
    },

    deleteTemplate() {
        const name = document.getElementById('templateSelect').value;
        if (!name) return U.toast('Seleziona un template', 'error');
        if (!confirm(`Eliminare "${name}"?`)) return;
        if (name === STATE.currentTemplateName) STATE.currentTemplateName = '';
        const tpl = Storage.getTpl();
        delete tpl[name];
        Storage.setTpl(tpl);
        this.loadTemplateDropdown();
        U.toast(`🗑️ "${name}" eliminato`);
    },

    loadTemplateDropdown() {
        const sel = document.getElementById('templateSelect');
        sel.innerHTML = '<option value="">📂 Carica template...</option>';
        Object.keys(Storage.getTpl()).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            sel.appendChild(opt);
        });
    },

    filterList() {
        clearTimeout(this._searchT);
        this._searchT = setTimeout(() => {
            const term = document.getElementById('searchItems').value.toLowerCase();
            document.getElementById('searchClear').classList.toggle('visible', term.length > 0);
            document.querySelectorAll('.item-row').forEach(row => {
                row.style.display = (row.querySelector('.item-text')?.textContent.toLowerCase() || '').includes(term) ? 'flex' : 'none';
            });
            document.querySelectorAll('.cat-box').forEach(box => {
                box.style.display = [...box.querySelectorAll('.item-row')].some(r => r.style.display !== 'none') ? 'block' : 'none';
            });
        }, 180);
    },

    copyList() {
        let text = `🎒 PACKLIST${STATE.config.laundry ? ' 🧺' : ''}\n${'═'.repeat(42)}\n\n`;
        let suitcaseG = 0;
        for (const c in STATE.list) {
            if (!STATE.list[c].length) continue;
            text += `📦 ${c.toUpperCase()}\n`;
            [...STATE.list[c]].sort((a,b) => a.checked - b.checked).forEach(i => {
                text += `  ${i.checked ? '✅' : '⬜'} ${i.q}x ${i.n}${i.worn ? ' 🧥' : ''} (${U.weight((i.w||100)*i.q)})\n`;
                if (i.checked && !i.worn) suitcaseG += (i.w||100) * i.q;
            });
            text += '\n';
        }
        const all = Object.values(STATE.list).flat(), done = all.filter(i => i.checked).length;
        text += `📊 ${done}/${all.length} item (${all.length ? Math.round(done/all.length*100) : 0}%)\n⚖️ In valigia: ${U.weight(suitcaseG)}\n\nPacklist Pro v1.00.14 ✨`;
        navigator.clipboard.writeText(text)
            .then(() => U.toast('📋 Lista copiata!'))
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                U.toast('📋 Lista copiata!');
            });
    },

    exportPDF() {
        if (typeof window.jspdf === 'undefined') return U.toast('PDF non disponibile ❌', 'error');
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const tplName = document.getElementById('templateName').value.trim() || STATE.currentTemplateName || 'Packlist Pro';
            doc.setFontSize(13); doc.setTextColor(11,15,26);
            doc.text(tplName, 10, 14);
            doc.setFontSize(8); doc.setTextColor(100,116,139);
            doc.text(U.stripEmoji(`Notti: ${STATE.config.nights} · Mezzo: ${STATE.config.transport}${STATE.config.laundry ? ' · Lavanderia' : ''}`), 10, 21);
            doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 10, 27);
            let y = 33;
            for (const cat in STATE.list) {
                if (!STATE.list[cat].length) continue;
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 103, 242);
                doc.text(U.stripEmoji(cat.toUpperCase()), 10, y); y += 5;
                const rows = STATE.list[cat].map(i => [`${i.q}x`, U.stripEmoji(i.n) + (i.worn ? ' [ind.]' : ''), U.weight((i.w && !isNaN(i.w) ? i.w : 100) * i.q), i.checked ? '[x]' : '[ ]']);
                doc.autoTable({
                    startY: y, head: [['Qt.', 'Articolo', 'Peso', '']], body: rows, theme: 'grid',
                    headStyles: { fillColor: [90,103,242], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'left', cellPadding: 2 },
                    styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
                    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 24, halign: 'right' }, 3: { cellWidth: 10, halign: 'center' } },
                    margin: { left: 10, right: 10 }
                });
                y = doc.lastAutoTable.finalY + 4;
                if (y > 270) { doc.addPage(); y = 14; }
            }
            const all = Object.values(STATE.list).flat(), done = all.filter(i => i.checked).length;
            const bagG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + ((i.w && !isNaN(i.w) ? i.w : 100) * i.q), 0);
            doc.setFontSize(8); doc.setTextColor(71,85,105);
            doc.text(`Progresso: ${done}/${all.length} · In valigia: ${U.weight(bagG)}`, 10, y + 4);
            doc.setFontSize(7);
            doc.text('Packlist Pro v1.00.14', 10, y + 10);
            doc.save(`Packlist_${new Date().toLocaleDateString('it-IT').replace(/\//g,'-')}.pdf`);
            U.toast('📄 PDF esportato!');
        } catch(e) {
            console.error(e);
            U.toast(`❌ Errore PDF: ${e.message}`, 'error');
        }
    },

    generate() {
        try {
            if (Object.values(STATE.list).flat().some(i => i.checked) && !confirm('⚠️ Rigenerare sovrascriverà la lista. Continuare?')) return;
            this.syncConfig();
            const isDaytrip = STATE.config.nights === 0;
            STATE.list = generateListFromDB(STATE.config);
            WARNINGS.filter(w => w.check(STATE)).forEach((w, i) => setTimeout(() => U.toast(w.msg, 'warning'), i * 600));

            document.getElementById('searchItems').value = '';
            document.getElementById('searchClear').classList.remove('visible');
            this.rerender();
            const totalItems = Object.values(STATE.list).flat().length;
            const cfg = STATE.config; const nCalc = cfg.laundry ? Math.min(cfg.nights, cfg.laundryFreq) + cfg.laundryBuffer : (cfg.nights <= 2 ? cfg.nights : cfg.nights + 1); U.toast(`✅ ${totalItems} item · ${isDaytrip ? 'giornata' : cfg.laundry ? nCalc + ' cambi (lavanderia)' : nCalc + ' notti'}`);
            setTimeout(() => document.getElementById('statsBar').scrollIntoView({ behavior: 'smooth' }), 150);
        } catch(e) {
            console.error(e);
            U.toast(`❌ Errore generazione: ${e.message}`, 'error');
        }
    },

    _fabLock: false,
    toggleMenu() {
        if (this._fabLock) return;
        this._fabLock = true;
        setTimeout(() => this._fabLock = false, 300);
        const menu = document.getElementById('fabMenu');
        const btn = document.getElementById('fabMain');
        const isOpen = menu.classList.toggle('open');
        btn.classList.toggle('open', isOpen);
        btn.setAttribute('aria-expanded', isOpen);
    },

    setFilter(filterType) {
        STATE.filter = filterType;
        document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
        const activeBtn = document.getElementById(`filter-${filterType}`);
        if(activeBtn) activeBtn.classList.add('active-filter');
        if(window.innerWidth < 768) this.toggleMenu();
        this.rerender();
    }
};

// ── PWA APP MANAGER ──────────────────────────────────────────
const App = {
    _deferredPrompt: null,

    init() {
        // Offline indicator
        const updateOnlineStatus = () => {
            document.getElementById('offlineBar').classList.toggle('visible', !navigator.onLine);
        };
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        // Install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredPrompt = e;
            if (!localStorage.getItem('pwa_install_dismissed')) {
                document.getElementById('installBanner').classList.add('visible');
            }
        });

        window.addEventListener('appinstalled', () => {
            document.getElementById('installBanner').classList.remove('visible');
            this._deferredPrompt = null;
            U.toast('✅ Packlist Pro installata!');
        });
    },

    async install() {
        if (!this._deferredPrompt) return;
        this._deferredPrompt.prompt();
        const { outcome } = await this._deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('installBanner').classList.remove('visible');
        }
        this._deferredPrompt = null;
    },

    dismissInstall() {
        document.getElementById('installBanner').classList.remove('visible');
        localStorage.setItem('pwa_install_dismissed', '1');
    }
};

// ── EVENT LISTENERS ──────────────────────────────────────────
document.getElementById('results').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        e.stopPropagation();
        const { action, cat, uid, input: inputId } = btn.dataset;
        if (action === 'settings') Ctrl.editItemSettings(cat, uid);
        else if (action === 'del') Ctrl.removeItem(cat, uid);
        else if (action === 'add') Ctrl.addCustom(cat, inputId);
        return;
    }
    const row = e.target.closest('.item-row');
    if (row && !e.target.closest('input')) Ctrl.toggleItem(row.dataset.cat, row.dataset.uid);
});

document.getElementById('results').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('item-row')) {
        e.preventDefault();
        Ctrl.toggleItem(e.target.dataset.cat, e.target.dataset.uid);
    }
    if (e.key === 'Enter' && e.target.matches('.add-custom input')) {
        const cat = e.target.closest('.cat-box')?.dataset.cat;
        if (cat) { e.preventDefault(); Ctrl.addCustom(cat, e.target.id); }
    }
});

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('fabMenu');
        if (menu.classList.contains('open')) Ctrl.toggleMenu();
    }
    // Keyboard shortcut: Ctrl+G = Generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        Ctrl.generate();
    }
});

// Close FAB on outside click/tap
const closeFabOutside = (e) => {
    const container = document.querySelector('.fab-container');
    const menu = document.getElementById('fabMenu');
    if (!menu.classList.contains('open')) return;
    if (container.contains(e.target)) return;
    Ctrl.toggleMenu();
};
document.addEventListener('click', closeFabOutside);
document.addEventListener('touchstart', closeFabOutside, { passive: true });
window.addEventListener('scroll', () => {
    if (document.getElementById('fabMenu').classList.contains('open')) Ctrl.toggleMenu();
}, { passive: true });

// ── SERVICE WORKER ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('[App] SW registered:', reg.scope);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) reg.update();
            });
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        U.toast('🔄 Nuova versione disponibile! Tocca per aggiornare.', 'warning', () => {
                            newWorker.postMessage({ action: 'skipWaiting' });
                            window.location.reload();
                        });
                    }
                });
            });
        }).catch(err => console.warn('[App] SW registration failed:', err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    });
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
    // Carica il database JSON prima di inizializzare l'app
    const dbLoaded = await loadDatabase();
    if (!dbLoaded) {
        alert('Errore: impossibile caricare il database della lista. Riprova.');
        return;
    }
    
    // Inizializza la lista dal database
    STATE.list = generateListFromDB(STATE.config);
    
    // Build activity grid
    const grid = document.getElementById('activityGrid');
    ACTIVITIES.forEach(a => {
        const div = document.createElement('div');
        div.className = 'act-btn';
        div.id = `act-${a.id}`;
        div.setAttribute('role', 'button');
        div.setAttribute('aria-pressed', 'false');
        div.setAttribute('tabindex', '0');
        div.title = a.label;
        div.innerHTML = `<i>${a.icon}</i><span>${a.label}</span>`;
        grid.appendChild(div);
    });

    // Activity clicks
    grid.addEventListener('click', e => {
        const btn = e.target.closest('.act-btn');
        if (!btn) return;
        btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
        Ctrl.syncConfig();
    });

    // Activity keyboard
    grid.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('act-btn')) {
            e.preventDefault();
            e.target.click();
        }
    });

    // Restore saved state
    const data = Storage.load();
    if (data) {
        STATE.list = data.list || {};
        STATE.config = data.config || { ...DEFAULT_CONFIG };
        Ctrl.restoreConfig(STATE.config);
        if (Object.keys(STATE.list).length) Ctrl.rerender();
    }

    Ctrl.loadTemplateDropdown();
    App.init();

    // Handle ?action=new shortcut (PWA shortcut)
    if (new URLSearchParams(location.search).get('action') === 'new') {
        Ctrl.resetSession();
        history.replaceState(null, '', './');
    }
});
