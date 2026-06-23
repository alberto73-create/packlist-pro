# Architettura runtime canonica e strategia anti-conflitti

Questo repository contiene una sola applicazione web e un solo entry point runtime:

- `index.html` carica `css/style.css` e `js/app.js` e contiene direttamente i pulsanti attività;
- `js/app.js` inizializza l'interfaccia e usa event delegation per meteo, attività e FAB;
- `sw.js` gestisce la cache PWA e deve essere aggiornato insieme alla versione applicazione;
- `vercel.json` impedisce a HTML, JavaScript, CSS e Service Worker obsoleti di restare nella cache HTTP.

Non aggiungere seconde pagine HTML, copie degli asset, rendering dinamici alternativi delle attività o handler diretti paralleli a `handleControlClick()`. In caso di conflitto, mantenere la versione che supera `npm test`: il test `runtime-integrity.mjs` verifica entry point unico, ID univoci, versione coerente e configurazione anti-cache.

## Regola pratica per ridurre conflitti

I conflitti ricorrenti arrivano quasi sempre da file molto contesi: `index.html`, `css/style.css`, `js/modules/controller.js`, `js/modules/communications.js`, `js/modules/db.js`, `manifest.json` e `sw.js`.

Per ridurli:

1. lavora sempre da `main` aggiornato prima di aprire una nuova PR;
2. evita più PR aperte che modificano gli stessi file globali;
3. tieni le PR piccole e tematiche: dati DB, UI/FAB, feedback, template, PWA/versione;
4. fai il bump versione solo alla fine della PR, non a ogni micro-modifica;
5. se una PR resta aperta mentre `main` cambia, aggiornala subito con `git fetch origin && git rebase origin/main` oppure `git merge origin/main`.

## Aggiornamento versione centralizzato

Quando cambia codice o stile visibile, usa lo script dedicato invece di modificare manualmente più file:

```bash
npm run bump:version -- 1.10.22
```

Lo script aggiorna in modo coerente:

- versione visibile e query string asset in `index.html`;
- `APP_VERSION` in `js/modules/db.js`;
- `CACHE_NAME` e asset versionati in `sw.js`;
- `manifest.json`.

Poi esegui sempre:

```bash
npm test
```

## Risoluzione conflitti consigliata

Per aggiornare una PR in conflitto:

```bash
git fetch origin
git checkout nome-branch-pr
git rebase origin/main
# risolvi i file indicati da Git
git add .
git rebase --continue
npm test
git push --force-with-lease
```

Se preferisci evitare rebase:

```bash
git fetch origin
git checkout nome-branch-pr
git merge origin/main
# risolvi i file indicati da Git
git add .
git commit
npm test
git push
```

Quando i conflitti riguardano `index.html`, `sw.js`, `manifest.json` e `js/modules/db.js`, dopo la risoluzione riesegui `npm run bump:version -- <versione-finale>` per riallineare tutto.

## Conflitti solo di versione

Se GitHub segnala conflitti limitati a `index.html`, `js/modules/db.js`, `manifest.json` e `sw.js`, di solito sono conflitti meccanici di versione/cache. Dopo aver allineato il branch, puoi usare il risolutore dedicato:

```bash
npm run resolve:version-conflicts
```

Il comando rimuove eventuali marker di conflitto da quei quattro file, sceglie la versione applicativa più alta già presente e riallinea versione visibile, `APP_VERSION`, `CACHE_NAME`, query string asset e `manifest.json`. Per forzare una versione finale specifica:

```bash
npm run resolve:version-conflicts -- 1.10.23
```

Poi esegui sempre:

```bash
npm test
```

Usa questo comando solo per conflitti meccanici di versione. Se nello stesso hunk ci sono modifiche funzionali a UI, DB o logica applicativa, risolvi prima manualmente quelle differenze e poi riallinea la versione.
