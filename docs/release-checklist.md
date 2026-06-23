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

## File che devono restare allineati

`npm run bump:version -- X.Y.Z` aggiorna e i test verificano questi punti:

- `js/modules/db.js`: `APP_VERSION`.
- `index.html`: versione visibile e query string degli asset versionati.
- `sw.js`: `CACHE_NAME` e asset versionati nella cache.
- `manifest.json`: `version` e `start_url`.
