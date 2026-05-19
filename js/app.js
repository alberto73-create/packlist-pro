// js/app.js - Entry Point dell'Applicazione Packlist Pro
// Versione 2.0.0 - Struttura Modulare Ristrutturata

import { loadDatabase, getDB, saveLocalSettings, loadLocalSettings, exportStatsCSV } from './modules/db.js';
import { generateListFromDB, setupListEventListeners, handleSettingsModal, calculateAndDisplayStats } from './modules/controller.js';
import { renderActivities, updateProgressDisplay, showInstallBanner } from './modules/ui.js';
import { registerServiceWorker, setupInstallPrompt, triggerInstall, dismissInstallBanner, setupOnlineOfflineHandlers } from './modules/pwa.js';

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[App] Avvio Packlist Pro v2.0.0');
    
    // Inizializza PWA
    await registerServiceWorker();
    setupInstallPrompt();
    setupOnlineOfflineHandlers();
    
    // Carica database
    await loadDatabase();
    
    // Setup UI iniziale
    setupEventListeners();
    renderActivities();
    generateListFromDB();
    calculateAndDisplayStats();
    loadLocalSettings();
    
    // Controlla banner installazione
    checkInstallBanner();
});

// --- GESTIONE EVENTI GLOBALI ---
function setupEventListeners() {
    // Setup listener per la lista items
    setupListEventListeners({
        onSettings: (category, itemId) => handleSettingsModal(category, itemId),
        onDelete: () => calculateAndDisplayStats(),
        onQtyChange: () => calculateAndDisplayStats(),
        onCheck: () => calculateAndDisplayStats()
    });
    
    // Listener per attività
    const activityGrid = document.getElementById('activityGrid');
    if (activityGrid) {
        // Il listener change è già gestito in ui.js dentro renderActivities
    }
    
    // Bottone Genera Packlist
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            generateListFromDB();
        });
    }
    
    // Input viaggio
    const nightsInput = document.getElementById('nights');
    const genderInput = document.getElementById('gender');
    const transportInput = document.getElementById('transport');
    const laundryFreqInput = document.getElementById('laundryFreq');
    const laundryBufferInput = document.getElementById('laundryBuffer');
    
    [nightsInput, genderInput, transportInput, laundryFreqInput, laundryBufferInput].forEach(input => {
        if (input) {
            input.addEventListener('change', syncConfig);
            input.addEventListener('input', syncConfig);
        }
    });
    
    // Pulsanti meteo
    document.querySelectorAll('.weather-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const weatherType = btn.id.replace('w-', '');
            toggleWeather(weatherType);
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const weatherType = btn.id.replace('w-', '');
                toggleWeather(weatherType);
            }
        });
    });
    
    // Toggle lavanderia
    const laundryToggle = document.getElementById('laundryToggle');
    if (laundryToggle) {
        laundryToggle.addEventListener('click', toggleLaundry);
        laundryToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleLaundry();
            }
        });
    }
    
    // Template select
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        templateSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadTemplate(e.target.value);
                e.target.value = '';
            }
        });
    }
    
    // Search
    const searchInput = document.getElementById('searchItems');
    if (searchInput) {
        searchInput.addEventListener('input', filterList);
    }
    
    const searchClear = document.getElementById('searchClear');
    if (searchClear) {
        searchClear.addEventListener('click', clearSearch);
    }
    
    // FAB Main
    const fabMain = document.getElementById('fabMain');
    if (fabMain) {
        fabMain.addEventListener('click', toggleMenu);
    }
    
    // Install banner
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', install);
    }
    
    const installClose = document.getElementById('installClose');
    if (installClose) {
        installClose.addEventListener('click', dismissInstall);
    }
}

// --- FUNZIONI DI CONFIGURAZIONE ---
export function syncConfig() {
    const db = getDB();
    
    db.settings.nights = parseInt(document.getElementById('nights')?.value) || 0;
    db.settings.gender = document.getElementById('gender')?.value || 'M';
    db.settings.transport = document.getElementById('transport')?.value || 'auto';
    db.settings.laundryFreq = parseInt(document.getElementById('laundryFreq')?.value) || 3;
    db.settings.laundryBuffer = parseInt(document.getElementById('laundryBuffer')?.value) || 1;
    
    saveLocalSettings(db.settings);
    updateDaytripBanner();
    updateLaundryInfo();
}

export function toggleWeather(type) {
    const db = getDB();
    if (!db.settings.weathers) db.settings.weathers = [];
    
    const index = db.settings.weathers.indexOf(type);
    if (index > -1) {
        db.settings.weathers.splice(index, 1);
    } else {
        db.settings.weathers.push(type);
    }
    
    const btn = document.getElementById(`w-${type}`);
    if (btn) {
        const isSelected = db.settings.weathers.includes(type);
        btn.classList.toggle('selected', isSelected);
        btn.setAttribute('aria-pressed', isSelected);
    }
    
    saveLocalSettings(db.settings);
    generateListFromDB();
}

export function toggleLaundry() {
    const db = getDB();
    db.settings.laundryEnabled = !db.settings.laundryEnabled;
    
    const toggle = document.getElementById('laundryToggle');
    const freqBox = document.getElementById('laundryFreqBox');
    
    if (toggle) {
        toggle.setAttribute('aria-pressed', db.settings.laundryEnabled);
        toggle.classList.toggle('active', db.settings.laundryEnabled);
    }
    
    if (freqBox) {
        freqBox.style.display = db.settings.laundryEnabled ? 'flex' : 'none';
    }
    
    saveLocalSettings(db.settings);
    updateLaundryInfo();
    generateListFromDB();
}

function updateLaundryInfo() {
    const db = getDB();
    const infoEl = document.getElementById('laundryInfo');
    
    if (!db.settings.laundryEnabled || !infoEl) {
        if (infoEl) infoEl.textContent = '';
        return;
    }
    
    const nights = db.settings.nights || 0;
    const freq = db.settings.laundryFreq || 3;
    const buffer = db.settings.laundryBuffer || 1;
    
    let daysNeeded = nights + 1;
    if (nights === 0) daysNeeded = 1;
    
    let washes = 0;
    if (freq > 0 && daysNeeded > freq) {
        washes = Math.floor((daysNeeded - 1) / freq);
    }
    
    infoEl.textContent = `🧮 Con ${nights} notti e lavanderia ogni ${freq}gg: farai circa ${washes} lavatrici. Buffer: +${buffer} capi.`;
}

function updateDaytripBanner() {
    const db = getDB();
    const banner = document.getElementById('daytripBanner');
    
    if (!banner) return;
    
    const isDayTrip = db.settings.nights === 0;
    banner.style.display = isDayTrip ? 'block' : 'none';
}

// --- TEMPLATE MANAGEMENT ---
export function saveTemplate() {
    const nameInput = document.getElementById('templateName');
    const name = nameInput?.value?.trim();
    
    if (!name) {
        alert('Inserisci un nome per il template');
        return;
    }
    
    const db = getDB();
    const templates = JSON.parse(localStorage.getItem('packlist_templates') || '{}');
    
    templates[name] = {
        settings: { ...db.settings },
        activities: [...db.settings.selectedActivities],
        weathers: [...(db.settings.weathers || [])]
    };
    
    localStorage.setItem('packlist_templates', JSON.stringify(templates));
    nameInput.value = '';
    updateTemplateSelect();
    alert(`Template "${name}" salvato!`);
}

export function loadTemplate(name) {
    const templates = JSON.parse(localStorage.getItem('packlist_templates') || '{}');
    const template = templates[name];
    
    if (!template) return;
    
    const db = getDB();
    db.settings = { ...db.settings, ...template.settings };
    db.settings.selectedActivities = [...template.activities];
    db.settings.weathers = [...(template.weathers || [])];
    
    document.getElementById('nights').value = db.settings.nights || 0;
    document.getElementById('gender').value = db.settings.gender || 'M';
    document.getElementById('transport').value = db.settings.transport || 'auto';
    document.getElementById('laundryFreq').value = db.settings.laundryFreq || 3;
    document.getElementById('laundryBuffer').value = db.settings.laundryBuffer || 1;
    
    if (document.getElementById('laundryToggle')) {
        document.getElementById('laundryToggle').classList.toggle('active', db.settings.laundryEnabled);
    }
    
    if (db.settings.weathers) {
        ['sun', 'rain', 'cold'].forEach(type => {
            const btn = document.getElementById(`w-${type}`);
            if (btn) {
                const isSelected = db.settings.weathers.includes(type);
                btn.classList.toggle('selected', isSelected);
                btn.setAttribute('aria-pressed', isSelected);
            }
        });
    }
    
    saveLocalSettings(db.settings);
    renderActivities();
    generateListFromDB();
    updateTemplateSelect();
}

export function deleteTemplate() {
    const select = document.getElementById('templateSelect');
    const name = select?.value;
    
    if (!name) {
        alert('Seleziona un template da eliminare');
        return;
    }
    
    if (!confirm(`Eliminare il template "${name}"?`)) return;
    
    const templates = JSON.parse(localStorage.getItem('packlist_templates') || '{}');
    delete templates[name];
    localStorage.setItem('packlist_templates', JSON.stringify(templates));
    updateTemplateSelect();
}

function updateTemplateSelect() {
    const select = document.getElementById('templateSelect');
    if (!select) return;
    
    const templates = JSON.parse(localStorage.getItem('packlist_templates') || '{}');
    const names = Object.keys(templates);
    
    select.innerHTML = '<option value="">📂 Carica template...</option>';
    names.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = `📄 ${name}`;
        select.appendChild(option);
    });
}

// --- SEARCH & FILTER ---
export function filterList() {
    const query = document.getElementById('searchItems')?.value.toLowerCase() || '';
    const clearBtn = document.getElementById('searchClear');
    
    if (clearBtn) {
        clearBtn.style.display = query ? 'block' : 'none';
    }
    
    document.querySelectorAll('.item-row').forEach(row => {
        const name = row.querySelector('.item-name')?.textContent.toLowerCase() || '';
        const category = row.dataset.category || '';
        
        const matches = name.includes(query) || category.includes(query);
        row.style.display = matches ? '' : 'none';
    });
}

export function clearSearch() {
    const searchInput = document.getElementById('searchItems');
    if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
    }
    filterList();
}

export function setFilter(filter) {
    document.querySelectorAll('.fab-item').forEach(btn => {
        btn.classList.remove('active-filter');
    });
    document.getElementById(`filter-${filter}`)?.classList.add('active-filter');
    
    document.querySelectorAll('.item-row').forEach(row => {
        const category = row.dataset.category || '';
        
        let show = false;
        switch (filter) {
            case 'all':
                show = true;
                break;
            case 'clothing':
                show = category === 'clothing' || category === 'shoes' || category === 'accessories';
                break;
            case 'tech':
                show = category === 'electronics' || category === 'work';
                break;
            case 'essentials':
                show = category === 'documents' || category === 'hygiene' || category === 'health';
                break;
        }
        
        row.style.display = show ? '' : 'none';
    });
    
    toggleMenu();
}

// --- ACTIONS ---
export function copyList() {
    const items = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const name = row.querySelector('.item-name')?.textContent || '';
        const qty = row.querySelector('.qty-display')?.textContent || '0';
        if (name) items.push(`${name} x${qty}`);
    });
    
    const text = items.join('\n');
    navigator.clipboard.writeText(text).then(() => {
        alert('Lista copiata negli appunti!');
    }).catch(err => {
        console.error('Errore copia:', err);
    });
}

export function exportPDF() {
    if (!window.jspdf) {
        alert('jsPDF non caricato. Riprova tra pochi secondi.');
        return;
    }
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    
    doc.text('Packlist Pro - La tua lista di viaggio', 14, 20);
    doc.setFontSize(10);
    doc.text(`Generata il: ${new Date().toLocaleDateString()}`, 14, 28);
    
    const tableData = [];
    document.querySelectorAll('.item-row').forEach(row => {
        const name = row.querySelector('.item-name')?.textContent || '';
        const qty = row.querySelector('.qty-display')?.textContent || '0';
        const meta = row.querySelector('.item-meta')?.textContent || '';
        tableData.push([name, `x${qty}`, meta]);
    });
    
    doc.autoTable({
        head: [['Item', 'Qty', 'Peso']],
        body: tableData,
        startY: 35,
    });
    
    doc.save('packlist.pdf');
}

export function uncheckAll() {
    document.querySelectorAll('.item-row').forEach(row => {
        row.classList.remove('checked');
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) checkbox.checked = false;
    });
    calculateAndDisplayStats();
}

export function resetSession() {
    if (!confirm('Sei sicuro di voler resettare tutta la sessione?')) return;
    
    localStorage.removeItem('packlist_settings');
    localStorage.removeItem('packlist_templates');
    
    const keys = Object.keys(localStorage).filter(k => k.startsWith('item_'));
    keys.forEach(k => localStorage.removeItem(k));
    
    location.reload();
}

// --- PWA FUNCTIONS ---
export async function install() {
    const accepted = await triggerInstall();
    if (accepted) {
        console.log('[App] Installazione accettata');
    }
}

export function dismissInstall() {
    dismissInstallBanner();
    showInstallBanner(false);
}

function checkInstallBanner() {
    if (!dismissInstallBanner()) {
        // Banner gestito dall'evento beforeinstallprompt
    }
}

function toggleMenu() {
    const menu = document.getElementById('fabMenu');
    const main = document.getElementById('fabMain');
    if (menu && main) {
        const isExpanded = main.getAttribute('aria-expanded') === 'true';
        main.setAttribute('aria-expanded', !isExpanded);
        menu.classList.toggle('open');
    }
}

// Export per debug/testing e accesso globale
window.App = {
    install,
    dismissInstall,
    syncConfig,
    toggleWeather,
    toggleLaundry,
    saveTemplate,
    loadTemplate,
    deleteTemplate,
    filterList,
    clearSearch,
    setFilter,
    copyList,
    exportPDF,
    uncheckAll,
    resetSession
};

// Esponi anche come Ctrl per compatibilità con eventuali handler inline cached
window.Ctrl = window.App;

// Esponi singole funzioni per compatibilità
window.syncConfig = syncConfig;
window.toggleWeather = toggleWeather;
window.toggleLaundry = toggleLaundry;
window.saveTemplate = saveTemplate;
window.loadTemplate = loadTemplate;
window.deleteTemplate = deleteTemplate;
window.filterList = filterList;
window.clearSearch = clearSearch;
window.setFilter = setFilter;
window.copyList = copyList;
window.exportPDF = exportPDF;
window.uncheckAll = uncheckAll;
window.resetSession = resetSession;
