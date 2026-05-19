// js/modules/controller.js - Logica di Controllo dell'Applicazione - Versione Corretta

import { getDB, getItemById, getActivityName, trackStats, removeItemFromList, updateItemQty, setItemQty, toggleWornStatus } from './db.js';
import { createItemElement, updateItemRow, applyWornStatus, updateStatsUI, openSettingsModal, showEmptyState } from './ui.js';

/**
 * Debounce per prevenire chiamate multiple ravvicinate
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Genera la lista dal database - Funzione Core
 */
function generateListFromDBCore() {
    const db = getDB();
    const listContainer = document.getElementById('results');
    if (!listContainer) {
        console.warn('[Controller] Container risultati non trovato');
        return;
    }

    // Usa DocumentFragment per minimizzare i reflow
    const fragment = document.createDocumentFragment();
    
    const selectedActs = db.settings.selectedActivities || [];
    const hasActivitiesSelected = selectedActs.length > 0;

    // 1. Determina quali categorie mostrare
    const visibleCategories = db.categories.filter(cat => {
        // Le categorie ESSENZIALI si vedono SEMPRE
        if (cat.essential) return true;
        
        // Le categorie NON essenziali si vedono SOLO se:
        // A) È selezionata almeno un'attività
        // B) La categoria contiene oggetti pertinenti a quelle attività
        if (!hasActivitiesSelected) return false;

        return db.items.some(item => 
            item.category === cat.id && 
            (item.activities.length === 0 || item.activities.some(a => selectedActs.includes(a)))
        );
    });

    // 2. Genera elementi per ogni categoria visibile
    visibleCategories.forEach(cat => {
        // Filtra gli oggetti dentro questa categoria
        const itemsForCat = db.items.filter(item => {
            if (item.category !== cat.id) return false;
            
            // Oggetti senza attività specifica (generici) -> Sempre inclusi se la categoria è visibile
            if (item.activities.length === 0) return true;

            // Oggetti specifici -> Inclusi solo se matching con attività selezionate
            return item.activities.some(actId => selectedActs.includes(actId));
        });

        itemsForCat.forEach(item => {
            const itemEl = createItemElement(item);
            fragment.appendChild(itemEl);
        });
    });

    // Svuota e aggiungi tutto in una volta sola
    listContainer.innerHTML = '';
    listContainer.appendChild(fragment);

    if (listContainer.children.length === 0) {
        showEmptyState(listContainer, "Nessun oggetto da mostrare. Seleziona un'attività o controlla i filtri.");
    }
    
    calculateAndDisplayStatsCore();
}

// Versione debounced di generateListFromDB per evitare refresh multipli
const debouncedGenerateList = debounce(generateListFromDBCore, 150);

/**
 * Setup listener per eventi di attività - DA CHIAMARE DOPO IL DOMContentLoaded
 */
export function setupActivityListener() {
    window.addEventListener('activity-changed', (e) => {
        const { actId, isChecked } = e.detail;
        
        // Registra statistiche quando un'attività cambia
        if (isChecked) {
            trackStats('ATTIVITA_AGGIUNTA', actId, `Attività: ${getActivityName(actId)}`);
        } else {
            trackStats('ATTIVITA_RIMOSSA', actId, `Attività: ${getActivityName(actId)}`);
        }
        
        // Rigenera la lista con debounce quando un'attività cambia
        console.log('[Controller] Attività cambiata:', actId, isChecked);
        debouncedGenerateList();
    });
}

/**
 * Calcola e mostra le statistiche - Versione Corretta
 */
const debouncedCalculateStats = debounce(calculateAndDisplayStatsCore, 100);

export function calculateAndDisplayStats() {
    calculateAndDisplayStatsCore();
}

function calculateAndDisplayStatsCore() {
    let totalWeight = 0;
    let totalItems = 0;
    let checkedItems = 0;
    let totalPossibleItems = 0;

    // Cache delle query per migliorare le prestazioni
    const itemRows = document.querySelectorAll('.item-row');
    
    itemRows.forEach(row => {
        const qtyDisplay = row.querySelector('.qty-display');
        const qtyText = qtyDisplay?.innerText || '0';
        const qty = parseInt(qtyText, 10);
        
        const metaEl = row.querySelector('.item-meta');
        const metaText = metaEl?.innerText || '';
        const weightPart = metaText.split('kg')[0];
        const weight = parseFloat(weightPart);

        if (!isNaN(qty) && !isNaN(weight)) {
            totalItems += qty;
            totalWeight += (weight * qty);
            totalPossibleItems += qty;
        }
        
        if (row.classList.contains('checked')) {
            checkedItems += qty;
        }
    });

    // Aggiorna UI statistiche
    updateStatsUI(totalWeight, totalItems);
    
    // Aggiorna progress bar
    const pct = totalPossibleItems > 0 ? Math.round((checkedItems / totalPossibleItems) * 100) : 0;
    
    const fillEl = document.getElementById('progressFill');
    const weightFillEl = document.getElementById('weightFill');
    
    if (fillEl) fillEl.style.width = `${pct}%`;
    if (weightFillEl) {
        weightFillEl.style.width = `${Math.min(100, (totalWeight / 15) * 100)}%`;
    }
    
    // Aggiorna chips statistiche
    const itemsCountEl = document.getElementById('itemsCount');
    const weightSuitcaseEl = document.getElementById('weightSuitcase');
    const weightTotalEl = document.getElementById('weightTotal');
    
    if (itemsCountEl) itemsCountEl.innerText = `${checkedItems}/${totalPossibleItems}`;
    if (weightSuitcaseEl) weightSuitcaseEl.innerText = `${(totalWeight * 1000).toFixed(0)} g`;
    if (weightTotalEl) weightTotalEl.innerText = `${(totalWeight * 1000).toFixed(0)} g`;
}

/**
 * Genera la lista dal database - Export pubblico
 */
export function generateListFromDB() {
    generateListFromDBCore();
}

/**
 * Setup event listeners per la lista
 */
export function setupListEventListeners(callbacks) {
    const listContainer = document.getElementById('results');
    if (!listContainer) return;

    listContainer.addEventListener('click', (e) => {
        const target = e.target;
        const row = target.closest('.item-row');
        
        if (!row) return;
        
        const itemId = row.dataset.id;
        const category = row.dataset.category;

        // Rotella Impostazioni
        if (target.classList.contains('btn-gear') || target.closest('.btn-gear')) {
            e.stopPropagation();
            if (callbacks.onSettings) callbacks.onSettings(category, itemId);
            return;
        }

        // Elimina (X)
        if (target.classList.contains('btn-delete') || target.closest('.btn-delete')) {
            e.stopPropagation();
            if (confirm(`Eliminare definitivamente "${getItemById(itemId)?.name || itemId}"?`)) {
                removeItemFromList(itemId);
                if (callbacks.onDelete) callbacks.onDelete(itemId);
            }
            return;
        }
        
        // Quantità +/-
        if (target.classList.contains('btn-qty')) {
            const delta = target.textContent === '+' ? 1 : -1;
            const newQty = updateItemQty(itemId, delta);
            
            const item = getItemById(itemId);
            updateItemRow(row, item, newQty);
            
            if (callbacks.onQtyChange) callbacks.onQtyChange(itemId, delta);
            return;
        }
        
        // Toggle checkbox item
        if (target.type === 'checkbox' || row.querySelector('input[type="checkbox"]')?.contains(target)) {
            row.classList.toggle('checked');
            if (callbacks.onCheck) callbacks.onCheck(itemId, row.classList.contains('checked'));
            return;
        }
    });
}

/**
 * Gestisce il modale impostazioni
 */
export function handleSettingsModal(category, itemId) {
    const item = getItemById(itemId);
    if (!item) return;

    const currentState = {
        qty: parseInt(localStorage.getItem(`item_${itemId}_qty`)) || item.defaultQty,
        worn: localStorage.getItem(`item_${itemId}_worn`) === 'true'
    };

    const action = openSettingsModal(item, currentState);

    if (!action) return;

    switch(action.toUpperCase()) {
        case 'W':
            const isWorn = toggleWornStatus(itemId);
            trackStats('DESTINAZIONE', itemId, `Cambiato in: ${isWorn ? 'Indossato' : 'Bagaglio'}`);
            
            const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
            applyWornStatus(row, isWorn);
            break;
        case 'P':
            const newWeight = parseFloat(prompt("Nuovo peso (kg):", item.weight));
            if (!isNaN(newWeight) && newWeight >= 0) {
                trackStats('MODIFICA_PESO', itemId, `${item.weight} -> ${newWeight} kg`);
            } else { alert("Peso non valido"); }
            break;
        case 'Q':
            const newQty = parseInt(prompt("Nuova quantità:", currentState.qty));
            if (!isNaN(newQty) && newQty >= 0) {
                setItemQty(itemId, newQty);
                trackStats('MODIFICA_QTY', itemId, `${currentState.qty} -> ${newQty}`);
                
                const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
                updateItemRow(row, item, newQty);
            } else { alert("Quantità non valida"); }
            break;
        case 'C':
            if(confirm("Eliminare oggetto?")) {
                removeItemFromList(itemId);
                trackStats('ELIMINAZIONE_MANUALE', itemId);
            }
            break;
        default:
            alert("Comando non riconosciuto");
    }
    
    calculateAndDisplayStats();
}
