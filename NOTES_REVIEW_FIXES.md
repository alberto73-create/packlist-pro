# Review fixes - note operative

Questo branch applica la revisione richiesta escludendo volutamente il cambio del calcolo peso "in valigia".

## Modifiche incluse

- La condivisione multi-mezzo è gestita direttamente da `js/modules/controller.js`, così creazione e importazione dei link usano lo stesso formato.
- Aggiornati i log anonimi per leggere sia `weather/transports` sia `weatherModes/transportModes`.
- Aggiornata la workflow `Visual smoke test` per partire anche su push verso `main`.
- Aggiornato il README con stato attuale della PWA, admin, condivisione e test.
- Aggiunto il loader alla cache del service worker.

## Da verificare prima del merge

- `manifest.json` deve essere allineato alla versione dell'app shell corrente.
- I warning aereo in `js/modules/db.js` vanno ricontrollati: la modifica automatica ha preservato il controllo aggregato ma non la separazione perfetta dei due messaggi.
- Eseguire `npm test` e `npm run screenshot` prima del merge.

## Scelta intenzionale

Non è stato modificato il calcolo del chip `weightSuitcase`, come richiesto.
