// js/modules/pdf-export.js - Export PDF checklist leggibile

import { STATE, FILTER_MAP } from './db.js';
import { U } from './utils.js';
import { copyList } from './controller.js';
import { logAnonymousEvent } from './anonymous-logs.js';

function items() {
  return Object.values(STATE.list || {}).flat();
}

function ascii(value) {
  const normalized = String(value ?? '').normalize('NFD');
  let out = '';
  for (const ch of normalized) {
    const code = ch.charCodeAt(0);
    if (code >= 32 && code <= 126) out += ch;
  }
  return out.replaceAll('  ', ' ').trim();
}

function safeLine(value, max = 96) {
  const text = ascii(value);
  return text.length > max ? text.slice(0, max - 1) + '.' : text;
}

function addPage(doc, state) {
  doc.addPage();
  state.y = 24;
  doc.setFontSize(9);
  doc.text(safeLine(state.subtitle, 110), 14, 16);
}

function ensure(doc, state, needed = 8) {
  if (state.y + needed > 272) addPage(doc, state);
}

function visibleEntries() {
  const allowed = STATE.filter === 'all' ? null : FILTER_MAP[STATE.filter] || [];
  return Object.entries(STATE.list || {}).filter(([category]) => !allowed || allowed.includes(category));
}

function transportText() {
  const labels = { car: 'Auto', motorcycle: 'Moto', plane: 'Aereo', train: 'Treno', camper: 'Camper', walking: 'A piedi', auto: 'Auto', moto: 'Moto', aereo: 'Aereo', treno: 'Treno' };
  const list = Array.isArray(STATE.config?.transports) && STATE.config.transports.length ? STATE.config.transports : [STATE.config?.transport].filter(Boolean);
  return [...new Set(list.map(mode => labels[mode] || ascii(mode)).filter(Boolean))].join(', ') || 'Mezzo non indicato';
}

async function fallback(error = null) {
  if (error) console.warn('[PDF Export] fallback:', error);
  logAnonymousEvent({ eventType: 'export_pdf_fallback_used', context: STATE.config });
  if (typeof window.print === 'function') {
    try {
      U.toast('PDF non disponibile: apro la stampa');
      window.print();
      return true;
    } catch (printError) {
      console.warn('[PDF Export] stampa non disponibile:', printError);
    }
  }
  U.toast('PDF non disponibile: copio la lista');
  return copyList();
}

export async function exportStyledPDF() {
  const all = items();
  if (!all.length) {
    U.toast('Genera prima la packlist, poi esporta il PDF');
    return false;
  }

  const jsPDF = window.jspdf?.jsPDF;
  if (!jsPDF) return fallback();

  let doc;
  try {
    doc = new jsPDF();
  } catch (error) {
    return fallback(error);
  }

  const listName = String(STATE.listName || '').trim();
  const title = listName ? 'Packlist Pro - ' + ascii(listName) : 'Packlist Pro';
  const nights = Math.max(0, Number(STATE.config?.nights) || 0);
  const totalWeight = all.filter(item => !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
  const packed = all.filter(item => item.checked).length;
  const subtitle = `${nights} ${nights === 1 ? 'notte' : 'notti'} - ${transportText()} - ${all.length} item - ${U.weight(totalWeight)} - presi ${packed}/${all.length}`;
  const state = { y: 38, subtitle };

  doc.setTextColor?.(17, 24, 39);
  doc.setFontSize(19);
  doc.text(safeLine(title, 72), 14, 18);
  doc.setFontSize(9);
  doc.setTextColor?.(75, 85, 99);
  doc.text(safeLine(subtitle, 112), 14, 27);
  doc.setTextColor?.(17, 24, 39);

  for (const bag of STATE.baggages) {
    const bagItems = all.filter(item => item.baggageId === bag.id);
    if (!bagItems.length) continue;

    const bagWeight = bagItems.filter(item => !item.worn).reduce((sum, item) => sum + (item.w || 100) * item.q, 0);
    ensure(doc, state, 14);
    doc.setFillColor?.(241, 245, 249);
    doc.rect?.(14, state.y - 5, 182, 9, 'F');
    doc.setTextColor?.(15, 23, 42);
    doc.setFontSize(12);
    doc.text(safeLine(`${bag.name} - ${U.weight(bagWeight)}${bag.limit ? ` / limite ${bag.limit} kg` : ''}`, 92), 16, state.y);
    state.y += 9;

    for (const [category, categoryItems] of visibleEntries()) {
      const assigned = categoryItems.filter(item => item.baggageId === bag.id);
      if (!assigned.length) continue;
      ensure(doc, state, 10);
      doc.setTextColor?.(71, 85, 105);
      doc.setFontSize(10);
      doc.text(safeLine(String(category).toUpperCase(), 76), 14, state.y);
      state.y += 5;
      doc.setTextColor?.(31, 41, 55);
      doc.setFontSize(9);

      for (const item of assigned) {
        ensure(doc, state, 6);
        const mark = item.checked ? '[x]' : '[ ]';
        const worn = item.worn ? ' - indossato' : '';
        const bulky = item.bulky ? ' - ingombrante' : '';
        const line = `${mark} ${item.q}x ${item.n}${worn}${bulky} - ${U.weight((item.w || 100) * item.q)}`;
        doc.text(safeLine(line, 96), 17, state.y);
        state.y += 5;
      }
      state.y += 2;
    }
    state.y += 3;
  }

  const pages = doc.getNumberOfPages?.() || 1;
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage?.(page);
    doc.setTextColor?.(100, 116, 139);
    doc.setFontSize(8);
    doc.text(`Packlist Pro - pagina ${page}/${pages}`, 14, 284);
  }

  const safeName = ascii(listName).replaceAll(' ', '_').replaceAll('/', '_');
  try {
    doc.save(`packlist${safeName ? `_${safeName}` : ''}_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (error) {
    return fallback(error);
  }
  logAnonymousEvent({ eventType: 'export_pdf_used', context: STATE.config });
  U.toast('PDF esportato');
  return true;
}
