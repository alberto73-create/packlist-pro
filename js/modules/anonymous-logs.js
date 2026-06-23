import { APP_VERSION } from './db.js';

const SETTINGS_KEY = 'packlist_anonymous_log_settings';
const QUEUE_KEY = 'packlist_anonymous_log_queue';
const MAX_QUEUE = 120;
const ALLOWED_EVENTS = new Set(['packlist_generated','item_added','item_removed','item_quantity_changed','item_marked_packed','item_unmarked_packed','activity_selected','weather_selected','transport_selected','gender_selected','template_saved','template_loaded','feedback_submitted','export_pdf_used','export_pdf_fallback_used','offline_mode_detected','app_error']);
const ALLOWED_FIELDS = ['eventType','timestamp','appVersion','source','itemId','category','oldValue','newValue','context','deviceClass','browserFamily','language','isOnline'];
const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
export const DEFAULT_LOG_SETTINGS = { enabled: true, endpointUrl: '' };
export const loadAnonymousLogSettings = () => ({ ...DEFAULT_LOG_SETTINGS, ...read(SETTINGS_KEY, {}) });
export const saveAnonymousLogSettings = settings => write(SETTINGS_KEY, { ...loadAnonymousLogSettings(), ...settings });
export const getAnonymousLogQueue = () => read(QUEUE_KEY, []);
export const clearAnonymousLogQueue = () => write(QUEUE_KEY, []);
function roundTimestamp(date = new Date()) { date.setSeconds(0, 0); return date.toISOString(); }
function deviceClass() { return matchMedia?.('(pointer:coarse)')?.matches || innerWidth < 700 ? 'mobile' : 'desktop'; }
function browserFamily() { const ua = navigator.userAgent || ''; if (/Firefox/i.test(ua)) return 'Firefox'; if (/Edg/i.test(ua)) return 'Edge'; if (/Chrome|Chromium/i.test(ua)) return 'Chrome'; if (/Safari/i.test(ua)) return 'Safari'; return 'Other'; }
function cleanScalar(value) { if (typeof value === 'number' || typeof value === 'boolean') return value; if (Array.isArray(value)) return value.map(cleanScalar).filter(v => v !== undefined).slice(0, 20); if (typeof value === 'string') return value.toLowerCase().replace(/[^a-z0-9_ -]/gi, '').slice(0, 80); return undefined; }
function sanitizeContext(context = {}) {
  const weather = Array.isArray(context.weatherModes) ? context.weatherModes : context.weather;
  const transports = Array.isArray(context.transportModes) ? context.transportModes : context.transports;
  return {
    nights: Number(context.nights) || 0,
    activities: Array.isArray(context.activities) ? context.activities.map(cleanScalar).filter(Boolean).slice(0, 20) : [],
    weatherModes: Array.isArray(weather) ? weather.map(cleanScalar).filter(Boolean).slice(0, 10) : [],
    transportModes: Array.isArray(transports) ? transports.map(cleanScalar).filter(Boolean).slice(0, 10) : []
  };
}
export function sanitizeAnonymousEvent(event = {}) {
  if (!ALLOWED_EVENTS.has(event.eventType)) return null;
  const clean = { eventType: event.eventType, timestamp: roundTimestamp(), appVersion: APP_VERSION, source: cleanScalar(event.source || 'packlist'), deviceClass: deviceClass(), browserFamily: browserFamily(), language: String(navigator.language || '').slice(0, 8), isOnline: navigator.onLine !== false };
  if (event.itemId) clean.itemId = cleanScalar(event.itemId);
  if (event.category) clean.category = cleanScalar(event.category);
  if (event.oldValue !== undefined) clean.oldValue = cleanScalar(event.oldValue);
  if (event.newValue !== undefined) clean.newValue = cleanScalar(event.newValue);
  if (event.context) clean.context = sanitizeContext(event.context);
  return Object.fromEntries(Object.entries(clean).filter(([key, value]) => ALLOWED_FIELDS.includes(key) && value !== undefined));
}
export async function flushAnonymousLogQueue() {
  const settings = loadAnonymousLogSettings();
  const queue = getAnonymousLogQueue();
  if (!settings.enabled || !settings.endpointUrl || navigator.onLine === false || !queue.length) return false;
  try { await fetch(settings.endpointUrl, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ action:'anonymousLogs', events: queue }) }); clearAnonymousLogQueue(); return true; } catch { return false; }
}
export function logAnonymousEvent(event) {
  try {
    const settings = loadAnonymousLogSettings(); if (!settings.enabled) return false;
    const clean = sanitizeAnonymousEvent(event); if (!clean) return false;
    const queue = [...getAnonymousLogQueue(), clean].slice(-MAX_QUEUE); write(QUEUE_KEY, queue);
    flushAnonymousLogQueue(); return true;
  } catch { return false; }
}
globalThis.addEventListener?.('online', flushAnonymousLogQueue);
