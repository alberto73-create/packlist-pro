// js/modules/ui.js - Modulo View per la gestione dell'interfaccia utente - Versione v9.5 Fixed

/**
 * Renderizza la lista degli item
 */
export function list(state, U) {
    const res = document.getElementById('results');
    if (!Object.keys(state.list).length) {
        res.innerHTML = `<div class="empty-state"><div class="es-icon">🎒</div><p>Configura il viaggio e clicca "Genera Packlist"!</p></div>`;
        return;
    }

    const frag = document.createDocumentFragment();
    const filter = state.filter;

    for (const cat in state.list) {
        const items = state.list[cat];
        if (!items?.length) continue;

        let shouldShow = true;
        if (filter !== 'all') {
            const allowedCats = window.FILTER_MAP?.[filter] || [];
            shouldShow = allowedCats.includes(cat);
        }

        if (!shouldShow) continue;

        const sorted  = [...items].sort((a,b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
        const pending = sorted.filter(i => !i.checked).length;

        const box = document.createElement('div');
        box.className = 'cat-box';
        box.dataset.cat = cat;
        box.innerHTML = `<div class="cat-header"><span class="cat-name">${U.esc(cat)}</span><span class="cat-count">${pending}/${items.length}</span></div>`;

        sorted.forEach(item => {
            const row = createItemRow(item, cat, U);
            box.appendChild(row);
        });

        const inputId = `add-${cat.replace(/\W/g,'')}`;
        const addRow = document.createElement('div');
        addRow.className = 'add-custom';
        addRow.innerHTML = `
            <input type="text" id="${inputId}" placeholder="+ Aggiungi item personalizzato...">
            <button class="btn-sm" data-action="add" data-cat="${U.esc(cat)}" data-input="${inputId}">+ Add</button>`;
        box.appendChild(addRow);
        frag.appendChild(box);
    }

    if (frag.children.length === 0) {
         res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>Nessun item in questa categoria.</p></div>`;
    } else {
        res.innerHTML = '';
        res.appendChild(frag);
    }
}

/**
 * Crea una riga item per la lista
 */
export function createItemRow(item, cat, U) {
    const row = document.createElement('div');
    row.className = `item-row ${item.checked ? 'taken' : 'pending'}`;
    row.dataset.uid = item.uid;
    row.dataset.cat = cat;
    row.setAttribute('role', 'checkbox');
    row.setAttribute('aria-checked', item.checked);
    row.setAttribute('tabindex', '0');

    const bulkBadge      = item.v >= 3  ? `<span class="badge" title="Ingombrante">📦</span>` : '';
    const wornBadge      = item.worn     ? `<span class="badge" title="Da indossare in viaggio">🧥</span>` : '';
    const protectedBadge = item.custom   ? `<span class="badge" title="Item personale">⭐</span>` : '';
    const wDisplay       = U.weight((item.w || 100) * item.q);

    row.innerHTML = `
        <div class="item-content">
            <span class="qty">${item.q}x</span>
            <span class="item-text">${U.esc(item.n)}${bulkBadge}${wornBadge}${protectedBadge}</span>
            <span class="item-weight">${wDisplay}</span>
        </div>
        <div class="item-actions">
            <button class="ia-btn worn"
                data-action="worn" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                title="${item.worn ? 'Metti nello zaino' : 'Segna come indossato'}"
                aria-label="Toggle indossato">${item.worn ? '🧥' : '🎒'}</button>
            <button class="ia-btn edit"
                data-action="edit" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                title="Modifica peso" aria-label="Modifica peso">⚖️</button>
            <button class="ia-btn del"
                data-action="del" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                title="Rimuovi" aria-label="Rimuovi ${U.esc(item.n)}">✕</button>
        </div>`;
// js/modules/ui.js - Modulo View per la gestione dell'interfaccia utente

/**
 * Crea l'elemento DOM per un item
 */
export function createItemElement(item) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.dataset.id = item.id;
    row.dataset.category = item.category;
    
    const weightDisplay = `${item.weight.toFixed(2)} kg`;
    
    row.innerHTML = `
        <div class="item-content">
            <input type="checkbox" class="item-checkbox" aria-label="Seleziona ${item.name}">
            <span class="item-name">${item.name}</span>
            <span class="item-meta">${weightDisplay}</span>
        </div>
        <div class="item-actions">
            <button class="btn-qty btn-minus" aria-label="Diminuisci quantità">−</button>
            <span class="qty-display">${item.defaultQty}</span>
            <button class="btn-qty btn-plus" aria-label="Aumenta quantità">+</button>
            <button class="btn-gear" aria-label="Impostazioni">⚙️</button>
            <button class="btn-delete" aria-label="Elimina">✕</button>
        </div>
    `;
    
    return row;
}

/**
 * Aggiorna lo stato "preso" di una riga item
 */
export function updateItemRow(uid, checked) {
    const row = document.querySelector(`.item-row[data-uid="${uid}"]`);
    if (row) {
        row.classList.toggle('taken', checked);
        row.classList.toggle('pending', !checked);
        row.setAttribute('aria-checked', checked);
    }
}

/**
 * Applica lo stato "indossato" a un item
 */
export function applyWornStatus(uid, worn) {
    const row = document.querySelector(`.item-row[data-uid="${uid}"]`);
    if (row) {
        const btn = row.querySelector('.ia-btn.worn');
        if (btn) btn.innerHTML = worn ? '🧥' : '🎒';
    }
}

/**
 * Aggiorna la UI delle statistiche
 */
export function stats(state, U) {
    const bar = document.getElementById('statsBar');
    const all = Object.values(state.list).flat();
    if (!all.length) { 
        bar.classList.remove('visible'); 
        return; 
    }
    bar.classList.add('visible');

    const done  = all.filter(i => i.checked).length;
    const total = all.length;
    const pct   = total ? Math.round(done / total * 100) : 0;

    document.getElementById('progressFill').style.width = `${pct}%`;
    const pctEl = document.getElementById('progressPct');
    pctEl.textContent = `${pct}%`;
    pctEl.className   = 'pct-display' + (pct === 0 ? ' zero' : pct === 100 ? ' done' : ' mid');

    document.getElementById('itemsCount').textContent = `${done}/${total}`;

    const totalG    = all.reduce((s,i) => s + (i.w||100) * i.q, 0);
    const wornG     = all.filter(i => i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);
    const suitcaseG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);

    const wClass = suitcaseG >= 10000 ? 'heavy' : suitcaseG >= 5000 ? 'mid' : 'light';

    const sEl = document.getElementById('weightSuitcase');
    sEl.textContent = U.weight(suitcaseG);
    sEl.className   = `chip-val ${wClass}`;

    document.getElementById('weightTotal').textContent = U.weight(totalG);

    const wornChip = document.getElementById('wornChip');
    if (wornG > 0) {
        wornChip.style.display = 'flex';
        document.getElementById('wornWeight').textContent = U.weight(wornG);
    } else {
        wornChip.style.display = 'none';
    }

    const fillEl = document.getElementById('weightFill');
    fillEl.style.width = `${Math.min(suitcaseG / 25000 * 100, 100)}%`;
    fillEl.className   = `weight-fill ${wClass}`;
}

/**
 * Apre il modal delle impostazioni (placeholder)
 */
export function openSettingsModal() {
    console.log('Impostazioni non implementate');
}

/**
 * Mostra lo stato vuoto
 */
export function showEmptyState(message = 'Nessun elemento da mostrare') {
    const res = document.getElementById('results');
    res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>${message}</p></div>`;
 * Aggiorna una riga item esistente
 */
export function updateItemRow(row, item, newQty) {
    if (!row) return;
    
    const qtyDisplay = row.querySelector('.qty-display');
    if (qtyDisplay) {
        qtyDisplay.textContent = newQty;
    }
    
    // Aggiorna anche i dati meta se necessario
    const metaEl = row.querySelector('.item-meta');
    if (metaEl && item) {
        const weightDisplay = `${item.weight.toFixed(2)} kg`;
        metaEl.textContent = weightDisplay;
    }
}

/**
 * Applica lo stato "indossato" a una riga
 */
export function applyWornStatus(row, isWorn) {
    if (!row) return;
    
    if (isWorn) {
        row.classList.add('worn');
        row.classList.remove('checked');
    } else {
        row.classList.remove('worn');
    }
}

/**
 * Aggiorna l'UI delle statistiche
 */
export function updateStatsUI(totalWeight, totalItems) {
    // Le statistiche dettagliate sono gestite in controller.js
    // Questa funzione può essere usata per aggiornamenti specifici
    console.log(`[UI] Stats aggiornate: ${totalItems} items, ${totalWeight.toFixed(2)} kg`);
}

/**
 * Apre il modale impostazioni per un item
 */
export function openSettingsModal(item, currentState) {
    const actions = [
        'W - Toggle Indossato/Bagaglio',
        'P - Modifica Peso',
        'Q - Modifica Quantità',
        'C - Elimina Oggetto'
    ].join('\n');
    
    const action = prompt(
        `Impostazioni per: ${item.name}\n\n${actions}\n\nScegli un'azione:`,
        ''
    );
    
    return action;
}

/**
 * Mostra uno stato vuoto quando non ci sono elementi
 */
export function showEmptyState(container, message) {
    if (!container) return;
    
    container.innerHTML = `
        <div class="empty-state">
            <div class="es-icon">🎒</div>
            <p>${message || 'Nessun elemento da mostrare.'}</p>
        </div>
    `;
}

/**
 * Renderizza le attività nella griglia
 */
export function renderActivities(activities) {
    const grid = document.getElementById('activityGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    activities.forEach(a => {
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
}

/**
 * Aggiorna il banner daytrip
 */
export function updateDaytripBanner(isDaytrip) {
    const banner = document.getElementById('daytripBanner');
    if (banner) {
        banner.classList.toggle('visible', isDaytrip);
    }
}

/**
 * Aggiorna il toggle della lavanderia
 */
export function updateLaundryToggle(enabled) {
    const el = document.getElementById('laundryToggle');
    const freqBox = document.getElementById('laundryFreqBox');
    if (el) {
        el.classList.toggle('active', enabled);
        el.setAttribute('aria-pressed', enabled);
    }
    if (freqBox) {
        freqBox.classList.toggle('visible', enabled);
    }
}

/**
 * Aggiorna i bottoni meteo
 */
export function updateWeatherButtons(weatherTypes) {
    document.querySelectorAll('.weather-btn').forEach(b => { 
        b.classList.remove('active'); 
        b.setAttribute('aria-pressed','false'); 
    });
    (weatherTypes || []).forEach(w => {
        const b = document.getElementById(`w-${w}`);
        if (b) { 
            b.classList.add('active'); 
            b.setAttribute('aria-pressed','true'); 
        }
    });
}

/**
 * Aggiorna i bottoni attività
 */
export function updateActivityButtons(activityIds) {
    document.querySelectorAll('.act-btn').forEach(b => { 
        b.classList.remove('active'); 
        b.setAttribute('aria-pressed','false'); 
    });
    (activityIds || []).forEach(id => {
        const b = document.getElementById(`act-${id}`);
        if (b) { 
            b.classList.add('active'); 
            b.setAttribute('aria-pressed','true'); 
        }
    });
}

/**
 * Carica il dropdown dei template
 */
export function loadTemplateDropdown(getTplFn) {
    const sel = document.getElementById('templateSelect');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">📂 Carica template...</option>';
    const tpl = getTplFn();
    Object.keys(tpl).forEach(name => {
        const opt = document.createElement('option');
        opt.value = name; 
        opt.textContent = name;
        sel.appendChild(opt);
    });
}

/**
 * Filtra la lista in base al termine di ricerca
 */
export function filterListBySearch(term) {
    const searchLower = term.toLowerCase();
    document.querySelectorAll('.item-row').forEach(row => {
        const text = row.querySelector('.item-text')?.textContent.toLowerCase() || '';
        row.style.display = text.includes(searchLower) ? 'flex' : 'none';
    });
    document.querySelectorAll('.cat-box').forEach(box => {
        box.style.display = [...box.querySelectorAll('.item-row')].some(r => r.style.display !== 'none') ? 'block' : 'none';
    });
}

/**
 * Aggiorna il filtro attivo nel menu FAB
 */
export function updateFilterUI(filterType) {
    document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
    const activeBtn = document.getElementById(`filter-${filterType}`);
    if(activeBtn) activeBtn.classList.add('active-filter');
}

/**
 * Toggle del menu FAB
 */
export function toggleFabMenu() {
    const menu = document.getElementById('fabMenu');
    const btn = document.getElementById('fabMain');
    if (menu && btn) {
        menu.classList.toggle('open');
        btn.classList.toggle('open');
export async function renderActivities() {
    const { getDB } = await import('./db.js');
    const db = getDB();
    const grid = document.getElementById('activityGrid');
    
    if (!grid || !db.activities) return;
    
    grid.innerHTML = '';
    
    db.activities.forEach(act => {
        const card = document.createElement('div');
        card.className = 'activity-card';
        card.dataset.id = act.id;
        
        const isSelected = db.settings.selectedActivities?.includes(act.id);
        card.classList.toggle('selected', isSelected);
        
        card.innerHTML = `
            <div class="activity-icon">${act.icon}</div>
            <div class="activity-name">${act.name}</div>
        `;
        
        card.setAttribute('role', 'checkbox');
        card.setAttribute('aria-checked', isSelected);
        card.setAttribute('tabindex', '0');
        
        grid.appendChild(card);
    });
    
    // Aggiungi listener per il click sulle attività
    grid.addEventListener('click', handleActivityClick);
    grid.addEventListener('keydown', handleActivityKeydown);
}

/**
 * Gestisce il click su un'attività
 */
async function handleActivityClick(e) {
    const card = e.target.closest('.activity-card');
    if (!card) return;
    
    const actId = card.dataset.id;
    await toggleActivity(actId);
}

/**
 * Gestisce i tasti per le attività (accessibilità)
 */
async function handleActivityKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const card = e.target.closest('.activity-card');
        if (!card) return;
        
        const actId = card.dataset.id;
        await toggleActivity(actId);
    }
}

/**
 * Toggle selezione attività
 */
async function toggleActivity(actId) {
    const { getDB, saveLocalSettings } = await import('./db.js');
    const db = getDB();
    
    if (!db.settings.selectedActivities) {
        db.settings.selectedActivities = [];
    }
    
    const index = db.settings.selectedActivities.indexOf(actId);
    const isChecked = index === -1;
    
    if (isChecked) {
        db.settings.selectedActivities.push(actId);
    } else {
        db.settings.selectedActivities.splice(index, 1);
    }
    
    saveLocalSettings(db.settings);
    
    // Dispatch evento per il controller
    window.dispatchEvent(new CustomEvent('activity-changed', { 
        detail: { actId, isChecked } 
    }));
    
    // Aggiorna UI della card
    const card = document.querySelector(`.activity-card[data-id="${actId}"]`);
    if (card) {
        card.classList.toggle('selected', isChecked);
        card.setAttribute('aria-checked', isChecked);
    }
}

/**
 * Aggiorna il display del progresso
 */
export function updateProgressDisplay(pct, weightData) {
    const fillEl = document.getElementById('progressFill');
    const weightFillEl = document.getElementById('weightFill');
    const pctEl = document.getElementById('progressPct');
    
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (weightFillEl && weightData) {
        weightFillEl.style.width = `${Math.min(100, (weightData.total / 15) * 100)}%`;
    }
    if (pctEl) pctEl.textContent = `${pct}%`;
}

/**
 * Mostra il banner di installazione PWA
 */
export function showInstallBanner() {
    const banner = document.getElementById('installBanner');
    if (banner) {
        banner.style.display = 'flex';
    }
}
