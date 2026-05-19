// js/modules/ui.js - Gestione dell'Interfaccia Utente - Versione Riscritta da Zero

import { getDB } from './db.js';

/**
 * Renderizza la griglia delle attività con gestione eventi corretta
 */
export function renderActivities() {
    const db = getDB();
    const container = document.getElementById('activityGrid');
    if (!container || !db.activities) {
        console.warn('[UI] activityGrid non trovato o activities vuoto');
        return;
    }

    // Svuota il container
    container.innerHTML = '';
    
    const selectedActivities = db.settings.selectedActivities || [];
    
    // Crea ogni chip attività
    db.activities.forEach(act => {
        const label = document.createElement('label');
        label.className = 'activity-chip';
        
        const isChecked = selectedActivities.includes(act.id);
        
        label.innerHTML = `
            <input type="checkbox" value="${act.id}" ${isChecked ? 'checked' : ''}>
            <span>${act.icon} ${act.name}</span>
        `;
        
        container.appendChild(label);
    });
    
    // Aggiungi listener DELEGATO per tutti i checkbox
    container.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            const actId = parseInt(e.target.value);
            const isChecked = e.target.checked;
            
            console.log('[UI] Checkbox cambiato:', actId, isChecked);
            
            // Aggiorna il database
            if (isChecked) {
                if (!db.settings.selectedActivities.includes(actId)) {
                    db.settings.selectedActivities.push(actId);
                }
            } else {
                db.settings.selectedActivities = db.settings.selectedActivities.filter(id => id !== actId);
            }
            
            // Salva in localStorage
            localStorage.setItem('packlist_settings', JSON.stringify(db.settings));
            
            // Dispatch evento per il controller
            window.dispatchEvent(new CustomEvent('activity-changed', { 
                detail: { actId, isChecked } 
            }));
        }
    });
    
    console.log('[UI] Attività renderizzate:', db.activities.length);
}

/**
 * Crea l'elemento HTML per un item - Versione Ottimizzata
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

    // Usa createElement invece di innerHTML per migliorare sicurezza e prestazioni
    const infoDiv = document.createElement('div');
    infoDiv.className = 'item-info';
    infoDiv.style.flexGrow = '1';
    
    const nameDiv = document.createElement('div');
    nameDiv.className = 'item-name';
    nameDiv.textContent = item.name; // textContent è più sicuro di innerHTML
    
    const metaDiv = document.createElement('div');
    metaDiv.className = 'item-meta';
    metaDiv.textContent = `${totalWeight}kg • Qty: ${qty}`;
    
    infoDiv.appendChild(nameDiv);
    infoDiv.appendChild(metaDiv);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'item-controls';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.alignItems = 'center';
    controlsDiv.style.gap = '8px';
    
    const btnMinus = document.createElement('button');
    btnMinus.className = 'btn-icon btn-qty';
    btnMinus.setAttribute('aria-label', 'Meno');
    btnMinus.textContent = '-';
    
    const qtyDisplay = document.createElement('span');
    qtyDisplay.className = 'qty-display';
    qtyDisplay.textContent = qty;
    
    const btnPlus = document.createElement('button');
    btnPlus.className = 'btn-icon btn-qty';
    btnPlus.setAttribute('aria-label', 'Più');
    btnPlus.textContent = '+';
    
    const spacer = document.createElement('div');
    spacer.style.width = '8px';
    
    const btnGear = document.createElement('button');
    btnGear.className = 'btn-icon btn-gear';
    btnGear.setAttribute('title', 'Impostazioni');
    btnGear.setAttribute('aria-label', 'Impostazioni');
    btnGear.textContent = '⚙️';
    
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-icon btn-delete';
    btnDelete.setAttribute('title', 'Elimina');
    btnDelete.setAttribute('aria-label', 'Elimina');
    btnDelete.textContent = '❌';
    
    controlsDiv.appendChild(btnMinus);
    controlsDiv.appendChild(qtyDisplay);
    controlsDiv.appendChild(btnPlus);
    controlsDiv.appendChild(spacer);
    controlsDiv.appendChild(btnGear);
    controlsDiv.appendChild(btnDelete);
    
    div.appendChild(infoDiv);
    div.appendChild(controlsDiv);

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
