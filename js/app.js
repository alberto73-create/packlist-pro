// js/app.js - Entry Point Packlist Pro v9.5 Fixed
// Architettura modulare ES6 completa

import { STATE, ACTIVITIES } from './modules/db.js';
import { U } from './modules/utils.js';
import * as Ctrl from './modules/controller.js';
import * as View from './modules/ui.js';
import { registerServiceWorker, setupInstallPrompt, setupOnlineOfflineHandlers, triggerInstall, dismissInstallBanner } from './modules/pwa.js';

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('[App] Avvio Packlist Pro v9.5 Fixed');
    
    // Inizializza PWA
    await registerServiceWorker();
    setupInstallPrompt();
    setupOnlineOfflineHandlers();
    
    // Carica stato salvato o usa default
    Ctrl.loadState();
    
    // Renderizza attività prima di agganciare gli handler
    View.renderActivities(ACTIVITIES);
    
    // Setup UI iniziale
    setupEventListeners();
    setupActivityGrid();
    setupWeatherButtons();
    
    // Aggiorna UI configurazione
    Ctrl.updateConfigUI();
    
    // Genera lista se ci sono dati salvati
    if (Object.keys(STATE.list).length > 0) {
        View.list(STATE, U);
        View.stats(STATE, U);
    } else {
        View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    }
});

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    // Event delegation per la lista
    Ctrl.setupEventDelegation();
    
    // Bottone Genera Packlist
    const generateBtn = document.getElementById('generateBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            Ctrl.generateList();
        });
    }
    
    // Input configurazione
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
    
    // Toggle lavanderia
    const laundryToggle = document.getElementById('laundryToggle');
    if (laundryToggle) {
        laundryToggle.addEventListener('click', () => {
            Ctrl.toggleLaundry();
        });
        laundryToggle.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                Ctrl.toggleLaundry();
            }
        });
    }
    
    // Banner installazione PWA
    document.getElementById('installBtn')?.addEventListener('click', triggerInstall);
    document.getElementById('installClose')?.addEventListener('click', dismissInstallBanner);
    
    // Search
    const searchInput = document.getElementById('searchItems');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            Ctrl.searchItems(e.target.value);
        });
    }
    
    // FAB Main
    const fabMain = document.getElementById('fabMain');
    if (fabMain) {
        fabMain.addEventListener('click', toggleFabMenu);
    }
    
    // Filtri e azioni FAB
    setupFabActions();
    
    // Template viaggio
    setupTemplateActions();
}


function setupFabActions() {
    const closeMenu = () => {
        const menu = document.getElementById('fabMenu');
        if (menu?.classList.contains('open')) toggleFabMenu();
    };

    const filterMap = {
        'filter-all': 'all',
        'filter-clothing': 'clothing',
        'filter-tech': 'tech',
        'filter-essentials': 'essentials'
    };

    Object.entries(filterMap).forEach(([id, filter]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                Ctrl.setFilter(filter);
                closeMenu();
            });
        }
    });

    document.getElementById('copyListBtn')?.addEventListener('click', async () => {
        await Ctrl.copyList();
        closeMenu();
    });

    document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
        Ctrl.exportPDF();
        closeMenu();
    });

    document.getElementById('uncheckAllBtn')?.addEventListener('click', () => {
        Ctrl.uncheckAll();
        closeMenu();
    });

    document.getElementById('showStatsBtn')?.addEventListener('click', () => {
        Ctrl.showStatsSummary();
        closeMenu();
    });

    document.getElementById('resetSessionBtn')?.addEventListener('click', () => {
        if (confirm('Resettare tutta la sessione?')) {
            Ctrl.resetState();
        }
        closeMenu();
    });
}

function setupTemplateActions() {
    Ctrl.loadTemplateDropdown();

    document.getElementById('saveTemplateBtn')?.addEventListener('click', () => {
        const name = document.getElementById('templateName')?.value || '';
        Ctrl.saveTemplate(name);
    });

    document.getElementById('templateSelect')?.addEventListener('change', (e) => {
        if (e.target.value) Ctrl.loadTemplate(e.target.value);
    });

    document.getElementById('deleteTemplateBtn')?.addEventListener('click', () => {
        const name = document.getElementById('templateSelect')?.value || '';
        if (name && confirm(`Eliminare il template "${name}"?`)) {
            Ctrl.deleteTemplate(name);
        }
    });
}

// --- SETUP GRIGLIA ATTIVITÀ ---
function setupActivityGrid() {
    const grid = document.getElementById('activityGrid');
    if (!grid) return;
    
    grid.addEventListener('click', (e) => {
        const btn = e.target.closest('.act-btn');
        if (!btn) return;
        
        const actId = btn.id.replace('act-', '');
        // Toggle visivo immediato
        btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
        // Aggiorna stato e rigenera lista se necessario
        Ctrl.toggleActivity(actId);
    });
    
    // Keyboard support
    grid.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const btn = e.target.closest('.act-btn');
            if (btn) {
                e.preventDefault();
                const actId = btn.id.replace('act-', '');
                btn.classList.toggle('active');
                btn.setAttribute('aria-pressed', btn.classList.contains('active'));
                Ctrl.toggleActivity(actId);
            }
        }
    });
}

// --- BOTTONI METEO ---
function setupWeatherButtons() {
    document.querySelectorAll('.weather-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const weatherType = btn.id.replace('w-', '');
            // Toggle visivo immediato
            btn.classList.toggle('active');
            btn.setAttribute('aria-pressed', btn.classList.contains('active'));
            Ctrl.toggleWeather(weatherType);
        });
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                const weatherType = btn.id.replace('w-', '');
                btn.classList.toggle('active');
                btn.setAttribute('aria-pressed', btn.classList.contains('active'));
                Ctrl.toggleWeather(weatherType);
            }
        });
    });
}

// --- FUNZIONI DI CONFIGURAZIONE ---
function syncConfig() {
    const nights = parseInt(document.getElementById('nights')?.value) || 0;
    const gender = document.getElementById('gender')?.value || 'U';
    const transport = document.getElementById('transport')?.value || 'auto';
    const laundryFreq = parseInt(document.getElementById('laundryFreq')?.value) || 3;
    const laundryBuffer = parseInt(document.getElementById('laundryBuffer')?.value) || 1;
    
    Ctrl.setConfig({ nights, gender, transport, laundryFreq, laundryBuffer });
    Ctrl.generateList();
}

// --- FAB MENU ---
function toggleFabMenu() {
    const menu = document.getElementById('fabMenu');
    const btn = document.getElementById('fabMain');
    if (menu && btn) {
        const isOpen = menu.classList.contains('open');
        menu.classList.toggle('open', !isOpen);
        btn.classList.toggle('open', !isOpen);
        btn.setAttribute('aria-expanded', !isOpen);
    }
}

// --- EXPORT GLOBALE PER DEBUG ---
window.App = {
    STATE,
    Ctrl,
    View,
    U,
    generateList: () => Ctrl.generateList(),
    resetState: () => Ctrl.resetState(),
    exportCSV: () => Ctrl.exportStatsCSV()
};

console.log('[App] Packlist Pro pronto! Usa window.App per debug.');
