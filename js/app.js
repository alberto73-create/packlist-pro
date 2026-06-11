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
    setupGlobalControls();
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
    
    // Banner installazione PWA
    document.getElementById('installBtn')?.addEventListener('click', triggerInstall);
    document.getElementById('installClose')?.addEventListener('click', dismissInstallBanner);
    
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
    
    // Template viaggio
    setupTemplateActions();
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

// --- CONTROLLI GLOBALI ---
function setupGlobalControls() {
    document.addEventListener('click', async (e) => {
        const weatherBtn = e.target.closest('.weather-btn');
        if (weatherBtn) {
            e.preventDefault();
            Ctrl.toggleWeather(weatherBtn.id.replace('w-', ''));
            return;
        }

        const activityBtn = e.target.closest('.act-btn');
        if (activityBtn) {
            e.preventDefault();
            Ctrl.toggleActivity(activityBtn.id.replace('act-', ''));
            return;
        }

        if (e.target.closest('#laundryToggle')) {
            e.preventDefault();
            Ctrl.toggleLaundry();
            return;
        }

        if (e.target.closest('#fabMain')) {
            e.preventDefault();
            toggleFabMenu();
            return;
        }

        const fabAction = e.target.closest('.fab-item');
        if (fabAction) {
            await handleFabAction(fabAction);
            return;
        }

        const menu = document.getElementById('fabMenu');
        const container = document.querySelector('.fab-container');
        if (menu?.classList.contains('open') && container && !container.contains(e.target)) {
            toggleFabMenu(false);
        }
    });

    document.addEventListener('keydown', async (e) => {
        if (e.key === 'Escape') {
            toggleFabMenu(false);
            return;
        }

        if (e.key !== 'Enter' && e.key !== ' ') return;

        const weatherBtn = e.target.closest('.weather-btn');
        const activityBtn = e.target.closest('.act-btn');
        const laundryToggle = e.target.closest('#laundryToggle');
        const fabMain = e.target.closest('#fabMain');
        const fabAction = e.target.closest('.fab-item');

        if (weatherBtn) {
            e.preventDefault();
            Ctrl.toggleWeather(weatherBtn.id.replace('w-', ''));
        } else if (activityBtn) {
            e.preventDefault();
            Ctrl.toggleActivity(activityBtn.id.replace('act-', ''));
        } else if (laundryToggle) {
            e.preventDefault();
            Ctrl.toggleLaundry();
        } else if (fabMain) {
            e.preventDefault();
            toggleFabMenu();
        } else if (fabAction) {
            e.preventDefault();
            await handleFabAction(fabAction);
        }
    });
}

async function handleFabAction(btn) {
    const id = btn.id;
    const filters = {
        'filter-all': 'all',
        'filter-clothing': 'clothing',
        'filter-tech': 'tech',
        'filter-essentials': 'essentials'
    };

    if (filters[id]) {
        Ctrl.setFilter(filters[id]);
    } else if (id === 'copyListBtn') {
        await Ctrl.copyList();
    } else if (id === 'exportPdfBtn') {
        Ctrl.exportPDF();
    } else if (id === 'uncheckAllBtn') {
        Ctrl.uncheckAll();
    } else if (id === 'showStatsBtn') {
        Ctrl.showStatsSummary();
    } else if (id === 'resetSessionBtn' && confirm('Resettare tutta la sessione?')) {
        Ctrl.resetState();
    }

    toggleFabMenu(false);
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
function toggleFabMenu(forceOpen) {
    const menu = document.getElementById('fabMenu');
    const btn = document.getElementById('fabMain');
    if (menu && btn) {
        const nextOpen = typeof forceOpen === 'boolean' ? forceOpen : !menu.classList.contains('open');
        menu.classList.toggle('open', nextOpen);
        btn.classList.toggle('open', nextOpen);
        btn.setAttribute('aria-expanded', String(nextOpen));
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
