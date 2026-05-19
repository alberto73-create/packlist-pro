// js/app.js - Versione 1.00.17
const DB_VERSION = "1.00.17";
let db = {};
let statsLog = [];

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log(`[App] Avvio versione ${DB_VERSION}`);
    await loadDatabase();
    setupEventListeners();
    renderActivities();
    generateListFromDB();
    updateStatsUI();
    
    // Carica impostazioni salvate localmente se esistono
    loadLocalSettings();
});

// --- CARICAMENTO DATABASE ---
async function loadDatabase() {
    try {
        // Cache buster per forzare reload nuovo data.json
        const response = await fetch('data.json?t=' + new Date().getTime());
        if (!response.ok) throw new Error("Network response was not ok");
        const data = await response.json();

        db = data;
        
        // Inizializza settings se mancanti
        if (!db.settings) db.settings = { selectedActivities: [], nights: 3, laundryFreq: 0 };
        if (!db.settings.selectedActivities) db.settings.selectedActivities = [];

        console.log(`[App] Database caricato: ${db.version || DB_VERSION}`);
        
        // Aggiorna UI versione
        const versionEl = document.getElementById('app-version');
        if(versionEl) versionEl.innerText = `v${db.version || DB_VERSION}`;

    } catch (error) {
        console.error("[App] Errore caricamento DB:", error);
        // Fallback minimo
        db = { 
            version: DB_VERSION,
            categories: [], 
            activities: [], 
            items: [], 
            settings: { selectedActivities: [], nights: 3, laundryFreq: 0 } 
        };
    }
}

// --- GESTIONE EVENTI (Delegata per performance) ---
function setupEventListeners() {
    // Delega eventi per la lista dinamica
    const listContainer = document.getElementById('packing-list');
    if (listContainer) {
        listContainer.addEventListener('click', (e) => {
            const target = e.target;
            const row = target.closest('.item-row');
            
            if (!row) return;
            
            const itemId = row.dataset.id;
            const category = row.dataset.category;

            // Click su Rotella Impostazioni
            if (target.classList.contains('btn-gear') || target.closest('.btn-gear')) {
                e.stopPropagation(); // Previene conflitti
                openSettingsModal(category, itemId);
                return;
            }

            // Click su Elimina (X)
            if (target.classList.contains('btn-delete') || target.closest('.btn-delete')) {
                e.stopPropagation();
                if(confirm(`Eliminare definitivamente "${getItemName(itemId)}"?`)) {
                    removeItemFromList(itemId);
                }
                return;
            }
            
            // Click su +/- Quantità
            if (target.classList.contains('btn-qty')) {
                const delta = target.textContent === '+' ? 1 : -1;
                updateQty(itemId, delta);
                return;
            }
        });
    }

    // Checkbox Attività
    document.querySelectorAll('.activity-filter input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', (e) => {
            toggleActivity(e.target.value, e.target.checked);
        });
    });

    // Input Impostazioni Viaggio (Notti/Lavanderia)
    const nightsInput = document.getElementById('nights-input');
    const laundryInput = document.getElementById('laundry-input');
    
    if(nightsInput) nightsInput.addEventListener('change', updateTripSettings);
    if(laundryInput) laundryInput.addEventListener('change', updateTripSettings);
}

// --- LOGICA ATTIVITÀ ---
function toggleActivity(actId, isChecked) {
    if (isChecked) {
        if (!db.settings.selectedActivities.includes(actId)) {
            db.settings.selectedActivities.push(actId);
            trackStats('ATTIVITA_AGGIUNTA', actId, `Attività: ${getActivityName(actId)}`);
        }
    } else {
        db.settings.selectedActivities = db.settings.selectedActivities.filter(id => id !== actId);
        trackStats('ATTIVITA_RIMOSSA', actId, `Attività: ${getActivityName(actId)}`);
    }
    
    saveLocalSettings();
    generateListFromDB(); // Rigenera lista con nuovi filtri
}

function renderActivities() {
    const container = document.querySelector('.activity-filter');
    if (!container || !db.activities) return;

    container.innerHTML = '';
    db.activities.forEach(act => {
        const label = document.createElement('label');
        label.className = 'activity-chip';
        const isChecked = db.settings.selectedActivities.includes(act.id);
        
        label.innerHTML = `
            <input type="checkbox" value="${act.id}" ${isChecked ? 'checked' : ''}>
            <span>${act.icon} ${act.name}</span>
        `;
        container.appendChild(label);
    });
}

// --- GENERAZIONE LISTA (FILTRO CORRETTO) ---
function generateListFromDB() {
    const listContainer = document.getElementById('packing-list');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    
    const selectedActs = db.settings.selectedActivities || [];
    const hasActivitiesSelected = selectedActs.length > 0;

    // Filtra categorie visibili
    const visibleCategories = db.categories.filter(cat => {
        // Categorie essenziali sempre visibili
        if (cat.essential) return true;
        
        // Se nessuna attività selezionata, nascondi categorie opzionali
        if (!hasActivitiesSelected) return false;

        // Mostra categoria se contiene oggetti pertinenti alle attività selezionate
        return db.items.some(item => 
            item.category === cat.id && 
            (item.activities.length === 0 || item.activities.some(a => selectedActs.includes(a)))
        );
    });

    visibleCategories.forEach(cat => {
        // Header Categoria
        const catHeader = document.createElement('div');
        catHeader.className = 'category-header';
        catHeader.innerHTML = `<span>${cat.icon} ${cat.name}</span>`;
        listContainer.appendChild(catHeader);

        // Filtra oggetti per questa categoria
        const itemsForCat = db.items.filter(item => {
            if (item.category !== cat.id) return false;
            
            // Oggetti senza attività specifica sono sempre inclusi se la categoria è visibile
            if (item.activities.length === 0) return true;

            // Include solo se matching con attività selezionate
            return item.activities.some(actId => selectedActs.includes(actId));
        });

        itemsForCat.forEach(item => {
            const itemEl = createItemElement(item);
            listContainer.appendChild(itemEl);
        });
    });

    if (listContainer.children.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">Nessun oggetto da mostrare. Seleziona un\'attività o aggiungi manualmente.</div>';
    }
    
    updateStatsUI();
}

// --- CREAZIONE ELEMENTO ITEM ---
function createItemElement(item) {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.dataset.id = item.id;
    div.dataset.category = item.category;

    // Recupera stato salvato
    const savedState = getItemState(item.id);
    const qty = savedState.qty !== undefined ? savedState.qty : item.defaultQty;
    const isWorn = savedState.worn || false;

    // Stile visivo per "Indossato"
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
            
            <div style="width:8px;"></div> <!-- Spaziatore -->
            
            <button class="btn-icon btn-gear" title="Impostazioni (Peso, Stato, Qty)" aria-label="Impostazioni">⚙️</button>
            <button class="btn-icon btn-delete" title="Elimina oggetto" aria-label="Elimina">❌</button>
        </div>
    `;

    return div;
}

// --- MODALE IMPOSTAZIONI (ROTTELLA) ---
function openSettingsModal(category, itemId) {
    const item = db.items.find(i => i.id === itemId);
    if (!item) return;

    const currentState = getItemState(itemId);
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
        `--------------------------\n` +
        `(Lascia vuoto per annullare)`
    );

    if (!action) return;

    switch(action.toUpperCase()) {
        case 'W':
            toggleWornStatus(itemId);
            trackStats('DESTINAZIONE', itemId, `Cambiato in: ${!isWorn ? 'Indossato' : 'Bagaglio'}`);
            break;
        case 'P':
            const newWeight = parseFloat(prompt("Inserisci nuovo peso (kg):", currentWeight));
            if (!isNaN(newWeight) && newWeight >= 0) {
                updateItemWeight(itemId, newWeight);
                trackStats('MODIFICA_PESO', itemId, `${currentWeight} -> ${newWeight} kg`);
            } else {
                alert("Peso non valido");
            }
            break;
        case 'Q':
            const newQty = parseInt(prompt("Inserisci nuova quantità:", currentQty));
            if (!isNaN(newQty) && newQty >= 0) {
                updateQtyInternal(itemId, newQty);
                trackStats('MODIFICA_QTY', itemId, `${currentQty} -> ${newQty}`);
            } else {
                alert("Quantità non valida");
            }
            break;
        case 'C':
            if(confirm("Sei sicuro di voler eliminare questo oggetto dalla lista?")) {
                removeItemFromList(itemId);
                trackStats('ELIMINAZIONE_MANUALE', itemId, "Rimosso via menu impostazioni");
            }
            break;
        default:
            alert("Comando non riconosciuto");
    }
}

// --- FUNZIONI DI AGGIORNAMENTO STATO ---

function toggleWornStatus(itemId) {
    const state = getItemState(itemId);
    state.worn = !state.worn;
    saveItemState(itemId, state);
    
    // Aggiorna UI immediata
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        row.style.opacity = state.worn ? '0.6' : '1';
        row.style.borderLeft = state.worn ? '4px solid #4CAF50' : 'none';
    }
    updateStatsUI();
}

function updateQty(itemId, delta) {
    const state = getItemState(itemId);
    const item = db.items.find(i => i.id === itemId);
    let newQty = (state.qty !== undefined ? state.qty : item.defaultQty) + delta;

    if (newQty < 0) newQty = 0;

    state.qty = newQty;
    saveItemState(itemId, state);

    // Aggiorna UI immediata
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        row.querySelector('.qty-display').innerText = newQty;
        const weightSpan = row.querySelector('.item-meta');
        if (weightSpan) {
            const totalW = (newQty * item.weight).toFixed(2);
            weightSpan.innerText = `${totalW}kg • Qty: ${newQty}`;
        }
    }

    if (delta > 0) trackStats('AGGIUNTA_QTY', itemId, `+${delta}`);
    else if (delta < 0) trackStats('RIMOZIONE_QTY', itemId, `${delta}`);
    
    updateStatsUI();
}

function updateQtyInternal(itemId, newQty) {
    const state = getItemState(itemId);
    state.qty = newQty;
    saveItemState(itemId, state);
    
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        const item = db.items.find(i => i.id === itemId);
        row.querySelector('.qty-display').innerText = newQty;
        row.querySelector('.item-meta').innerText = `${(newQty * item.weight).toFixed(2)}kg • Qty: ${newQty}`;
    }
    updateStatsUI();
}

function updateItemWeight(itemId, newWeight) {
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        const qtyDisplay = row.querySelector('.qty-display').innerText;
        const qty = parseInt(qtyDisplay);
        row.querySelector('.item-meta').innerText = `${(qty * newWeight).toFixed(2)}kg • Qty: ${qty}`;
    }
    updateStatsUI();
}

function removeItemFromList(itemId) {
    const row = document.querySelector(`.item-row[data-id="${itemId}"]`);
    if (row) {
        row.remove();
        localStorage.removeItem(`item_${itemId}`);
        updateStatsUI();
    }
}

// --- IMPOSTAZIONI VIAGGIO & CALCOLO NOTTI ---

function updateTripSettings() {
    const nightsInput = document.getElementById('nights-input');
    const laundryInput = document.getElementById('laundry-input');

    if (!nightsInput || !laundryInput) return;

    const nights = parseInt(nightsInput.value) || 0;
    const laundryFreq = parseInt(laundryInput.value) || 0;

    db.settings.nights = nights;
    db.settings.laundryFreq = laundryFreq;

    saveLocalSettings();
    
    let daysNeeded = nights + 1;
    if (nights === 0) daysNeeded = 1;

    let effectiveDays = daysNeeded;
    if (laundryFreq > 0 && daysNeeded > laundryFreq) {
        effectiveDays = laundryFreq; 
    }

    console.log(`[App] Viaggio: ${nights} notti, Lavanderia ogni ${laundryFreq} gg. Giorni effettivi: ${effectiveDays}`);
    
    trackStats('IMPOSTAZIONI_VIAGGIO', 'system', `Notti: ${nights}, Lavanderia: ${laundryFreq}`);
}

function loadLocalSettings() {
    const saved = localStorage.getItem('packlist_settings');
    if (saved) {
        const parsed = JSON.parse(saved);
        if(parsed.nights && document.getElementById('nights-input')) document.getElementById('nights-input').value = parsed.nights;
        if(parsed.laundryFreq && document.getElementById('laundry-input')) document.getElementById('laundry-input').value = parsed.laundryFreq;
        if(parsed.selectedActivities) {
            db.settings.selectedActivities = parsed.selectedActivities;
            renderActivities();
        }
    }
}

function saveLocalSettings() {
    localStorage.setItem('packlist_settings', JSON.stringify(db.settings));
}

// --- UTILS & HELPERS ---

function getItemState(itemId) {
    const stored = localStorage.getItem(`item_${itemId}`);
    return stored ? JSON.parse(stored) : {};
}

function saveItemState(itemId, state) {
    localStorage.setItem(`item_${itemId}`, JSON.stringify(state));
}

function getItemName(id) {
    const item = db.items.find(i => i.id === id);
    return item ? item.name : id;
}

function getActivityName(id) {
    const act = db.activities.find(a => a.id === id);
    return act ? act.name : id;
}

// --- STATISTICHE & LOGGING ---

function trackStats(action, itemId, details = "") {
    const itemObj = db.items.find(i => i.id === itemId);
    const state = getItemState(itemId);
    
    const entry = {
        timestamp: new Date().toISOString(),
        item: itemObj ? itemObj.name : (itemId === 'system' ? 'Sistema' : itemId),
        action: action,
        details: details,
        weight: itemObj ? itemObj.weight : 0,
        qty: state.qty || (itemObj ? itemObj.defaultQty : 0),
        destination: state.worn ? 'Indossato' : 'Bagaglio'
    };
    
    statsLog.push(entry);
    console.log("[Stats Log]", entry);
    updateStatsUI();
}

function updateStatsUI() {
    let totalWeight = 0;
    let totalItems = 0;

    document.querySelectorAll('.item-row').forEach(row => {
        const qtyText = row.querySelector('.qty-display').innerText;
        const qty = parseInt(qtyText);
        
        const metaText = row.querySelector('.item-meta').innerText;
        const weightPart = metaText.split('kg')[0];
        const weight = parseFloat(weightPart);

        if (!isNaN(qty) && !isNaN(weight)) {
            totalItems += qty;
            totalWeight += weight;
        }
    });

    const wEl = document.getElementById('total-weight');
    const iEl = document.getElementById('total-items');
    
    if(wEl) wEl.innerText = `${totalWeight.toFixed(2)} kg`;
    if(iEl) iEl.innerText = totalItems;
}

function exportStatsCSV() {
    if(statsLog.length === 0) {
        alert("Nessun dato nei log.");
        return;
    }
    
    const headers = ["Data", "Oggetto", "Azione", "Dettagli", "Peso", "Quantità", "Destinazione"];
    const rows = statsLog.map(log => [
        log.timestamp,
        log.item,
        log.action,
        log.details,
        log.weight,
        log.qty,
        log.destination
    ]);

    let csvContent = "text/csv;charset=utf-8," 
        + headers.join(",") + "\n" 
        + rows.map(e => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `packlist_log_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
