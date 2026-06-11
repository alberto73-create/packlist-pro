# Risoluzione conflitti PR

La versione da mantenere nei conflitti della PR è quella del ramo corrente (`codex/fix-recent-functionality-issues-y2my4a`), senza combinare entrambe le sezioni.

## `js/app.js`

- Mantenere l'inizializzazione UI immediata e la registrazione PWA in background.
- Mantenere una sola chiamata per i listener installazione e una sola `setupTemplateActions()`.
- Mantenere gli handler diretti per meteo, attività, lavanderia e FAB definiti in `setupEventListeners()` / `setupFabActions()`.
- Non reintrodurre `setupGlobalControls()`: causava sovrapposizioni e conflitti con gli handler diretti.
- Mantenere `button.dataset.weather` e `button.dataset.activity`, coerenti con i pulsanti semantici generati dall'HTML/UI.

## `css/style.css`

- Mantenere la scheda attività da `82px`, centrata, con `width: 100%`, reset `appearance` e spunta `.act-btn.active::after`.

## `js/modules/controller.js`

- Mantenere il fallback `window.print()` quando jsPDF non è disponibile, così “Esporta PDF” resta utilizzabile.

## `sw.js`

- Mantenere integralmente il service worker corrente `packlist-v24`, con strategia network-first e fallback cache.

Dopo la risoluzione non devono essere presenti righe che iniziano con `<<<<<<<`, `=======` o `>>>>>>>`. Eseguire `npm test` prima del merge.
