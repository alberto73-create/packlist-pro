// js/modules/ui.js - Modulo View per la gestione dell'interfaccia utente

import { FILTER_MAP } from './db.js';

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
    const allowedCats = state.filter === 'all' ? null : FILTER_MAP?.[state.filter] || [];
    for (const bag of state.baggages) {
        const bagItems = Object.values(state.list).flat().filter(item => item.baggageId === bag.id && (!allowedCats || allowedCats.includes(item.cat)));
        if (!bagItems.length) continue;
        const weight = bagItems.filter(item => !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
        const overLimit = bag.limit > 0 && weight > bag.limit * 1000;
        const section = document.createElement('section');
        section.className = `baggage-section${overLimit ? ' over-limit' : ''}`;
        section.dataset.baggageId = bag.id;
        section.innerHTML = `<button type="button" class="baggage-header baggage-toggle" aria-expanded="true"><span class="baggage-heading"><span class="baggage-kicker">🎒 Bagaglio</span><span class="baggage-title">${U.esc(bag.name)}</span></span><span class="baggage-header-actions"><span class="baggage-weight${overLimit ? ' over-limit' : ''}">${U.weight(weight)}${bag.limit ? `<small> / ${bag.limit} kg</small>` : ''}</span><i aria-hidden="true"></i></span></button>`;

        for (const cat in state.list) {
            if (allowedCats && !allowedCats.includes(cat)) continue;
            const items = state.list[cat].filter(item => item.baggageId === bag.id);
            if (!items.length) continue;
            const sorted = [...items].sort((a,b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
            const box = document.createElement('div');
            box.className = `cat-box${sorted.every(item => item.checked) ? ' complete' : ''}`; box.dataset.cat = cat;
            box.innerHTML = `<button type="button" class="cat-header cat-toggle" aria-expanded="true"><span class="cat-name">${U.esc(cat)}</span><span class="cat-count">${sorted.filter(i => !i.checked).length}/${items.length}</span><i aria-hidden="true"></i></button>`;
            const catItems = document.createElement('div');
            catItems.className = 'cat-items';
            sorted.forEach(item => catItems.appendChild(createItemRow(item, cat, U)));
            const addRow = document.createElement('div'); addRow.className = 'add-custom';
            addRow.innerHTML = `<input type="text" placeholder="+ Aggiungi item personalizzato..." aria-label="Nuovo item in ${U.esc(cat)}"><button type="button" class="btn-sm" data-action="add">+ Aggiungi</button>`;
            catItems.appendChild(addRow); box.appendChild(catItems); section.appendChild(box);
        }
        frag.appendChild(section);
    }
    res.innerHTML = '';
    if (frag.children.length) res.appendChild(frag);
    else res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>Nessun item in questa categoria.</p></div>`;
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

    const badges = [
        item.worn ? '<span class="item-badge worn-badge">Indossato</span>' : '',
        item.bulky ? '<span class="item-badge bulky-badge">Voluminoso</span>' : '',
        item.custom ? '<span class="item-badge custom-badge">Personale</span>' : ''
    ].join('');

    row.innerHTML = `
        <div class="item-content">
            <span class="qty">${item.q}×</span>
            <span class="item-main">
                <span class="item-text">${U.esc(item.n)}</span>
                <span class="item-meta"><span class="item-weight">${U.weight((item.w || 100) * item.q)}</span>${badges}</span>
            </span>
        </div>
        <div class="item-actions">
            <button type="button" class="ia-btn options" data-action="options" title="Opzioni articolo" aria-label="Opzioni per ${U.esc(item.n)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.5 1A8 8 0 0 0 15 6l-.4-2.6h-4L10 6a8 8 0 0 0-1.5 1L6 6 4 9.4 6.1 11a7 7 0 0 0 0 2L4 14.6 6 18l2.5-1a8 8 0 0 0 1.5 1l.5 2.6h4L15 18a8 8 0 0 0 1.5-1l2.5 1 2-3.4-2.1-1.6a7 7 0 0 0 .1-1Z"/></svg>
            </button>
            <button type="button" class="ia-btn del" data-action="del" title="Elimina" aria-label="Elimina ${U.esc(item.n)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17"/></svg>
            </button>
        </div>`;
    return row;
}

export function openItemOptions(item, baggages = [], U) {
    const modal = document.getElementById('itemOptionsModal');
    if (!modal || !item) return;
    modal.dataset.uid = item.uid;
    document.getElementById('itemOptionsTitle').textContent = item.n;
    document.getElementById('itemQuantity').value = item.q;
    document.getElementById('itemWeight').value = item.w || 100;
    document.getElementById('itemWornToggle').checked = Boolean(item.worn);
    document.getElementById('itemBulkyToggle').checked = Boolean(item.bulky);
    const baggageSelect = document.getElementById('itemBaggage');
    if (baggageSelect) {
        baggageSelect.innerHTML = baggages.map(bag => `<option value="${bag.id}">${U?.esc(bag.name) || bag.name}</option>`).join('');
        baggageSelect.value = item.baggageId || baggages[0]?.id || '';
    }
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('itemQuantity').focus();
}

export function closeItemOptions() {
    const modal = document.getElementById('itemOptionsModal');
    if (!modal) return;
    modal.classList.remove('visible');
    modal.setAttribute('aria-hidden', 'true');
    delete modal.dataset.uid;
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
        const box = row.closest('.cat-box');
        const count = box?.querySelector('.cat-count');
        if (count) {
            const rows = box.querySelectorAll('.item-row');
            const pending = [...rows].filter(itemRow => !itemRow.classList.contains('taken')).length;
            count.textContent = `${pending}/${rows.length}`;
            box?.classList.toggle('complete', pending === 0);
        }
    }
}

/**
 * Applica lo stato "indossato" a un item
 */
export function applyWornStatus(uid, worn) {
    const row = document.querySelector(`.item-row[data-uid="${uid}"]`);
    if (row) {
        const btn = row.querySelector('.ia-btn.worn');
        if (btn) {
            btn.textContent = worn ? '🧥' : '🎒';
            btn.title = worn ? 'Metti nello zaino' : 'Segna come indossato';
            btn.setAttribute('aria-label', btn.title);
        }
    }
}

export function openBaggageSetup() {
    const modal = document.getElementById('baggageSetupModal');
    if (!modal) return;
    renderBaggageSetupFields(1);
    modal.classList.add('visible'); modal.setAttribute('aria-hidden', 'false');
}

export function renderBaggageSetupFields(count) {
    const container = document.getElementById('baggageSetupNames'); if (!container) return;
    const total = Math.max(1, Math.min(12, Number(count) || 1));
    container.innerHTML = Array.from({ length: total }, (_, index) => `<label>Nome bagaglio ${index + 1}<input class="baggage-setup-name" value="Bagaglio ${index + 1}" placeholder="Es. Trolley 10kg"></label>`).join('');
}

export function closeBaggageSetup() {
    const modal = document.getElementById('baggageSetupModal'); modal?.classList.remove('visible'); modal?.setAttribute('aria-hidden', 'true');
}

export function openBaggageManager(state, U) {
    const modal = document.getElementById('baggageManagerModal'); const rows = document.getElementById('baggageManagerRows');
    if (!modal || !rows) return;
    const all = Object.values(state.list).flat();
    rows.innerHTML = state.baggages.map(bag => {
        const count = all.filter(item => item.baggageId === bag.id).length;
        const options = state.baggages.filter(other => other.id !== bag.id).map(other => `<option value="${other.id}">${U.esc(other.name)}</option>`).join('');
        return `<div class="baggage-manage-row" data-baggage-id="${bag.id}"><div class="baggage-manage-fields"><label>Nome<input data-field="name" value="${U.esc(bag.name)}"></label><label>Limite kg<input data-field="limit" type="number" min="0" step="0.1" value="${bag.limit || ''}" placeholder="Nessuno"></label></div><div class="baggage-manage-meta">${count} articoli</div><div class="baggage-manage-actions"><select data-field="target" ${options ? '' : 'disabled'}><option value="">Sposta tutto in…</option>${options}</select><button class="btn-secondary" data-baggage-action="move" ${options ? '' : 'disabled'}>Sposta tutto</button><button class="btn-secondary danger" data-baggage-action="delete" ${state.baggages.length > 1 ? '' : 'disabled'}>Elimina</button></div></div>`;
    }).join('');
    modal.classList.add('visible'); modal.setAttribute('aria-hidden', 'false');
}

export function closeBaggageManager() {
    const modal = document.getElementById('baggageManagerModal'); modal?.classList.remove('visible'); modal?.setAttribute('aria-hidden', 'true');
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

    const strips = document.getElementById('baggageWeightStrips');
    if (strips) {
        strips.innerHTML = state.baggages.map(bag => {
            const bagWeight = all.filter(item => item.baggageId === bag.id && !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
            const bagLimitG = bag.limit ? bag.limit * 1000 : 25000;
            const bagClass = bagWeight >= 10000 ? 'heavy' : bagWeight >= 5000 ? 'mid' : 'light';
            const pct = Math.min(bagWeight / Math.max(1, bagLimitG) * 100, 100);
            return `<div class="baggage-weight-strip"><div><strong>${U.esc(bag.name)}</strong><span>${U.weight(bagWeight)}${bag.limit ? ` / ${bag.limit} kg` : ''}</span></div><div class="weight-track"><div class="weight-fill ${bagClass}" style="width:${pct}%"></div></div></div>`;
        }).join('');
    }
}

/**
 * Mostra lo stato vuoto
 */
export function showEmptyState(message = 'Nessun elemento da mostrare') {
    const res = document.getElementById('results');
    res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>${message}</p></div>`;
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
    const searchLower = term.trim().toLowerCase();
    document.querySelectorAll('.item-row').forEach(row => {
        const label = row.querySelector('.item-text');
        const original = label?.dataset.searchText || label?.textContent || '';
        if (label) label.dataset.searchText = original;
        const text = original.toLowerCase();
        row.style.display = text.includes(searchLower) ? 'flex' : 'none';
        if (label) {
            label.replaceChildren();
            const start = searchLower ? text.indexOf(searchLower) : -1;
            if (start < 0) label.textContent = original;
            else {
                label.append(document.createTextNode(original.slice(0, start)));
                const mark = document.createElement('mark');
                mark.textContent = original.slice(start, start + searchLower.length);
                label.append(mark, document.createTextNode(original.slice(start + searchLower.length)));
            }
        }
    });
    document.querySelectorAll('.cat-box').forEach(box => {
        box.style.display = [...box.querySelectorAll('.item-row')].some(r => r.style.display !== 'none') ? 'block' : 'none';
    });
}

export function openStatsSummary({ done, total, totalWeight, suitcaseWeight, wornWeight, baggageLines, baggageWeights = [], categories = [], baggages = [] }) {
    const modal = document.getElementById('statsSummaryModal');
    const content = document.getElementById('statsSummaryContent');
    if (!modal || !content) return;
    const safe = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
    content.innerHTML = `<div class="stats-summary-grid"><div><strong>${safe(done)}/${safe(total)}</strong><span>Item presi</span></div><div><strong>${safe(totalWeight)}</strong><span>Peso totale</span></div><div><strong>${safe(suitcaseWeight)}</strong><span>In valigia</span></div><div><strong>${safe(wornWeight)}</strong><span>Indossato</span></div></div><div class="stats-baggage-tools"><button type="button" class="btn-secondary" id="statsManageBaggages">🧳 Gestisci Bagagli</button><label class="option-field"><span><strong>Vista peso</strong><small>Totale o diviso per bagaglio</small></span><select id="statsWeightMode"><option value="total">Peso totale</option><option value="baggage">Peso per bagaglio</option></select></label></div><div class="quick-baggage-move"><h3>Spostamenti rapidi</h3><div><select id="quickMoveCategory">${categories.map(cat => `<option value="${safe(cat)}">${safe(cat)}</option>`).join('')}</select><select id="quickMoveBaggage">${baggages.map(bag => `<option value="${safe(bag.id)}">${safe(bag.name)}</option>`).join('')}</select><button type="button" class="btn-secondary" id="quickMoveApply">Sposta categoria nel bagaglio</button></div><small>Esempio: seleziona Trekking e Zaino trekking per spostare tutto l’equipaggiamento tecnico in un solo bagaglio.</small></div><div id="statsWeightTotal"><h3>Peso totale</h3><ul><li>Totale lista: ${safe(totalWeight)}</li><li>In valigia: ${safe(suitcaseWeight)}</li><li>Indossato: ${safe(wornWeight)}</li></ul></div><div id="statsWeightBaggage" hidden><h3>Peso per bagaglio</h3><ul>${baggageWeights.map(bag => `<li>${safe(bag.name)}: ${safe(bag.weight)}${bag.limit ? ` / ${safe(bag.limit)} kg` : ''}</li>`).join('')}</ul></div><h3>Bagagli</h3><ul>${baggageLines.map(line => `<li>${safe(line)}</li>`).join('')}</ul>`;
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('statsSummaryClose')?.focus();
}

export function closeStatsSummary() {
    const modal = document.getElementById('statsSummaryModal');
    modal?.classList.remove('visible');
    modal?.setAttribute('aria-hidden', 'true');
}

/**
 * Aggiorna il filtro attivo nel menu FAB
 */
export function updateFilterUI(filterType) {
    document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
    const activeBtn = document.getElementById(`filter-${filterType}`);
    if(activeBtn) activeBtn.classList.add('active-filter');
}

// Export default con tutte le funzioni pubbliche
export default {
    list,
    createItemRow,
    updateItemRow,
    applyWornStatus,
    stats,
    showEmptyState,
    updateDaytripBanner,
    updateLaundryToggle,
    updateWeatherButtons,
    updateActivityButtons,
    loadTemplateDropdown,
    filterListBySearch,
    openStatsSummary,
    closeStatsSummary,
    updateFilterUI
};
