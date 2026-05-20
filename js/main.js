// js/main.js - Punto di ingresso principale

import { STATE, Storage, ACTIVITIES } from './modules/db.js';
import { Ctrl } from './modules/controller.js';

// ═══════════════════════════════════════════════════════════════════
// EVENT DELEGATION
// ═══════════════════════════════════════════════════════════════════
document.getElementById('results').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        e.stopPropagation();
        const { action, cat, uid, input: inputId } = btn.dataset;
        if (action === 'worn') Ctrl.toggleWorn(cat, uid);
        else if (action === 'edit') Ctrl.editWeight(cat, uid);
        else if (action === 'del')  Ctrl.removeItem(cat, uid);
        else if (action === 'add')  Ctrl.addCustom(cat, inputId);
        return;
    }
    const row = e.target.closest('.item-row');
    if (row && !e.target.closest('input')) Ctrl.toggleItem(row.dataset.cat, row.dataset.uid);
});

document.getElementById('results').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('item-row')) {
        e.preventDefault();
        Ctrl.toggleItem(e.target.dataset.cat, e.target.dataset.uid);
    }
    if (e.key === 'Enter' && e.target.matches('.add-custom input')) {
        const cat = e.target.closest('.cat-box')?.dataset.cat;
        if (cat) { e.preventDefault(); Ctrl.addCustom(cat, e.target.id); }
    }
});

document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        Ctrl.undoDelete();
    }
    const el = e.target;
    if ((el.classList.contains('weather-btn') || el.classList.contains('act-btn') || el.classList.contains('toggle-group'))
        && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        el.click();
    }
    if (e.key === 'Escape') {
        const menu = document.getElementById('fabMenu');
        if (menu.classList.contains('open')) Ctrl.toggleMenu();
    }
});

// Activity grid setup
const grid = document.getElementById('activityGrid');
ACTIVITIES.forEach(a => {
    const div = document.createElement('div');
    div.className = 'act-btn';
    div.id = `act-${a.id}`;
    div.setAttribute('role', 'button');
    div.setAttribute('aria-pressed', 'false');
    div.setAttribute('tabindex', '0');
    div.title = a.label;
    div.innerHTML = `<i>${a.icon}</i><span>${a.label}</span>`;
    grid.appendChild(div);
});
grid.addEventListener('click', e => {
    const btn = e.target.closest('.act-btn');
    if (!btn) return;
    btn.classList.toggle('active');
    btn.setAttribute('aria-pressed', btn.classList.contains('active'));
    Ctrl.syncConfig();
});

document.addEventListener('click', e => {
    const container = document.querySelector('.fab-container');
    const menu = document.getElementById('fabMenu');
    if (menu.classList.contains('open') && !container.contains(e.target)) {
        Ctrl.toggleMenu();
    }
});

// ═══════════════════════════════════════════════════════════════════
// BOOT
// ═══════════════════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
    const data = Storage.load();
    if (data) {
        STATE.list   = data.list   || {};
        STATE.config = data.config || { nights: 1, gender: 'U', transport: 'auto', weather: [], activities: [], laundry: false, laundryFreq: 3, laundryBuffer: 1 };
        Ctrl.restoreConfig(STATE.config);
        if (Object.keys(STATE.list).length) Ctrl.rerender();
    }
    Ctrl.loadTemplateDropdown();
});
