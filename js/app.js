// js/app.js - Entry point Packlist Pro
// Architettura modulare ES6 completa

import { STATE, APP_VERSION } from './modules/db.js';
import { U } from './modules/utils.js';
import * as Ctrl from './modules/controller.js';
import * as View from './modules/ui.js';
import { initAdmin } from './modules/admin.js';
import { initCommunications, openFeedbackModal, renderSupportBanner, maybeShowAutomaticFeedback } from './modules/communications.js';
import { logAnonymousEvent } from './modules/anonymous-logs.js';
import { registerServiceWorker, setupInstallPrompt, setupOnlineOfflineHandlers, triggerInstall, dismissInstallBanner } from './modules/pwa.js';

// Shared by native input listeners and the delegated visual controls.
const scheduleConfigSync = U.debounce(syncConfig, 180);

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', async () => {
    // La UI deve essere interattiva subito: la PWA viene inizializzata in background.
    Ctrl.loadState();
    await Ctrl.loadSharedListFromUrl();
    const versionElement = document.getElementById('appVersion');
    if (versionElement) versionElement.textContent = `App v${APP_VERSION}`;
    document.documentElement.dataset.appVersion = APP_VERSION;
    globalThis.APP_VERSION = APP_VERSION;
    setupEventListeners();
    initAdmin();
    initCommunications({ state: STATE, version: APP_VERSION });
    Ctrl.updateConfigUI();

    if (Object.keys(STATE.list).length > 0) {
        View.list(STATE, U);
        View.stats(STATE, U);
    } else {
        View.showEmptyState('Configura il viaggio e clicca "Genera Packlist"!');
    }

    setupInstallPrompt();
    setupOnlineOfflineHandlers();
    window.addEventListener('packlist:before-update', () => Ctrl.saveState());
    registerServiceWorker().catch(error => {
        console.error('[App] Inizializzazione PWA fallita:', error);
    });
});

// --- SETUP EVENT LISTENERS ---
function setupEventListeners() {
    Ctrl.setupEventDelegation();

    document.getElementById('generateBtn')?.addEventListener('click', () => { if (!Ctrl.validateSetupForGenerate()) return; Ctrl.generateList(); renderSupportBanner('afterGenerate'); maybeShowAutomaticFeedback('afterGenerate'); });
    document.getElementById('shareQuickBtn')?.addEventListener('click', () => Ctrl.shareList());
    document.getElementById('feedbackBtn')?.addEventListener('click', openFeedbackModal);

    ['nights', 'gender', 'transport', 'laundryFreq', 'laundryBuffer'].forEach(id => {
        const input = document.getElementById(id);
        input?.addEventListener('change', scheduleConfigSync);
    });

    // Un solo listener delegato mantiene interattivi anche i controlli renderizzati dinamicamente.
    document.addEventListener('click', handleControlClick);

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
    setupItemOptions();
    setupBaggageModals();
}

function setupItemOptions() {
    const modal = document.getElementById('itemOptionsModal');
    document.getElementById('itemOptionsClose')?.addEventListener('click', View.closeItemOptions);
    document.getElementById('itemOptionsCancel')?.addEventListener('click', View.closeItemOptions);
    modal?.addEventListener('click', event => { if (event.target === modal) View.closeItemOptions(); });
    modal?.addEventListener('keydown', event => {
        if (event.key === 'Escape') View.closeItemOptions();
    });
    document.getElementById('itemOptionsSave')?.addEventListener('click', () => {
        if (!modal?.dataset.uid) return;
        Ctrl.updateItemOptions(modal.dataset.uid, {
            quantity: document.getElementById('itemQuantity')?.value,
            weight: document.getElementById('itemWeight')?.value,
            worn: document.getElementById('itemWornToggle')?.checked,
            bulky: document.getElementById('itemBulkyToggle')?.checked,
            baggageId: document.getElementById('itemBaggage')?.value
        });
        View.closeItemOptions();
    });
}

function setupBaggageModals() {
    const count = document.getElementById('baggageCount');
    document.getElementById('baggageQuickCount')?.addEventListener('click', event => {
        const button = event.target.closest?.('[data-count]'); if (!button) return;
        count.value = button.dataset.count; View.renderBaggageSetupFields(count.value);
    });
    count?.addEventListener('input', () => View.renderBaggageSetupFields(count.value));
    document.getElementById('baggageSetupSave')?.addEventListener('click', () => {
        const names = [...document.querySelectorAll('.baggage-setup-name')].map(input => input.value);
        Ctrl.configureBaggages(names); View.closeBaggageSetup();
    });
    document.getElementById('baggageManagerClose')?.addEventListener('click', View.closeBaggageManager);
    document.getElementById('baggageAddBtn')?.addEventListener('click', () => { Ctrl.addBaggage(); View.openBaggageManager(STATE, U); });
    document.getElementById('baggageManagerSave')?.addEventListener('click', () => {
        document.querySelectorAll('.baggage-manage-row').forEach(row => Ctrl.updateBaggage(row.dataset.baggageId, { name: row.querySelector('[data-field="name"]')?.value, limit: row.querySelector('[data-field="limit"]')?.value }));
        View.closeBaggageManager();
    });
    document.getElementById('baggageManagerRows')?.addEventListener('click', event => {
        const action = event.target.closest?.('[data-baggage-action]')?.dataset.baggageAction; if (!action) return;
        const row = event.target.closest('.baggage-manage-row'); const id = row.dataset.baggageId; const target = row.querySelector('[data-field="target"]')?.value;
        if (action === 'move' && target) Ctrl.moveAllBaggageItems(id, target);
        if (action === 'delete') {
            const hasItems = Object.values(STATE.list).flat().some(item => item.baggageId === id);
            if (!hasItems || confirm(target ? 'Eliminare il bagaglio e spostare gli articoli nel bagaglio selezionato?' : 'Eliminare il bagaglio e tutti gli articoli contenuti?')) Ctrl.deleteBaggage(id, target || null);
        }
        View.openBaggageManager(STATE, U);
    });
    document.getElementById('statsSummaryClose')?.addEventListener('click', View.closeStatsSummary);
    document.getElementById('statsBarManageBaggages')?.addEventListener('click', () => View.openBaggageManager(STATE, U));
    document.getElementById('resetSessionBtn')?.addEventListener('click', () => { if (confirm('Resettare tutta la sessione?')) Ctrl.resetState(); });
    document.getElementById('statsSummaryModal')?.addEventListener('click', event => { if (event.target.id === 'statsSummaryModal') View.closeStatsSummary(); if (event.target.closest?.('#statsManageBaggages')) View.openBaggageManager(STATE, U); if (event.target.closest?.('#quickMoveApply')) { const category = document.getElementById('quickMoveCategory')?.value; const baggageId = document.getElementById('quickMoveBaggage')?.value; Ctrl.moveCategoryToBaggage(category, baggageId); Ctrl.showStatsSummary(); } });
    document.getElementById('statsSummaryModal')?.addEventListener('change', event => { if (event.target.id === 'statsWeightMode') { document.getElementById('statsWeightTotal').hidden = event.target.value !== 'total'; document.getElementById('statsWeightBaggage').hidden = event.target.value !== 'baggage'; } });
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
    document.addEventListener('click', event => {
        const container = document.querySelector('.fab-container');
        if (container && !container.contains(event.target)) toggleFabMenu(false);
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') toggleFabMenu(false);
    });
}

async function handleControlClick(event) {
    const genderButton = event.target.closest?.('.gender-btn');
    if (genderButton) {
        const input = document.getElementById('gender');
        if (input) input.value = genderButton.dataset.gender;
        scheduleConfigSync();
        return;
    }

    const transportButton = event.target.closest?.('.transport-btn');
    if (transportButton) {
        const input = document.getElementById('transport');
        const option = [...(input?.options || [])].find(item => item.value === transportButton.dataset.transport);
        if (option) {
            option.selected = !option.selected;
            }
        logAnonymousEvent({ eventType:'transport_selected', newValue: transportButton.dataset.transport, context: STATE.config });
        scheduleConfigSync();
        return;
    }

    const weatherButton = event.target.closest?.('.weather-btn');
    if (weatherButton) {
        Ctrl.toggleWeather(weatherButton.dataset.weather);
        logAnonymousEvent({ eventType:'weather_selected', newValue: weatherButton.dataset.weather, context: STATE.config });
        return;
    }

    const activityButton = event.target.closest?.('.act-btn');
    if (activityButton) {
        Ctrl.toggleActivity(activityButton.dataset.activity);
        logAnonymousEvent({ eventType:'activity_selected', newValue: activityButton.dataset.activity, context: STATE.config });
        return;
    }

    if (event.target.closest?.('#fabMain')) {
        toggleFabMenu();
        return;
    }

    const fabItem = event.target.closest?.('.fab-item');
    if (!fabItem) return;

    const filters = {
        'filter-all': 'all',
        'filter-clothing': 'clothing',
        'filter-tech': 'tech',
        'filter-essentials': 'essentials'
    };
    if (filters[fabItem.id]) Ctrl.setFilter(filters[fabItem.id]);
    else if (fabItem.id === 'copyListBtn') { await Ctrl.copyList(); maybeShowAutomaticFeedback('afterExport'); }
    else if (fabItem.id === 'exportPdfBtn') { await Ctrl.exportPDF(); maybeShowAutomaticFeedback('afterExport'); }
    else if (fabItem.id === 'exportCsvBtn') Ctrl.exportStatsCSV();
    else if (fabItem.id === 'shareListBtn') await Ctrl.shareList();
    else if (fabItem.id === 'uncheckAllBtn') Ctrl.uncheckAll();
    else if (fabItem.id === 'removeCheckedBtn' && confirm('Rimuovere dalla lista tutti gli item già presi?')) Ctrl.removeChecked();
    else if (fabItem.id === 'showStatsBtn') Ctrl.showStatsSummary();
    else if (fabItem.id === 'feedbackBtn') openFeedbackModal();
    else if (fabItem.id === 'adminFabBtn') document.getElementById('adminOpen')?.click();

    toggleFabMenu(false);
}

// --- FUNZIONI DI CONFIGURAZIONE ---
function syncConfig() {
    const nights = Number.parseInt(document.getElementById('nights')?.value, 10);
    const gender = document.getElementById('gender')?.value || '';
    const transportInput = document.getElementById('transport');
    const transports = [...(transportInput?.selectedOptions || [])].map(option => option.value);
    const transport = transports[0] || '';
    const laundryFreq = Number.parseInt(document.getElementById('laundryFreq')?.value, 10);
    const laundryBuffer = Number.parseInt(document.getElementById('laundryBuffer')?.value, 10);
    
    Ctrl.setConfig({ nights, gender, transport, transports, laundryFreq, laundryBuffer });
    logAnonymousEvent({ eventType:'gender_selected', newValue: gender, context: STATE.config });
    if (Object.keys(STATE.list).length > 0 && Ctrl.validateSetupForGenerate()) {
        Ctrl.generateList();
        renderSupportBanner('afterGenerate');
    }
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
