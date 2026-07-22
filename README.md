# Packlist Pro 🎒

Packlist Pro è una PWA in JavaScript vanilla per creare liste bagaglio personalizzate in base a durata, attività, meteo, mezzo di trasporto e preferenze di viaggio.

## ✨ Caratteristiche principali

- **Generazione intelligente della lista**
  - notti di viaggio, inclusa modalità gita in giornata;
  - sesso/unisex;
  - multi-mezzo: auto, moto, aereo, treno, camper, trekking/a piedi;
  - meteo multiplo: sole, pioggia, freddo;
  - attività multiple, incluse trekking, mare, città, campeggio, ferrata e speleo.

- **Gestione bagagli**
  - più bagagli nella stessa lista;
  - assegnazione item a un bagaglio specifico;
  - peso totale, peso per bagaglio e limite kg opzionale;
  - item indossati esclusi dal peso del bagaglio.

- **Template e condivisione**
  - salvataggio/caricamento liste locali;
  - snapshot completi con lista, bagagli e configurazione;
  - link condivisibili con supporto multi-mezzo.

- **PWA/offline**
  - installabile su mobile e desktop;
  - service worker con cache controllata;
  - fallback offline e protezione dello stato locale durante gli aggiornamenti.

- **Export e strumenti**
  - esportazione PDF;
  - copia lista;
  - esportazione CSV statistiche;
  - feedback e comunicazioni configurabili.

- **Console amministrativa**
  - accesso server-side tramite `ADMIN_PASSWORD`;
  - modifica visuale del database item;
  - compatibilità per meteo e mezzi su ogni item;
  - regole quantità per giorno/notte/lavanderia;
  - salvataggio DB tramite API e commit GitHub configurato da variabili ambiente.

## 🚀 Utilizzo

1. Apri l’applicazione nel browser o dalla PWA installata.
2. Imposta notti, sesso, mezzo, meteo e attività.
3. Clicca **Aggiorna Packlist**.
4. Spunta gli item man mano che li prepari.
5. Modifica quantità, peso, bagaglio o stato “indossato” dalle opzioni articolo.
6. Salva la lista come template, esportala in PDF o condividila con chi viaggia con te.

## 📱 Installazione PWA

### Desktop Chrome/Edge

- Usa l’icona di installazione nella barra degli indirizzi.
- In alternativa: menu browser → **Installa Packlist Pro**.

### iOS Safari

- Tocca **Condividi**.
- Seleziona **Aggiungi alla schermata Home**.

### Android Chrome

- Tocca il menu con tre puntini.
- Seleziona **Installa app** o **Aggiungi a schermata Home**.

## 🛠️ Tecnologie

- HTML5/CSS3
- JavaScript vanilla con moduli ES
- Service Worker
- Web App Manifest
- Vercel Serverless Functions
- GitHub Contents API per aggiornamento database admin
- jsPDF e jsPDF AutoTable per export PDF

## 📁 Struttura del progetto

```text
packlist-pro/
├── index.html                 # Pagina principale dell’app
├── css/style.css              # Stili interfaccia
├── js/app.js                  # Entry point JavaScript
├── js/modules/                # Moduli applicativi
├── api/                       # API serverless Vercel
├── manifest.json              # Manifest PWA
├── sw.js                      # Service Worker
├── tests/                     # Test runtime/smoke
├── scripts/                   # Script manutenzione/versioni
├── vercel.json                # Configurazione deploy/cache Vercel
└── icons/                     # Icone PWA
```

## ✅ Test

```bash
npm test
```

Il comando esegue controllo conflict marker, version resolver, runtime integrity, admin auth e smoke test applicativo.

Per acquisire uno screenshot headless:

```bash
npm run screenshot
```

La workflow **Visual smoke test** esegue test e screenshot sulle pull request e sui push verso `main`.

## 🔐 Console amministrativa

La console admin richiede autenticazione server-side. Non inserire mai password, token GitHub o chiavi admin dentro i file statici della PWA.

Variabili ambiente principali:

- `ADMIN_PASSWORD`
- `GITHUB_TOKEN`
- `GITHUB_REPO`
- `GITHUB_BRANCH` opzionale, default `main`

## 📄 Licenza

Questo progetto è open source.

---

**Packlist Pro** — la tua packlist di viaggio intelligente 🌍
