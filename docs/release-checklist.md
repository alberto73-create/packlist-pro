# Release checklist Packlist Pro

Questa procedura evita disallineamenti tra versione applicazione, cache PWA, asset versionati e manifest.

## Procedura standard

1. Aggiorna la versione con lo script dedicato:

   ```bash
   npm run bump:version -- X.Y.Z
   ```

2. Esegui tutti i controlli automatici:

   ```bash
   npm test
   ```

3. Verifica il diff e crea il commit della release.
4. Esegui il deploy su Vercel.
5. Dopo il deploy, fai hard refresh nel browser e testa la PWA installata per verificare che service worker e cache carichino la nuova versione.
6. Testa anche l’export PDF offline dopo installazione/cache della PWA.

## Quota deploy Vercel

Se Vercel risponde con `Resource is limited - try again in 24 hours (more than 100, code: "api-deployments-free-per-day")`, il deploy non è fallito per un errore del codice: è stata raggiunta la quota giornaliera del piano/progetto. In quel caso:

1. non continuare a rilanciare deploy manuali, perché consumeresti solo altri tentativi quando la quota torna disponibile;
2. conserva il commit già pronto e verifica localmente con `npm test`;
3. attendi il reset indicato da Vercel, normalmente entro 24 ore, oppure usa un piano/progetto con quota più alta;
4. quando la quota è di nuovo disponibile, ridistribuisci l’ultimo commit invece di creare commit vuoti solo per forzare il deploy.

## File che devono restare allineati

`npm run bump:version -- X.Y.Z` aggiorna e i test verificano questi punti:

- `js/modules/db.js`: `APP_VERSION`.
- `index.html`: versione visibile e query string degli asset versionati.
- `sw.js`: `CACHE_NAME` e asset versionati nella cache.
- `manifest.json`: `version` e `start_url`.
