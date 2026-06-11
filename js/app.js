// js/app.js - Entry Point Packlist Pro v9.5 Fixed
// Architettura modulare ES6 completa

import { STATE, ACTIVITIES } from './modules/db.js';
import { U } from './modules/utils.js';
import * as Ctrl from './modules/controller.js';
import * as View from './modules/ui.js';
import { registerServiceWorker, setupInstallPrompt, setupOnlineOfflineHandlers, triggerInstall, dismissInstallBanner } from './modules/pwa.js';

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('[App] Avvio Packlist Pro v9.5 Fixed');

    // La UI deve essere interattiva subito: la PWA viene inizializzata in background.
    Ctrl.loadState();
    View.renderActivities(ACTIVITIES);
    setupEventListeners();
    Ctrl.updateConfigUI();

    if (Object.keys(STATE.list).length > 0) {
        View.list(STATE, U);
        View.stats(STATE, U);
    } else {
        View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    }

    setupInstallPrompt();
    setupOnlineOfflineHandlers();
    registerServiceWorker().catch(error => {
        console.error('[App] Inizializzazione PWA fallita:', error);
    });
});

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    Ctrl.setupEventDelegation();

    document.getElementById('generateBtn')?.addEventListener('click', () => Ctrl.generateList());

    ['nights', 'gender', 'transport', 'laundryFreq', 'laundryBuffer'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('change', syncConfig);
        if (input?.tagName === 'INPUT') input.addEventListener('input', syncConfig);
    });

    document.querySelectorAll('.weather-btn').forEach(button => {
        button.addEventListener('click', () => Ctrl.toggleWeather(button.dataset.weather));
    });

    document.querySelectorAll('.act-btn').forEach(button => {
        button.addEventListener('click', () => Ctrl.toggleActivity(button.dataset.activity));
    });

    const laundryToggle = document.getElementById('laundryToggle');
    laundryToggle?.addEventListener('click', () => Ctrl.toggleLaundry());
    laundryToggle?.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            Ctrl.toggleLaundry();
        }
    });

    document.getElementById('installBtn')?.addEventListener('click', triggerInstall);
    document.getElementById('installClose')?.addEventListener('click', dismissInstallBanner);

    const searchInput = document.getElementById('searchItems');
    const searchClear = document.getElementById('searchClear');
    searchInput?.addEventListener('input', event => {
        Ctrl.searchItems(event.target.value);
        searchClear?.classList.toggle('visible', Boolean(event.target.value));
    });
    searchClear?.addEventListener('click', () => {
        if (!searchInput) return;
        searchInput.value = '';
        Ctrl.searchItems('');
        searchClear.classList.remove('visible');
        searchInput.focus();
    });

    setupTemplateActions();
    setupFabActions();
}

function setupTemplateActions() {
    Ctrl.loadTemplateDropdown();

    document.getElementById('saveTemplateBtn')?.addEventListener('click', () => {
        Ctrl.saveTemplate(document.getElementById('templateName')?.value || '');
    });
    document.getElementById('templateSelect')?.addEventListener('change', event => {
        if (event.target.value) Ctrl.loadTemplate(event.target.value);
    });
    document.getElementById('deleteTemplateBtn')?.addEventListener('click', () => {
        const name = document.getElementById('templateSelect')?.value || '';
        if (name && confirm(`Eliminare il template "${name}"?`)) Ctrl.deleteTemplate(name);
    });
}

function setupFabActions() {
    document.getElementById('fabMain')?.addEventListener('click', () => toggleFabMenu());

    const filters = {
        'filter-all': 'all',
        'filter-clothing': 'clothing',
        'filter-tech': 'tech',
        'filter-essentials': 'essentials'
    };
    Object.entries(filters).forEach(([id, filter]) => {
        document.getElementById(id)?.addEventListener('click', () => {
            Ctrl.setFilter(filter);
            toggleFabMenu(false);
        });
    });

    document.getElementById('copyListBtn')?.addEventListener('click', async () => {
        await Ctrl.copyList();
        toggleFabMenu(false);
    });
    document.getElementById('exportPdfBtn')?.addEventListener('click', () => {
        Ctrl.exportPDF();
        toggleFabMenu(false);
    });
    document.getElementById('uncheckAllBtn')?.addEventListener('click', () => {
        Ctrl.uncheckAll();
        toggleFabMenu(false);
    });
    document.getElementById('showStatsBtn')?.addEventListener('click', () => {
        Ctrl.showStatsSummary();
        toggleFabMenu(false);
    });
    document.getElementById('resetSessionBtn')?.addEventListener('click', () => {
        if (confirm('Resettare tutta la sessione?')) Ctrl.resetState();
        toggleFabMenu(false);
    });

    document.addEventListener('click', event => {
        const container = document.querySelector('.fab-container');
        if (container && !container.contains(event.target)) toggleFabMenu(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') toggleFabMenu(false);
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
