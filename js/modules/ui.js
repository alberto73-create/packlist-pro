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
