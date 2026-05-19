// js/modules/ui.js - Gestione dell'Interfaccia Utente

/**
 * Renderizza la griglia delle attività
 */
export function renderActivities(container, activities, selectedActivities) {
    if (!container || !activities) return;

    container.innerHTML = '';
    activities.forEach(act => {
        const label = document.createElement('label');
        label.className = 'activity-chip';
        const isChecked = selectedActivities.includes(act.id);
        
        label.innerHTML = `
            <input type="checkbox" value="${act.id}" ${isChecked ? 'checked' : ''}>
            <span>${act.icon} ${act.name}</span>
        `;
        container.appendChild(label);
    });
}

/**
 * Crea l'elemento HTML per un item
 */
export function createItemElement(item, state = {}) {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.id = item.id;
    div.dataset.category = item.category;

    const qty = state.qty !== undefined ? state.qty : item.defaultQty;
    const isWorn = state.worn || false;

    if (isWorn) {
        div.style.opacity = '0.6';
        div.style.borderLeft = '4px solid #4CAF50';
    }

    const totalWeight = (item.weight * qty).toFixed(2);

    div.innerHTML = `
        <div class="item-info" style="flex-grow:1;">
            <div class="item-name">${item.name}</div>
            <div class="item-meta">${totalWeight}kg • Qty: ${qty}</div>
        </div>
        <div class="item-controls" style="display:flex; align-items:center; gap:8px;">
            <button class="btn-icon btn-qty" aria-label="Meno">-</button>
            <span class="qty-display">${qty}</span>
            <button class="btn-icon btn-qty" aria-label="Più">+</button>
            
            <div style="width:8px;"></div>
            
            <button class="btn-icon btn-gear" title="Impostazioni" aria-label="Impostazioni">⚙️</button>
            <button class="btn-icon btn-delete" title="Elimina" aria-label="Elimina">❌</button>
        </div>
    `;

    return div;
}

/**
 * Aggiorna la UI di un item specifico
 */
export function updateItemRow(row, item, newQty) {
    if (!row) return;
    
    row.querySelector('.qty-display').innerText = newQty;
    const weightSpan = row.querySelector('.item-meta');
    if (weightSpan) {
        const totalW = (newQty * item.weight).toFixed(2);
        weightSpan.innerText = `${totalW}kg • Qty: ${newQty}`;
    }
}

/**
 * Applica lo stato "indossato" alla row
 */
export function applyWornStatus(row, isWorn) {
    if (!row) return;
    
    row.style.opacity = isWorn ? '0.6' : '1';
    row.style.borderLeft = isWorn ? '4px solid #4CAF50' : 'none';
}

/**
 * Aggiorna la barra delle statistiche
 */
export function updateStatsUI(totalWeight, totalItems) {
    const wEl = document.getElementById('total-weight');
    const iEl = document.getElementById('total-items');
    
    if(wEl) wEl.innerText = `${totalWeight.toFixed(2)} kg`;
    if(iEl) iEl.innerText = totalItems;
}

/**
 * Mostra/nasconde il banner di installazione
 */
export function showInstallBanner(show) {
    const banner = document.getElementById('installBanner');
    if (banner) {
        if (show) {
            banner.classList.add('visible');
        } else {
            banner.classList.remove('visible');
        }
    }
}

/**
 * Mostra/nasconde la barra delle statistiche
 */
export function showStatsBar(show) {
    const bar = document.getElementById('statsBar');
    if (bar) {
        if (show) {
            bar.classList.add('visible');
        } else {
            bar.classList.remove('visible');
        }
    }
}

/**
 * Aggiorna il display della percentuale di progresso
 */
export function updateProgressDisplay(pct, fillElementId) {
    const pctEl = document.getElementById('progressPct');
    const fillEl = document.getElementById(fillElementId);
    
    if (pctEl) {
        pctEl.innerText = `${pct}%`;
        pctEl.className = 'pct-display';
        if (pct === 0) pctEl.classList.add('zero');
        else if (pct >= 100) pctEl.classList.add('done');
        else if (pct >= 50) pctEl.classList.add('mid');
    }
    
    if (fillEl) {
        fillEl.style.width = `${pct}%`;
    }
}

/**
 * Apre il modale impostazioni (prompt-based)
 */
export function openSettingsModal(item, currentState) {
    const currentQty = currentState.qty !== undefined ? currentState.qty : item.defaultQty;
    const currentWeight = item.weight;
    const isWorn = currentState.worn || false;
    const destText = isWorn ? "INDOSSATO" : "IN BAGAGLIO";

    const action = prompt(
        `IMPOSTAZIONI: ${item.name}\n` +
        `--------------------------\n` +
        `Stato: [${destText}]\n` +
        `Peso: ${currentWeight} kg | Qty: ${currentQty}\n\n` +
        `Digita una lettera:\n` +
        `[W] Cambia destinazione (Indossato/Bagaglio)\n` +
        `[P] Modifica Peso\n` +
        `[Q] Modifica Quantità\n` +
        `[C] Cancella Oggetto\n` +
        `--------------------------`
    );

    return action;
}

/**
 * Mostra messaggio empty state
 */
export function showEmptyState(container, message = "Nessun oggetto da mostrare.") {
    container.innerHTML = `<div class="empty-state">${message}</div>`;
}
