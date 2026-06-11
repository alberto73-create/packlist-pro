# Architettura runtime canonica

Questo repository contiene una sola applicazione web e un solo entry point runtime:

- `index.html` carica `css/style.css` e `js/app.js` e contiene direttamente i pulsanti attività;
- `js/app.js` inizializza l'interfaccia e usa event delegation per meteo, attività e FAB;
- `sw.js` gestisce la cache PWA e deve essere aggiornato insieme alla versione applicazione;
- `vercel.json` impedisce a HTML, JavaScript, CSS e Service Worker obsoleti di restare nella cache HTTP.

Non aggiungere seconde pagine HTML, copie degli asset, rendering dinamici alternativi delle attività o handler diretti paralleli a `handleControlClick()`. In caso di conflitto, mantenere la versione che supera `npm test`: il test `runtime-integrity.mjs` verifica entry point unico, ID univoci, versione coerente e configurazione anti-cache.

Quando cambia codice o stile visibile:

1. aggiornare `APP_VERSION` in `js/modules/db.js`;
2. usare la stessa versione nelle query asset di `index.html` e `sw.js`;
3. incrementare `CACHE_NAME` in `sw.js`;
4. eseguire `npm test`.
