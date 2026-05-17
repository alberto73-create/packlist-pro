// ============================================================
//  Packlist Pro — App Logic v1.00.14
// ============================================================

// ── CONFIG & STATE ───────────────────────────────────────────
const DEFAULT_CONFIG = {
    nights: 1, gender: 'M', transport: 'auto',
    weather: [], activities: [], laundry: false, laundryFreq: 3, laundryBuffer: 1
};

let STATE = {
    config: { ...DEFAULT_CONFIG },
    list: {},
    lastRemoved: null,
    filter: 'all',
    currentTemplateName: ''
};

// ── ACTIVITIES ───────────────────────────────────────────────
const ACTIVITIES = [
    {id:'trekking',label:'Trekking',icon:'⛰️'},{id:'piscina',label:'Piscina',icon:'🏊‍♂️'},
    {id:'spiaggia',label:'Spiaggia',icon:'🏖️'},{id:'citta',label:'Città',icon:'🏙️'},
    {id:'lavoro',label:'Lavoro',icon:'💼'},{id:'cena',label:'Cena Elegante',icon:'🍽️'},
    {id:'ciclismo',label:'Bici/Ciclismo',icon:'🚴'},{id:'sport_invernali',label:'Sci/Neve',icon:'⛷️'},
    {id:'moto_adv',label:'Moto Pro',icon:'🏍️'},{id:'camping',label:'Campeggio',icon:'⛺'},
    {id:'foto',label:'Fotografia',icon:'📸'},{id:'fitness',label:'Run/Fitness',icon:'🏋️'},
    {id:'bambini',label:'Con Bambini',icon:'👶'},{id:'alpinismo',label:'Alpinismo',icon:'🏔️'},
    {id:'ferrata',label:'Via Ferrata',icon:'🧗'},
];

const NAME_ALIASES = {
    'guscio impermeabile':'guscio/impermeabile','guscio gore-tex':'guscio/impermeabile',
    'giacca gore-tex':'guscio/impermeabile','giacca impermeabile leggera':'guscio/impermeabile',
    'giacca antipioggia':'guscio/impermeabile','copri-tuta impermeabile':'guscio/impermeabile',
    'giacca leggera antipioggia':'guscio/impermeabile',
    'zaino tecnico':'zaino tecnico (30-40l)','kit soccorso tecnico':'kit primo soccorso',
    'kit soccorso ferrata':'kit primo soccorso','kit pronto soccorso':'kit primo soccorso',
    'kit pronto soccorso bambino':'kit primo soccorso','kit pronto soccorso rapido':'kit primo soccorso',
    'borraccia 1l':'borraccia','borraccia bici':'borraccia','borraccia pieghevole':'borraccia',
    'occhiali uv':'occhiali da sole','occhiali uv ferrata':'occhiali da sole',
    'occhiali uv neve':'occhiali da sole','occhiali polarizzati':'occhiali da sole',
    'occhiali ghiacciaio cat.4':'occhiali da sole','visiera/occhiali ciclismo':'occhiali da sole',
    'crema spf alta':'crema solare spf50','spf alto':'crema solare spf50',
    'spf alto neve':'crema solare spf50','spf 50+ labbra/viso':'crema solare spf50',
    'crema spf':'crema solare spf50','spf':'crema solare spf50',
    'protezione solare waterproof':'crema solare spf50','spf 30+ compatto':'crema solare spf50',
    'ciabatte hotel':'ciabatte','acqua 1l':'acqua','fodera termica giacca':'fodera termica'
};

const normalizeName = n => NAME_ALIASES[(n||'').trim().toLowerCase()] || (n||'').trim().toLowerCase();

const WARNINGS = [
    { check: s => s.config.transport==='aereo' && Object.values(s.list).flat().some(i=>i.n.includes('Coltellino')), msg:'✈️ Attenzione: il coltellino multiuso non è consentito in cabina'},
    { check: s => s.config.transport==='aereo' && Object.values(s.list).flat().some(i=>i.n.includes('Accendino')), msg:'✈️ Attenzione: gli accendini sono vietati in aereo'},
    { check: s => s.config.nights===0 && s.config.laundry, msg:'🧺 Lavanderia non necessaria per gite in giornata'},
    { check: s => s.config.nights>7 && !s.config.laundry, msg:`👔 Viaggio lungo senza lavanderia: considera l'attivazione per ottimizzare i bagagli`},
];

const FILTER_MAP = {
    clothing:['Abbigliamento Base','Abbigliamento','Trekking','Piscina','Spiaggia','Città','Lavoro','Cena Elegante','Ciclismo','Sport Invernali','Moto Pro','Fitness','Bambini','Tecnico'],
    tech:['Tech','Lavoro','Fotografia','Moto','Trasporto'],
    essentials:['Essenziali','Igiene','Salute','Comfort','Zaino','Accessori','Camping','Lavanderia','Sicurezza','Città']
};

// ── DATABASE ─────────────────────────────────────────────────
const DB = {
    base:[
        {n:"Mutande",q:"n",cat:"Abbigliamento Base",s:"U",w:50,v:1,overnight:true},{n:"Calze",q:"n",cat:"Abbigliamento Base",s:"U",w:80,v:1,overnight:true},
        {n:"Canottiere/Sottogiacca",q:"n",cat:"Abbigliamento Base",s:"U",w:120,v:1,overnight:true},{n:"T-shirt",q:"n",cat:"Abbigliamento Base",s:"U",w:180,v:1,overnight:true},
        {n:"Pigiama",q:"f",cat:"Abbigliamento Base",s:"U",w:300,v:2,overnight:true},{n:"Pantaloni casual",q:"f",cat:"Abbigliamento Base",s:"U",w:400,v:2,worn:true},
        {n:"Documenti/Patente",q:"f",cat:"Essenziali",s:"U",w:30,v:1},{n:"Portafoglio/Contanti",q:"f",cat:"Essenziali",s:"U",w:100,v:1},
        {n:"Cellulare + Cavo",q:"f",cat:"Tech",s:"U",w:250,v:1},{n:"Powerbank",q:"f",cat:"Tech",s:"U",w:250,v:1},
        {n:"Multipresa viaggio",q:"f",cat:"Tech",s:"U",w:300,v:2,overnight:true},{n:"Cuffie",q:"f",cat:"Tech",s:"U",w:200,v:1},
        {n:"Spazzolino/Dentifricio",q:"f",cat:"Igiene",s:"U",w:80,v:1,overnight:true},{n:"Deodorante",q:"f",cat:"Igiene",s:"U",w:100,v:1,overnight:true},
        {n:"Tagliaunghie/Pinzetta",q:"f",cat:"Igiene",s:"U",w:50,v:1,overnight:true},{n:"Kit Barba",q:"f",cat:"Igiene",s:"M",w:200,v:1,overnight:true},
        {n:"Trucchi base",q:"f",cat:"Igiene",s:"F",w:300,v:2,overnight:true},{n:"Tachipirina/Oki",q:"f",cat:"Salute",s:"U",w:50,v:1},
        {n:"Cerotti assortiti",q:"f",cat:"Salute",s:"U",w:40,v:1},{n:"Disinfettante mani",q:"f",cat:"Salute",s:"U",w:100,v:1},
        {n:"Shampoo",q:"f",cat:"Igiene",s:"U",w:100,v:1,overnight:true},{n:"Bagnoschiuma",q:"f",cat:"Igiene",s:"U",w:100,v:1,overnight:true},
        {n:"Borraccia",q:"f",cat:"Accessori",s:"U",w:250,v:1}
    ],
    laundry:[{n:"Busta panni sporchi",q:"f",cat:"Lavanderia",s:"U",w:30,v:1},{n:"Detersivo viaggio",q:"f",cat:"Lavanderia",s:"U",w:50,v:1},{n:"Ammorbidente viaggio",q:"f",cat:"Lavanderia",s:"U",w:50,v:1},{n:"Mollette viaggio",q:"f",cat:"Lavanderia",s:"U",w:30,v:1},{n:"Filo stendino",q:"f",cat:"Lavanderia",s:"U",w:40,v:1}],
    documents:[{n:"Tessera sanitaria",q:"f",cat:"Essenziali",s:"U",w:5,v:1},{n:"Numeri emergenza locali",q:"f",cat:"Essenziali",s:"U",w:5,v:1},{n:"Copia documenti digitale",q:"f",cat:"Essenziali",s:"U",w:5,v:1}],
    comfort:[{n:"Spazzola/Pettine",q:"f",cat:"Igiene",s:"U",w:60,v:1,overnight:true},{n:"Bastoncini cotonati",q:"f",cat:"Igiene",s:"U",w:20,v:1,overnight:true},{n:"Cerotto antinausea",q:"f",cat:"Salute",s:"U",w:10,v:1},{n:"Lucido scarpe compatto",q:"f",cat:"Igiene",s:"U",w:40,v:1,overnight:true},{n:"Mascherina viaggio",q:"f",cat:"Salute",s:"U",w:10,v:1}],
    weather:{
        sun:[{n:"Occhiali da sole",q:"f",cat:"Accessori",s:"U",w:80,v:1},{n:"Crema solare SPF50",q:"f",cat:"Salute",s:"U",w:200,v:1},{n:"Cappellino",q:"f",cat:"Accessori",s:"U",w:100,v:1}],
        rain:[{n:"Ombrello piccolo",q:"f",cat:"Accessori",s:"U",w:300,v:2},{n:"Guscio/Impermeabile",q:"f",cat:"Abbigliamento",s:"U",w:600,v:2},{n:"Scarpe waterproof",q:"f",cat:"Abbigliamento",s:"U",w:800,v:3},{n:"Sacca impermeabile",q:"f",cat:"Accessori",s:"U",w:150,v:1}],
        cold:[{n:"Maglia termica",q:"f",cat:"Abbigliamento",s:"U",w:200,v:2},{n:"Guanti/Berretto",q:"f",cat:"Accessori",s:"U",w:150,v:1},{n:"Burrocacao",q:"f",cat:"Salute",s:"U",w:30,v:1},{n:"Sciarpa",q:"f",cat:"Accessori",s:"U",w:200,v:2},{n:"Giacca pesante",q:"f",cat:"Abbigliamento",s:"U",w:900,v:3,worn:true}],
    },
    transport:{
        auto:[{n:"Occhiali guida",q:"f",cat:"Trasporto",s:"U",w:80,v:1},{n:"Cavo ricarica auto",q:"f",cat:"Tech",s:"U",w:150,v:1},{n:"Kit emergenza auto",q:"f",cat:"Trasporto",s:"U",w:400,v:2}],
        moto:[{n:"Kit foratura",q:"f",cat:"Moto",s:"U",w:300,v:1},{n:"Grasso catena spray",q:"f",cat:"Moto",s:"U",w:200,v:1},{n:"Panno visiera",q:"f",cat:"Moto",s:"U",w:30,v:1},{n:"Bloccadisco",q:"f",cat:"Moto",s:"U",w:400,v:2},{n:"Guanti moto",q:"f",cat:"Moto",s:"U",w:300,v:2,worn:true}],
        aereo:[{n:"Passaporto",q:"f",cat:"Essenziali",s:"U",w:50,v:1},{n:"Liquidi <100ml",q:"f",cat:"Igiene",s:"U",w:300,v:1},{n:"Tappi orecchie",q:"f",cat:"Comfort",s:"U",w:20,v:1},{n:"Adattatore prese",q:"f",cat:"Tech",s:"U",w:100,v:1},{n:"Cuscino viaggio",q:"f",cat:"Comfort",s:"U",w:200,v:3,overnight:true}],
        backpack:[{n:"Asciugamano microfibra",q:"f",cat:"Igiene",s:"U",w:200,v:2},{n:"Lucchetto TSA",q:"f",cat:"Zaino",s:"U",w:100,v:1,overnight:true},{n:"Coprizaino pioggia",q:"f",cat:"Zaino",s:"U",w:150,v:1}],
    },
    safety:[{n:"Kit primo soccorso",q:"f",cat:"Sicurezza",s:"U",w:250,v:1},{n:"Fischietto emergenza",q:"f",cat:"Sicurezza",s:"U",w:15,v:1},{n:"Coperta isotermica",q:"f",cat:"Sicurezza",s:"U",w:60,v:1},{n:"Lampada frontale",q:"f",cat:"Sicurezza",s:"U",w:100,v:1},{n:"Mappa cartacea/GPS",q:"f",cat:"Sicurezza",s:"U",w:90,v:1},{n:"Copia documenti",q:"f",cat:"Sicurezza",s:"U",w:30,v:1},{n:"Farmaci personali",q:"f",cat:"Sicurezza",s:"U",w:120,v:1},{n:"Nastro adesivo (duct tape)",q:"f",cat:"Sicurezza",s:"U",w:40,v:1},{n:"Cordino paracord 5m",q:"f",cat:"Sicurezza",s:"U",w:35,v:1}],
    extra:{
        citta_comuni:[{n:"Scarpe comode walking",q:"f",cat:"Città",s:"U",w:600,v:2,worn:true},{n:"Zainetto/Marsupio antifurto",q:"f",cat:"Città",s:"U",w:300,v:2},{n:"Portafoglio/Carta trasporti",q:"f",cat:"Città",s:"U",w:80,v:1},{n:"Borraccia pieghevole",q:"f",cat:"Città",s:"U",w:100,v:1},{n:"Fazzoletti/Igienizzante",q:"f",cat:"Città",s:"U",w:60,v:1},{n:"Mappa/Guida offline",q:"f",cat:"Città",s:"U",w:50,v:1}],
        citta_uomo:[{n:"Pantaloni leggeri",q:"f",cat:"Città",s:"M",w:300,v:1,worn:true},{n:"Camicia/Polo traspirante",q:"f",cat:"Città",s:"M",w:180,v:1,worn:true},{n:"Portadocumenti collo",q:"f",cat:"Città",s:"M",w:40,v:1}],
        citta_donna:[{n:"Borsa a tracolla sicura",q:"f",cat:"Città",s:"F",w:250,v:1},{n:"Foulard/Coprispalle",q:"f",cat:"Città",s:"F",w:120,v:1},{n:"Kit make-up compatto",q:"f",cat:"Città",s:"F",w:100,v:1},{n:"Ballerine/Sandali comodi",q:"f",cat:"Città",s:"F",w:300,v:2,worn:true}],
        citta_sole:[{n:"Cappellino visiera",q:"f",cat:"Città",s:"U",w:80,v:1},{n:"SPF 30+ compatto",q:"f",cat:"Città",s:"U",w:80,v:1},{n:"Ventaglio/Mini nebulizzatore",q:"f",cat:"Città",s:"U",w:50,v:1}],
        citta_pioggia:[{n:"Ombrello compatto",q:"f",cat:"Città",s:"U",w:250,v:2},{n:"Giacca impermeabile leggera",q:"f",cat:"Città",s:"U",w:300,v:2},{n:"Sacchetto stagno documenti",q:"f",cat:"Città",s:"U",w:30,v:1}],
        citta_freddo:[{n:"Maglione/Cardigan leggero",q:"f",cat:"Città",s:"U",w:350,v:2},{n:"Sciarpa leggera",q:"f",cat:"Città",s:"U",w:100,v:1},{n:"Guanti touchscreen",q:"f",cat:"Città",s:"U",w:60,v:1}],
        citta_giornata:[{n:"Biglietti musei (digitale)",q:"f",cat:"Città",s:"U",w:10,v:1},{n:"Snack bar energetico",q:"f",cat:"Città",s:"U",w:50,v:1},{n:"Salviette umidificate",q:"f",cat:"Città",s:"U",w:40,v:1}],
        citta_multiday:[{n:"Pigiama leggero",q:"f",cat:"Città",s:"U",w:200,v:1,overnight:true},{n:"Kit toilette viaggio",q:"f",cat:"Città",s:"U",w:150,v:1,overnight:true},{n:"Busta biancheria sporca",q:"f",cat:"Città",s:"U",w:30,v:1,overnight:true},{n:"Adattatore prese",q:"f",cat:"Città",s:"U",w:80,v:1,overnight:true},{n:"Ciabatte hotel",q:"f",cat:"Città",s:"U",w:100,v:1,overnight:true}],
        trekking_comuni:[{n:"Zaino trekking (20-35L)",q:"f",cat:"Trekking",s:"U",w:900,v:3,worn:true},{n:"Borraccia 1L",q:"f",cat:"Trekking",s:"U",w:250,v:1},{n:"Scarponi trekking",q:"f",cat:"Trekking",s:"U",w:1200,v:3,worn:true},{n:"Calze tecniche riserva",q:"n",cat:"Trekking",s:"U",w:100,v:1},{n:"Bastoncini trekking",q:"f",cat:"Trekking",s:"U",w:400,v:3},{n:"Giacca windstopper leggera",q:"f",cat:"Trekking",s:"U",w:350,v:2},{n:"Snack base",q:"f",cat:"Trekking",s:"U",w:150,v:1},{n:"Mappa/GPS offline",q:"f",cat:"Trekking",s:"U",w:80,v:1},{n:"Kit primo soccorso",q:"f",cat:"Trekking",s:"U",w:250,v:1}],
        trekking_uomo:[{n:"Calzamaglia termica (opzionale)",q:"f",cat:"Trekking",s:"M",w:150,v:1},{n:"Crema anti-attrito",q:"f",cat:"Trekking",s:"M",w:50,v:1}],
        trekking_donna:[{n:"Reggiseno sport",q:"f",cat:"Trekking",s:"F",w:80,v:1},{n:"Prodotti igiene specifici",q:"f",cat:"Trekking",s:"F",w:60,v:1}],
        trekking_sole:[{n:"Cappello tesa larga",q:"f",cat:"Trekking",s:"U",w:90,v:2},{n:"Crema SPF alta",q:"f",cat:"Trekking",s:"U",w:150,v:1},{n:"Sali minerali/elettroliti",q:"f",cat:"Trekking",s:"U",w:40,v:1}],
        trekking_pioggia:[{n:"Guscio impermeabile",q:"f",cat:"Trekking",s:"U",w:450,v:2},{n:"Coprizaino",q:"f",cat:"Trekking",s:"U",w:120,v:1},{n:"Sacchetti stagni vestiti",q:"f",cat:"Trekking",s:"U",w:40,v:1},{n:"Calze extra impermeabili",q:"f",cat:"Trekking",s:"U",w:110,v:1}],
        trekking_freddo:[{n:"Pile tecnico",q:"f",cat:"Trekking",s:"U",w:350,v:2},{n:"Guanti leggeri",q:"f",cat:"Trekking",s:"U",w:60,v:1},{n:"Buff/scaldacollo",q:"f",cat:"Trekking",s:"U",w:40,v:1},{n:"Berretto termico",q:"f",cat:"Trekking",s:"U",w:50,v:1}],
        trekking_giornata:[{n:"Maglia tecnica traspirante",q:"f",cat:"Trekking",s:"U",w:180,v:1,worn:true},{n:"Pantaloni quick-dry",q:"f",cat:"Trekking",s:"U",w:300,v:2,worn:true},{n:"Snack energetici extra",q:"f",cat:"Trekking",s:"U",w:200,v:1},{n:"Sacchetto rifiuti (LNT)",q:"f",cat:"Trekking",s:"U",w:10,v:1},{n:"Lampada frontale",q:"f",cat:"Trekking",s:"U",w:100,v:1},{n:"Fischietto emergenza",q:"f",cat:"Trekking",s:"U",w:15,v:1}],
        trekking_multiday:[{n:"Sacco biancheria sporca",q:"f",cat:"Trekking",s:"U",w:30,v:1,overnight:true}],
        piscina_comuni:[{n:"Ciabatte",q:"f",cat:"Piscina",s:"U",w:200,v:1},{n:"Accappatoio",q:"f",cat:"Piscina",s:"U",w:500,v:1},{n:"Cuffia",q:"f",cat:"Piscina",s:"U",w:30,v:1},{n:"Costume piscina",q:"f",cat:"Piscina",s:"U",w:250,v:1},{n:"Occhialini",q:"f",cat:"Piscina",s:"U",w:60,v:1},{n:"Dry bag",q:"f",cat:"Piscina",s:"U",w:150,v:1},{n:"Tappo naso",q:"f",cat:"Piscina",s:"U",w:20,v:1},{n:"Borsa piscina",q:"f",cat:"Piscina",s:"U",w:400,v:1}],
        piscina_uomo:[{n:"Costume slip piscina",q:"f",cat:"Piscina",s:"M",w:180,v:1}],
        piscina_donna:[{n:"Costume intero piscina",q:"f",cat:"Piscina",s:"F",w:220,v:1}],
        piscina_sole:[{n:"Telo da mare",q:"f",cat:"Piscina",s:"U",w:400,v:1},{n:"Protezione solare waterproof",q:"f",cat:"Piscina",s:"U",w:150,v:1},{n:"Cappello",q:"f",cat:"Piscina",s:"U",w:90,v:1}],
        piscina_giornata:[{n:"Snack",q:"f",cat:"Piscina",s:"U",w:200,v:1},{n:"Acqua",q:"f",cat:"Piscina",s:"U",w:500,v:1},{n:"Shampoo extra",q:"f",cat:"Piscina",s:"U",w:100,v:1}],
        piscina_multiday:[{n:"Costume riserva",q:"f",cat:"Piscina",s:"U",w:250,v:1,overnight:true}],
        spiaggia_comuni:[{n:"Ciabatte",q:"f",cat:"Spiaggia",s:"U",w:200,v:1},{n:"Telo mare",q:"f",cat:"Spiaggia",s:"U",w:400,v:1},{n:"Protezione solare waterproof",q:"f",cat:"Spiaggia",s:"U",w:150,v:1},{n:"Libro/Kindle",q:"f",cat:"Spiaggia",s:"U",w:250,v:1},{n:"Borsa termica",q:"f",cat:"Spiaggia",s:"U",w:300,v:1},{n:"Dry bag",q:"f",cat:"Spiaggia",s:"U",w:150,v:1},{n:"Acqua",q:"f",cat:"Spiaggia",s:"U",w:500,v:1},{n:"Snack",q:"f",cat:"Spiaggia",s:"U",w:200,v:1}],
        spiaggia_uomo:[{n:"Bermuda",q:"f",cat:"Spiaggia",s:"M",w:200,v:1},{n:"T-shirt spiaggia",q:"f",cat:"Spiaggia",s:"M",w:180,v:1}],
        spiaggia_donna:[{n:"Bikini",q:"f",cat:"Spiaggia",s:"F",w:200,v:1},{n:"Pareo",q:"f",cat:"Spiaggia",s:"F",w:150,v:1}],
        spiaggia_sole:[{n:"Ombrellone/parasole",q:"f",cat:"Spiaggia",s:"U",w:1200,v:3},{n:"Crema SPF + protezione labbra",q:"f",cat:"Spiaggia",s:"U",w:180,v:1},{n:"Occhiali polarizzati",q:"f",cat:"Spiaggia",s:"U",w:80,v:1}],
        spiaggia_freddo:[{n:"Felpa antivento",q:"f",cat:"Spiaggia",s:"U",w:350,v:2},{n:"K-way leggero",q:"f",cat:"Spiaggia",s:"U",w:200,v:1},{n:"Coperta leggera",q:"f",cat:"Spiaggia",s:"U",w:300,v:2}],
        spiaggia_giornata:[{n:"Salviette umidificate",q:"f",cat:"Spiaggia",s:"U",w:60,v:1}],
        spiaggia_multiday:[{n:"Costume extra",q:"f",cat:"Spiaggia",s:"U",w:200,v:1,overnight:true}],
        lavoro_comuni:[{n:"Laptop + Caricatore",q:"f",cat:"Lavoro",s:"U",w:2200,v:2},{n:"Agenda/Penne",q:"f",cat:"Lavoro",s:"U",w:200,v:1},{n:"Mouse portatile",q:"f",cat:"Lavoro",s:"U",w:150,v:2},{n:"Adattatore HDMI",q:"f",cat:"Lavoro",s:"U",w:80,v:1},{n:"Sacco anti-piega",q:"f",cat:"Lavoro",s:"U",w:100,v:1},{n:"Camicia lavoro",q:"n",cat:"Lavoro",s:"M",w:250,v:1,overnight:true},{n:"Pantaloni lavoro",q:"n",cat:"Lavoro",s:"M",w:400,v:1,overnight:true}],
        lavoro_uomo:[{n:"Rasoio viaggio",q:"f",cat:"Lavoro",s:"M",w:80,v:1},{n:"Cintura extra",q:"f",cat:"Lavoro",s:"M",w:100,v:1}],
        lavoro_donna:[{n:"Kit make-up compatto",q:"f",cat:"Lavoro",s:"F",w:150,v:1},{n:"Calze di ricambio",q:"f",cat:"Lavoro",s:"F",w:40,v:1},{n:"Outfit lavoro",q:"n",cat:"Lavoro",s:"F",w:300,v:1,overnight:true}],
        lavoro_pioggia:[{n:"Copri-laptop impermeabile",q:"f",cat:"Lavoro",s:"U",w:80,v:1},{n:"Ombrello compatto",q:"f",cat:"Lavoro",s:"U",w:250,v:2}],
        lavoro_freddo:[{n:"Cappotto elegante",q:"f",cat:"Lavoro",s:"U",w:900,v:3,worn:true},{n:"Sciarpa ufficio",q:"f",cat:"Lavoro",s:"U",w:200,v:2}],
        lavoro_giornata:[{n:"Camicia pulita",q:"f",cat:"Lavoro",s:"U",w:250,v:1},{n:"Badge",q:"f",cat:"Lavoro",s:"U",w:10,v:1},{n:"Auricolari",q:"f",cat:"Lavoro",s:"U",w:50,v:1}],
        lavoro_multiday:[{n:"Abito/Camicia riserva",q:"f",cat:"Lavoro",s:"U",w:400,v:2,overnight:true},{n:"Sacco anti-piega riserva",q:"f",cat:"Lavoro",s:"U",w:100,v:1,overnight:true}],
        cena_comuni:[{n:"Abito/camicia elegante",q:"f",cat:"Cena Elegante",s:"U",w:500,v:2},{n:"Sacco anti-piega",q:"f",cat:"Cena Elegante",s:"U",w:100,v:1},{n:"Scarpe eleganti",q:"f",cat:"Cena Elegante",s:"U",w:700,v:3,worn:true},{n:"Accessori base",q:"f",cat:"Cena Elegante",s:"U",w:80,v:1}],
        cena_uomo:[{n:"Gemelli",q:"f",cat:"Cena Elegante",s:"M",w:30,v:1},{n:"Fazzoletto taschino",q:"f",cat:"Cena Elegante",s:"M",w:15,v:1}],
        cena_donna:[{n:"Gioielli",q:"f",cat:"Cena Elegante",s:"F",w:50,v:1},{n:"Tacchi",q:"f",cat:"Cena Elegante",s:"F",w:600,v:2},{n:"Prodotti make-up",q:"f",cat:"Cena Elegante",s:"F",w:150,v:1}],
        cena_pioggia:[{n:"Ombrello elegante",q:"f",cat:"Cena Elegante",s:"U",w:300,v:2},{n:"Copriscarpe",q:"f",cat:"Cena Elegante",s:"U",w:40,v:1}],
        cena_freddo:[{n:"Soprabito elegante",q:"f",cat:"Cena Elegante",s:"U",w:800,v:3,worn:true},{n:"Sciarpa elegante",q:"f",cat:"Cena Elegante",s:"U",w:180,v:2}],
        cena_giornata:[{n:"Prodotti anti-piega",q:"f",cat:"Cena Elegante",s:"U",w:60,v:1},{n:"Borsa piccola",q:"f",cat:"Cena Elegante",s:"U",w:200,v:1}],
        ciclismo_comuni:[{n:"Casco ciclismo",q:"f",cat:"Ciclismo",s:"U",w:300,v:3,worn:true},{n:"Luci bici",q:"f",cat:"Ciclismo",s:"U",w:120,v:1},{n:"Kit riparazione bici",q:"f",cat:"Ciclismo",s:"U",w:250,v:1},{n:"Borraccia bici",q:"f",cat:"Ciclismo",s:"U",w:250,v:2},{n:"Abbigliamento tecnico bici",q:"f",cat:"Ciclismo",s:"U",w:250,v:1,worn:true},{n:"Calze tecniche",q:"f",cat:"Ciclismo",s:"U",w:80,v:1},{n:"Kit pronto soccorso",q:"f",cat:"Ciclismo",s:"U",w:200,v:1}],
        ciclismo_uomo:[{n:"Pantaloncini tecnici",q:"f",cat:"Ciclismo",s:"M",w:200,v:1}],
        ciclismo_donna:[{n:"Fondello specifico",q:"f",cat:"Ciclismo",s:"F",w:120,v:1},{n:"Reggiseno sport",q:"f",cat:"Ciclismo",s:"F",w:80,v:1}],
        ciclismo_pioggia:[{n:"Giacca antipioggia",q:"f",cat:"Ciclismo",s:"U",w:400,v:2},{n:"Copriscarpe",q:"f",cat:"Ciclismo",s:"U",w:80,v:1},{n:"Sacchetti stagni",q:"f",cat:"Ciclismo",s:"U",w:30,v:1}],
        ciclismo_sole:[{n:"Visiera/occhiali ciclismo",q:"f",cat:"Ciclismo",s:"U",w:80,v:1},{n:"Crema SPF",q:"f",cat:"Ciclismo",s:"U",w:120,v:1}],
        ciclismo_freddo:[{n:"Strati termici",q:"f",cat:"Ciclismo",s:"U",w:300,v:2},{n:"Guanti isolanti",q:"f",cat:"Ciclismo",s:"U",w:100,v:1},{n:"Scaldacollo",q:"f",cat:"Ciclismo",s:"U",w:50,v:1}],
        ciclismo_giornata:[{n:"Guanti ciclismo",q:"f",cat:"Ciclismo",s:"U",w:60,v:1,worn:true},{n:"Snack",q:"f",cat:"Ciclismo",s:"U",w:150,v:1},{n:"Pompa portatile",q:"f",cat:"Ciclismo",s:"U",w:180,v:1}],
        sport_invernali_comuni:[{n:"Giacca e pantaloni neve",q:"f",cat:"Sport Invernali",s:"U",w:1500,v:3,worn:true},{n:"Maschera sci",q:"f",cat:"Sport Invernali",s:"U",w:150,v:2,worn:true},{n:"Guanti sci",q:"f",cat:"Sport Invernali",s:"U",w:200,v:2,worn:true},{n:"Calze termiche sci",q:"f",cat:"Sport Invernali",s:"U",w:120,v:1},{n:"Sacca attrezzatura",q:"f",cat:"Sport Invernali",s:"U",w:400,v:3},{n:"Kit pronto soccorso",q:"f",cat:"Sport Invernali",s:"U",w:200,v:1}],
        sport_invernali_uomo:[{n:"Paraschiena",q:"f",cat:"Sport Invernali",s:"M",w:300,v:2},{n:"Calzamaglia tecnica",q:"f",cat:"Sport Invernali",s:"M",w:200,v:1}],
        sport_invernali_donna:[{n:"Reggiseno termico",q:"f",cat:"Sport Invernali",s:"F",w:100,v:1},{n:"Scaldamani extra",q:"f",cat:"Sport Invernali",s:"F",w:50,v:1}],
        sport_invernali_sole:[{n:"SPF alto neve",q:"f",cat:"Sport Invernali",s:"U",w:150,v:1},{n:"Occhiali UV neve",q:"f",cat:"Sport Invernali",s:"U",w:80,v:1}],
        sport_invernali_freddo:[{n:"Strati isolanti",q:"f",cat:"Sport Invernali",s:"U",w:400,v:2},{n:"Scaldamani chimici",q:"f",cat:"Sport Invernali",s:"U",w:50,v:1},{n:"Cuffia termica",q:"f",cat:"Sport Invernali",s:"U",w:60,v:1}],
        sport_invernali_giornata:[{n:"Attrezzatura base sci",q:"f",cat:"Sport Invernali",s:"U",w:3000,v:3},{n:"Snack",q:"f",cat:"Sport Invernali",s:"U",w:150,v:1},{n:"Protezione labbra",q:"f",cat:"Sport Invernali",s:"U",w:30,v:1}],
        moto_adv_comuni:[{n:"Casco",q:"f",cat:"Moto Pro",s:"U",w:1500,v:3,worn:true},{n:"Giacca tecnica moto",q:"f",cat:"Moto Pro",s:"U",w:1200,v:3,worn:true},{n:"Guanti moto tecnici",q:"f",cat:"Moto Pro",s:"U",w:300,v:2,worn:true},{n:"Stivali moto",q:"f",cat:"Moto Pro",s:"U",w:1500,v:3,worn:true},{n:"Documenti moto",q:"f",cat:"Moto Pro",s:"U",w:50,v:1},{n:"Sacca casco",q:"f",cat:"Moto Pro",s:"U",w:200,v:2},{n:"Kit pronto soccorso",q:"f",cat:"Moto Pro",s:"U",w:200,v:1}],
        moto_adv_uomo:[{n:"Paraschiena moto",q:"f",cat:"Moto Pro",s:"M",w:300,v:2},{n:"Fodera termica",q:"f",cat:"Moto Pro",s:"M",w:400,v:2}],
        moto_adv_donna:[{n:"Sottocasco confortevole",q:"f",cat:"Moto Pro",s:"F",w:50,v:1},{n:"Protezioni sagomate",q:"f",cat:"Moto Pro",s:"F",w:200,v:1}],
        moto_adv_pioggia:[{n:"Copri-tuta impermeabile",q:"f",cat:"Moto Pro",s:"U",w:800,v:3},{n:"Sacchetti stagni",q:"f",cat:"Moto Pro",s:"U",w:40,v:1}],
        moto_adv_sole:[{n:"Visiera anti-riflesso",q:"f",cat:"Moto Pro",s:"U",w:80,v:1},{n:"Crema SPF",q:"f",cat:"Moto Pro",s:"U",w:120,v:1}],
        moto_adv_freddo:[{n:"Fodera termica giacca",q:"f",cat:"Moto Pro",s:"U",w:400,v:2},{n:"Scaldamani manubrio",q:"f",cat:"Moto Pro",s:"U",w:100,v:1}],
        moto_adv_giornata:[{n:"Kit riparazione moto",q:"f",cat:"Moto Pro",s:"U",w:300,v:2},{n:"Copri-tuta",q:"f",cat:"Moto Pro",s:"U",w:400,v:2},{n:"Attrezzi base",q:"f",cat:"Moto Pro",s:"U",w:500,v:2}],
        camping_comuni:[{n:"Tenda",q:"f",cat:"Camping",s:"U",w:2000,v:3},{n:"Sacco a pelo",q:"f",cat:"Camping",s:"U",w:1200,v:3},{n:"Materassino",q:"f",cat:"Camping",s:"U",w:500,v:3},{n:"Fornello",q:"f",cat:"Camping",s:"U",w:350,v:2},{n:"Acqua",q:"f",cat:"Camping",s:"U",w:1000,v:2},{n:"Torcia",q:"f",cat:"Camping",s:"U",w:100,v:1},{n:"Utensili base",q:"f",cat:"Camping",s:"U",w:200,v:1},{n:"Sacchetti rifiuti",q:"f",cat:"Camping",s:"U",w:20,v:1},{n:"Kit primo soccorso",q:"f",cat:"Camping",s:"U",w:250,v:1}],
        camping_uomo:[{n:"Coltello multiuso",q:"f",cat:"Camping",s:"M",w:120,v:1},{n:"Accendino impermeabile",q:"f",cat:"Camping",s:"M",w:25,v:1}],
        camping_donna:[{n:"Kit igiene discreto",q:"f",cat:"Camping",s:"F",w:80,v:1},{n:"Assorbenti",q:"f",cat:"Camping",s:"F",w:60,v:1}],
        camping_pioggia:[{n:"Telo extra",q:"f",cat:"Camping",s:"U",w:300,v:2},{n:"Sacchi impermeabili",q:"f",cat:"Camping",s:"U",w:80,v:1},{n:"Copertura tenda",q:"f",cat:"Camping",s:"U",w:250,v:2}],
        camping_sole:[{n:"Cappello",q:"f",cat:"Camping",s:"U",w:90,v:2},{n:"Filtro/depuratore acqua",q:"f",cat:"Camping",s:"U",w:150,v:1},{n:"SPF",q:"f",cat:"Camping",s:"U",w:150,v:1}],
        camping_freddo:[{n:"Sacco a pelo termico",q:"f",cat:"Camping",s:"U",w:1500,v:3},{n:"Strati isolanti",q:"f",cat:"Camping",s:"U",w:400,v:2},{n:"Stufa portatile",q:"f",cat:"Camping",s:"U",w:600,v:3}],
        camping_giornata:[{n:"Cibo pronto",q:"f",cat:"Camping",s:"U",w:400,v:2},{n:"Attrezzatura base",q:"f",cat:"Camping",s:"U",w:300,v:2}],
        foto_comuni:[{n:"Borsa imbottita camera",q:"f",cat:"Fotografia",s:"U",w:400,v:2},{n:"Batterie extra",q:"f",cat:"Fotografia",s:"U",w:100,v:1},{n:"Schede SD",q:"f",cat:"Fotografia",s:"U",w:20,v:1},{n:"Panno pulizia ottica",q:"f",cat:"Fotografia",s:"U",w:15,v:1},{n:"Treppiede compatto",q:"f",cat:"Fotografia",s:"U",w:800,v:3},{n:"Cavi dati",q:"f",cat:"Fotografia",s:"U",w:60,v:1}],
        foto_uomo:[{n:"Zaino foto accesso rapido",q:"f",cat:"Fotografia",s:"M",w:600,v:3}],
        foto_donna:[{n:"Zaino foto accesso rapido",q:"f",cat:"Fotografia",s:"F",w:600,v:3}],
        foto_pioggia:[{n:"Copertura anti-pioggia camera",q:"f",cat:"Fotografia",s:"U",w:120,v:1},{n:"Sacchetti stagni",q:"f",cat:"Fotografia",s:"U",w:30,v:1}],
        foto_sole:[{n:"Filtro ND/polarizzatore",q:"f",cat:"Fotografia",s:"U",w:50,v:1},{n:"Cappello",q:"f",cat:"Fotografia",s:"U",w:90,v:2}],
        foto_freddo:[{n:"Copertura isolante attrezzatura",q:"f",cat:"Fotografia",s:"U",w:80,v:1}],
        foto_giornata:[{n:"Obiettivo principale",q:"f",cat:"Fotografia",s:"U",w:500,v:2},{n:"Caricabatterie portatile",q:"f",cat:"Fotografia",s:"U",w:150,v:1},{n:"Pulitore lente",q:"f",cat:"Fotografia",s:"U",w:30,v:1}],
        fitness_comuni:[{n:"Scarpe running",q:"f",cat:"Fitness",s:"U",w:600,v:3,worn:true},{n:"Abbigliamento tecnico fitness",q:"f",cat:"Fitness",s:"U",w:200,v:1,worn:true},{n:"Borraccia",q:"f",cat:"Fitness",s:"U",w:250,v:2},{n:"Gel/integrazione",q:"f",cat:"Fitness",s:"U",w:80,v:1},{n:"Asciugamano",q:"f",cat:"Fitness",s:"U",w:150,v:1}],
        fitness_uomo:[{n:"Cintura porta-gel",q:"f",cat:"Fitness",s:"M",w:60,v:1},{n:"Calze tecniche running",q:"f",cat:"Fitness",s:"M",w:80,v:1}],
        fitness_donna:[{n:"Reggiseno sport",q:"f",cat:"Fitness",s:"F",w:80,v:1},{n:"Cerotti anti-sfregamento",q:"f",cat:"Fitness",s:"F",w:20,v:1}],
        fitness_pioggia:[{n:"Giacca leggera antipioggia",q:"f",cat:"Fitness",s:"U",w:300,v:2},{n:"Copriscarpe running",q:"f",cat:"Fitness",s:"U",w:60,v:1}],
        fitness_sole:[{n:"Visiera running",q:"f",cat:"Fitness",s:"U",w:60,v:1},{n:"SPF",q:"f",cat:"Fitness",s:"U",w:120,v:1}],
        fitness_freddo:[{n:"Strati termici running",q:"f",cat:"Fitness",s:"U",w:250,v:2},{n:"Guanti leggeri",q:"f",cat:"Fitness",s:"U",w:40,v:1}],
        fitness_giornata:[{n:"Cambio leggero",q:"f",cat:"Fitness",s:"U",w:200,v:1},{n:"Crema anti-sfregamento",q:"f",cat:"Fitness",s:"U",w:50,v:1}],
        bambini_comuni:[{n:"Pannolini",q:"f",cat:"Bambini",s:"U",w:50,v:2},{n:"Salviette umidificate",q:"f",cat:"Bambini",s:"U",w:150,v:2},{n:"Snack bimbo",q:"f",cat:"Bambini",s:"U",w:150,v:1},{n:"Biberon",q:"f",cat:"Bambini",s:"U",w:120,v:1},{n:"Medicine base bimbo",q:"f",cat:"Bambini",s:"U",w:100,v:1},{n:"Giochi",q:"f",cat:"Bambini",s:"U",w:200,v:2},{n:"Copertina",q:"f",cat:"Bambini",s:"U",w:250,v:2},{n:"Documenti bambino",q:"f",cat:"Bambini",s:"U",w:30,v:1}],
        bambini_pioggia:[{n:"Copertura passeggino",q:"f",cat:"Bambini",s:"U",w:200,v:2},{n:"Sacchetti impermeabili",q:"f",cat:"Bambini",s:"U",w:30,v:1}],
        bambini_sole:[{n:"Parasole",q:"f",cat:"Bambini",s:"U",w:150,v:2},{n:"SPF bimbi",q:"f",cat:"Bambini",s:"U",w:150,v:1},{n:"Cappellino bimbo",q:"f",cat:"Bambini",s:"U",w:60,v:1}],
        bambini_freddo:[{n:"Copertina termica",q:"f",cat:"Bambini",s:"U",w:300,v:2},{n:"Vestiti caldi extra",q:"n",cat:"Bambini",s:"U",w:250,v:1}],
        bambini_giornata:[{n:"Cambio completo bimbo",q:"f",cat:"Bambini",s:"U",w:300,v:2},{n:"Marsupio",q:"f",cat:"Bambini",s:"U",w:800,v:3,worn:true}],
        bambini_multiday:[{n:"Lettino da viaggio",q:"f",cat:"Bambini",s:"U",w:2000,v:3,overnight:true},{n:"Passeggino",q:"f",cat:"Bambini",s:"U",w:6000,v:3,overnight:true}],
        alpinismo_comuni:[{n:"Imbrago alpinismo",q:"f",cat:"Tecnico",s:"U",w:450,v:2},{n:"Casco alpinismo",q:"f",cat:"Tecnico",s:"U",w:350,v:3,worn:true},{n:"Moschettoni base (4x)",q:"f",cat:"Tecnico",s:"U",w:200,v:1},{n:"Cordino kevlar 120cm",q:"f",cat:"Tecnico",s:"U",w:80,v:1},{n:"Zaino tecnico (30-40L)",q:"f",cat:"Tecnico",s:"U",w:1000,v:3,worn:true},{n:"GPS/Bussola",q:"f",cat:"Tecnico",s:"U",w:150,v:1},{n:"Scarponi rigidi",q:"f",cat:"Tecnico",s:"U",w:1400,v:3,worn:true},{n:"Kit soccorso tecnico",q:"f",cat:"Tecnico",s:"U",w:250,v:1},{n:"Fischietto emergenza",q:"f",cat:"Tecnico",s:"U",w:15,v:1},{n:"Coperta isotermica",q:"f",cat:"Tecnico",s:"U",w:60,v:1}],
        alpinismo_uomo:[{n:"Guanti rinforzati",q:"f",cat:"Tecnico",s:"M",w:150,v:1}],
        alpinismo_donna:[{n:"Intimo termico su misura",q:"f",cat:"Tecnico",s:"F",w:120,v:1},{n:"Calze tecniche donna",q:"f",cat:"Tecnico",s:"F",w:100,v:1}],
        alpinismo_sole:[{n:"Occhiali ghiacciaio Cat.4",q:"f",cat:"Tecnico",s:"U",w:80,v:1},{n:"SPF 50+ labbra/viso",q:"f",cat:"Tecnico",s:"U",w:60,v:1}],
        alpinismo_pioggia:[{n:"Guscio Gore-Tex",q:"f",cat:"Tecnico",s:"U",w:500,v:2},{n:"Sacco stagno attrezzatura",q:"f",cat:"Tecnico",s:"U",w:100,v:1}],
        alpinismo_freddo:[{n:"Strati isolanti pesanti",q:"f",cat:"Tecnico",s:"U",w:450,v:2},{n:"Guanti tecnici quota",q:"f",cat:"Tecnico",s:"U",w:120,v:1},{n:"Scaldamani chimici",q:"f",cat:"Tecnico",s:"U",w:50,v:1},{n:"Passamontagna tecnico",q:"f",cat:"Tecnico",s:"U",w:60,v:1}],
        alpinismo_giornata:[{n:"Attrezzatura tecnica base",q:"f",cat:"Tecnico",s:"U",w:400,v:2},{n:"Snack alta quota",q:"f",cat:"Tecnico",s:"U",w:150,v:1},{n:"Acqua 1L",q:"f",cat:"Tecnico",s:"U",w:1000,v:2}],
        ferrata_comuni:[{n:"Set Ferrata (Y-longe)",q:"f",cat:"Tecnico",s:"U",w:550,v:2},{n:"Imbrago leggero",q:"f",cat:"Tecnico",s:"U",w:400,v:2},{n:"Casco ferrata",q:"f",cat:"Tecnico",s:"U",w:350,v:3,worn:true},{n:"Guanti da ferrata",q:"f",cat:"Tecnico",s:"U",w:100,v:1,worn:true},{n:"Moschettone ghiera extra",q:"f",cat:"Tecnico",s:"U",w:80,v:1},{n:"Zaino tecnico",q:"f",cat:"Tecnico",s:"U",w:800,v:3,worn:true},{n:"Scarpe ferrata",q:"f",cat:"Tecnico",s:"U",w:1100,v:3,worn:true},{n:"Kit soccorso ferrata",q:"f",cat:"Tecnico",s:"U",w:200,v:1},{n:"Fischietto emergenza",q:"f",cat:"Tecnico",s:"U",w:15,v:1}],
        ferrata_uomo:[{n:"Calzature rigide",q:"f",cat:"Tecnico",s:"M",w:1400,v:3,worn:true}],
        ferrata_donna:[{n:"Intimo termico su misura",q:"f",cat:"Tecnico",s:"F",w:120,v:1},{n:"Calze tecniche ferrata",q:"f",cat:"Tecnico",s:"F",w:100,v:1}],
        ferrata_sole:[{n:"Occhiali UV ferrata",q:"f",cat:"Tecnico",s:"U",w:80,v:1},{n:"SPF alto",q:"f",cat:"Tecnico",s:"U",w:150,v:1}],
        ferrata_pioggia:[{n:"Sacco impermeabile",q:"f",cat:"Tecnico",s:"U",w:100,v:1},{n:"Giacca gore-tex",q:"f",cat:"Tecnico",s:"U",w:500,v:2}],
        ferrata_freddo:[{n:"Strati isolanti",q:"f",cat:"Tecnico",s:"U",w:400,v:2},{n:"Guanti tecnici",q:"f",cat:"Tecnico",s:"U",w:120,v:1}],
        ferrata_giornata:[{n:"Attrezzatura tecnica base",q:"f",cat:"Tecnico",s:"U",w:400,v:2},{n:"Snack",q:"f",cat:"Tecnico",s:"U",w:150,v:1},{n:"Acqua",q:"f",cat:"Tecnico",s:"U",w:1000,v:2}]
    }
};

// ── UTILITIES ────────────────────────────────────────────────
const U = {
    uid: () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2,9)}`,
    weight: g => {
        const grams = (g && !isNaN(g) && g > 0) ? g : 0;
        return grams < 1000 ? `${grams} g` : `${Number((grams/1000).toFixed(1))} kg`;
    },
    esc: t => !t ? '' : String(t).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])),
    stripEmoji: s => s.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,''),
    clone: obj => typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)),
    _tid: null,
    
    // Gestione Statistiche Locali
    getStats() {
        try {
            const data = localStorage.getItem('packlist_stats');
            return data ? JSON.parse(data) : {};
        } catch { return {}; }
    },
    trackStats(name, weight) {
        const stats = this.getStats();
        const normalizedName = name.trim().toLowerCase();
        if (!stats[normalizedName]) {
            stats[normalizedName] = { name: name.trim(), count: 0, totalWeight: 0, lastAdded: null };
        }
        stats[normalizedName].count++;
        stats[normalizedName].totalWeight += (weight || 0);
        stats[normalizedName].lastAdded = new Date().toISOString();
        localStorage.setItem('packlist_stats', JSON.stringify(stats));
    },
    exportStats() {
        const stats = this.getStats();
        let csv = 'Data,Oggetto,Peso Stimato (g),Volte Aggiunto\n';
        for (const key in stats) {
            const item = stats[key];
            const date = item.lastAdded ? new Date(item.lastAdded).toLocaleString('it-IT') : '';
            csv += `"${date}","${item.name}",${item.totalWeight / item.count},${item.count}\n`;
        }
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `packlist_log_${new Date().toISOString().slice(0,10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    },
    showStatsModal() {
        const stats = this.getStats();
        const items = Object.values(stats).sort((a,b) => b.count - a.count);
        
        if (items.length === 0) {
            alert('Nessuna statistica disponibile. Aggiungi qualche oggetto personalizzato per iniziare!');
            return;
        }
        
        let html = '<div style="max-height:60vh;overflow-y:auto;text-align:left;">';
        html += '<h3>📊 Statistiche Oggetti Personalizzati</h3>';
        html += '<table style="width:100%;border-collapse:collapse;"><tr><th style="border-bottom:2px solid #ccc;padding:8px;">Oggetto</th><th style="border-bottom:2px solid #ccc;padding:8px;text-align:center;">Volte</th><th style="border-bottom:2px solid #ccc;padding:8px;text-align:right;">Peso Medio</th></tr>';
        
        items.forEach(item => {
            const avgWeight = Math.round(item.totalWeight / item.count);
            html += `<tr><td style="padding:8px;border-bottom:1px solid #eee;">${U.esc(item.name)}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.count}</td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">${avgWeight}g</td></tr>`;
        });
        
        html += '</table><br>';
        html += '<button onclick="U.exportStats()" style="background:#4CAF50;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;">📥 Scarica Report CSV</button>';
        html += '<button onclick="document.querySelector(\'.stats-modal\').remove()" style="background:#f44336;color:white;border:none;padding:10px 20px;border-radius:5px;cursor:pointer;margin-left:10px;">Chiudi</button>';
        html += '</div>';
        
        const modal = document.createElement('div');
        modal.className = 'stats-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:10000;';
        modal.innerHTML = `<div style="background:white;padding:20px;border-radius:10px;max-width:600px;width:90%;box-shadow:0 4px 20px rgba(0,0,0,0.3);">${html}</div>`;
        document.body.appendChild(modal);
    },
    
    toast(msg, type = 'success', undoCb = null) {
        clearTimeout(this._tid);
        document.querySelectorAll('.toast').forEach(t => t.remove());
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        if (undoCb) el.onclick = () => { undoCb(); el.remove(); };
        document.body.appendChild(el);
        this._tid = setTimeout(() => {
            el.style.opacity = '0';
            el.style.transform = 'translateX(-50%) translateY(10px)';
            el.style.transition = '.3s';
            setTimeout(() => el.remove(), 300);
        }, undoCb ? 4500 : 2600);
    }
};

// ── STORAGE ──────────────────────────────────────────────────
const Storage = {
    KEY: 'packlist_v10014',
    TPL_KEY: 'packlist_tpl_v10014',
    VERSION: 1,
    _t: null,
    queueSave() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 280); },
    save() {
        try {
            localStorage.setItem(this.KEY, JSON.stringify({ v: this.VERSION, list: STATE.list, config: STATE.config }));
        } catch(e) {
            if (e.name === 'QuotaExceededError') U.toast('⚠️ Memoria piena!', 'error');
        }
    },
    load() { try { const r = localStorage.getItem(this.KEY); return r ? JSON.parse(r) : null; } catch { return null; } },
    getTpl() { try { return JSON.parse(localStorage.getItem(this.TPL_KEY) || '{}'); } catch { return {}; } },
    setTpl(obj) { try { localStorage.setItem(this.TPL_KEY, JSON.stringify(obj)); } catch(e) { U.toast('⚠️ Impossibile salvare template.', 'error'); } }
};

// ── VIEW ─────────────────────────────────────────────────────
const View = {
    list() {
        const res = document.getElementById('results');
        if (!Object.keys(STATE.list).length) {
            res.innerHTML = `<div class="empty-state"><div class="es-icon">🎒</div><p>Configura il viaggio e clicca "Genera Packlist"!</p></div>`;
            return;
        }
        const frag = document.createDocumentFragment();
        const filter = STATE.filter;
        for (const cat in STATE.list) {
            const items = STATE.list[cat];
            if (!items?.length) continue;
            if (filter !== 'all') {
                const allowedCats = FILTER_MAP[filter] || [];
                if (!allowedCats.includes(cat)) continue;
            }
            const sorted = [...items].sort((a,b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
            const doneCount = sorted.filter(i => i.checked).length;
            const box = document.createElement('div');
            box.className = 'cat-box';
            box.dataset.cat = cat;
            box.innerHTML = `<div class="cat-header"><span class="cat-name">${U.esc(cat)}</span><span class="cat-count">${doneCount}/${items.length}</span></div>`;
            sorted.forEach(item => {
                const row = document.createElement('div');
                row.className = `item-row ${item.checked ? 'taken' : 'pending'}`;
                row.dataset.uid = item.uid;
                row.dataset.cat = cat;
                row.setAttribute('role', 'checkbox');
                row.setAttribute('aria-checked', item.checked);
                row.setAttribute('tabindex', '0');
                const bulkBadge = item.v >= 3 ? `<span class="badge" title="Ingombrante">📦</span>` : '';
                const wornBadge = item.worn ? `<span class="badge" title="Da indossare in viaggio">🧥</span>` : '';
                const protectedBadge = item.custom ? `<span class="badge" title="Item personale">⭐</span>` : '';
                const wDisplay = U.weight((item.w || 100) * item.q);
                row.innerHTML = `
                    <div class="item-content">
                        <span class="qty">${item.q}x</span>
                        <span class="item-text">${U.esc(item.n)}${bulkBadge}${wornBadge}${protectedBadge}</span>
                        <span class="item-weight">${wDisplay}</span>
                    </div>
                    <div class="item-actions">
                        <button class="ia-btn worn" data-action="worn" data-cat="${U.esc(cat)}" data-uid="${item.uid}" title="Toggle indossato">${item.worn ? '🧥' : '🎒'}</button>
                        <button class="ia-btn edit" data-action="edit" data-cat="${U.esc(cat)}" data-uid="${item.uid}" title="Modifica peso">⚖️</button>
                        <button class="ia-btn del" data-action="del" data-cat="${U.esc(cat)}" data-uid="${item.uid}" title="Rimuovi">❌</button>
                    </div>`;
                box.appendChild(row);
            });
            const inputId = `add-${cat.replace(/\W/g,'')}`;
            const addRow = document.createElement('div');
            addRow.className = 'add-custom';
            addRow.innerHTML = `<input type="text" id="${inputId}" placeholder="+ Aggiungi item..." autocomplete="off"><button class="btn-sm" data-action="add" data-cat="${U.esc(cat)}" data-input="${inputId}">+ Add</button>`;
            box.appendChild(addRow);
            frag.appendChild(box);
        }
        if (frag.children.length === 0) {
            res.innerHTML = `<div class="empty-state"><div class="es-icon">🔍</div><p>Nessun item in questa categoria.</p></div>`;
        } else {
            res.innerHTML = '';
            res.appendChild(frag);
        }
    },
    stats() {
        const bar = document.getElementById('statsBar');
        const all = Object.values(STATE.list).flat();
        if (!all.length) { bar.classList.remove('visible'); return; }
        bar.classList.add('visible');
        const done = all.filter(i => i.checked).length, total = all.length;
        const pct = total ? Math.round(done / total * 100) : 0;
        document.getElementById('progressFill').style.width = `${pct}%`;
        const pctEl = document.getElementById('progressPct');
        pctEl.textContent = `${pct}%`;
        pctEl.className = 'pct-display' + (pct === 0 ? ' zero' : pct === 100 ? ' done' : ' mid');
        document.getElementById('itemsCount').textContent = `${done}/${total}`;
        const totalG = all.reduce((s,i) => s + (i.w||100) * i.q, 0);
        const wornG = all.filter(i => i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);
        const suitcaseG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + (i.w||100) * i.q, 0);
        const wClass = suitcaseG === 0 ? 'neutral' : (suitcaseG >= 10000 ? 'heavy' : suitcaseG >= 5000 ? 'mid' : 'light');
        const sEl = document.getElementById('weightSuitcase');
        sEl.textContent = U.weight(suitcaseG);
        sEl.className = `chip-val ${wClass}`;
        document.getElementById('weightTotal').textContent = U.weight(totalG);
        const wornChip = document.getElementById('wornChip');
        if (wornG > 0) { wornChip.style.display = 'flex'; document.getElementById('wornWeight').textContent = U.weight(wornG); }
        else { wornChip.style.display = 'none'; }
        const fillEl = document.getElementById('weightFill');
        fillEl.style.width = `${Math.min(suitcaseG / 25000 * 100, 100)}%`;
        fillEl.className = `weight-fill ${wClass}`;
        const wt = document.querySelector('.weight-track');
        if(wt) wt.style.display = done > 0 ? 'block' : 'none';
    }
};

// ── CONTROLLER ───────────────────────────────────────────────
const Ctrl = {
    rerender() { View.list(); View.stats(); Storage.queueSave(); },

    syncConfig() {
        STATE.config.nights = parseInt(document.getElementById('nights').value) || 0;
        STATE.config.gender = document.getElementById('gender').value;
        STATE.config.transport = document.getElementById('transport').value;
        STATE.config.laundryFreq = Math.max(1, parseInt(document.getElementById('laundryFreq').value) || 3);
        STATE.config.laundryBuffer = Math.max(0, parseInt(document.getElementById('laundryBuffer').value) || 1);
        STATE.config.activities = [...document.querySelectorAll('.act-btn.active')].map(el => el.id.replace('act-',''));
        const isDaytrip = STATE.config.nights === 0;
        document.getElementById('daytripBanner').classList.toggle('visible', isDaytrip);
        this._updateLaundryInfo();
        Storage.queueSave();
    },

    _updateLaundryInfo() {
        const info = document.getElementById('laundryInfo');
        if (!STATE.config.laundry || STATE.config.nights === 0) { info.classList.remove('visible'); return; }
        const n = STATE.config.nights, freq = STATE.config.laundryFreq, buf = STATE.config.laundryBuffer;
        const nCalc = Math.min(n, freq) + buf;
        info.textContent = `🧺 Porti ${nCalc} cambi — coprono ${Math.min(n, freq)} gg + ${buf} riserva (lavi e riusi)`;
        info.classList.add('visible');
    },

    toggleWeather(type) {
        const btn = document.getElementById(`w-${type}`);
        const idx = STATE.config.weather.indexOf(type);
        if (idx > -1) { STATE.config.weather.splice(idx,1); btn.classList.remove('active'); btn.setAttribute('aria-pressed','false'); }
        else { STATE.config.weather.push(type); btn.classList.add('active'); btn.setAttribute('aria-pressed','true'); }
        Storage.queueSave();
    },

    toggleLaundry() {
        STATE.config.laundry = !STATE.config.laundry;
        document.getElementById('laundryToggle').classList.toggle('active', STATE.config.laundry);
        document.getElementById('laundryToggle').setAttribute('aria-pressed', STATE.config.laundry);
        document.getElementById('laundryFreqBox').classList.toggle('visible', STATE.config.laundry);
        this._updateLaundryInfo();
        Storage.queueSave();
    },

    toggleItem(cat, uid) { const item = STATE.list[cat]?.find(i => i.uid === uid); if (!item) return; item.checked = !item.checked; this.rerender(); },
    toggleWorn(cat, uid) { const item = STATE.list[cat]?.find(i => i.uid === uid); if (!item) return; item.worn = !item.worn; this.rerender(); },

    editWeight(cat, uid) {
        const item = STATE.list[cat]?.find(i => i.uid === uid);
        if (!item) return;
        const val = prompt(`Peso attuale di "${item.n}": ${U.weight(item.w)}\n\nNuovo peso in grammi:`, item.w);
        if (val === null) return;
        const num = parseInt(val);
        if (isNaN(num) || num <= 0) return U.toast('❌ Peso non valido!', 'error');
        const old = item.w;
        item.w = num;
        this.rerender();
        U.toast(`⚖️ Peso: ${U.weight(old)} → ${U.weight(num)}`);
    },

    removeItem(cat, uid) {
        if (!STATE.list[cat]) return;
        const item = STATE.list[cat].find(i => i.uid === uid);
        if (!item) return;
        if (item.custom && !confirm(`Rimuovere "${item.n}"?`)) return;
        STATE.list[cat] = STATE.list[cat].filter(i => i.uid !== uid);
        if (!STATE.list[cat].length) delete STATE.list[cat];
        this.rerender();
        U.toast('🗑️ Item rimosso');
    },

    addCustom(cat, inputId) {
        const input = document.getElementById(inputId);
        const rawName = input?.value.trim();
        if (!rawName) return;
        
        // Chiedi il peso stimato
        const weightStr = prompt(`Inserisci il peso stimato di "${rawName}" in grammi (es. 150):`, "100");
        if (weightStr === null) return; // Annullato
        const weight = parseInt(weightStr) || 100;
        
        if (!STATE.list[cat]) STATE.list[cat] = [];
        
        const newItem = { n: rawName, q: 1, checked: false, uid: U.uid(), w: weight, v: 1, worn: false, custom: true };
        STATE.list[cat].push(newItem);
        
        // Registra statistica
        U.trackStats(rawName, weight);
        
        input.value = '';
        this.rerender();
        U.toast('⭐ Item aggiunto!');
        setTimeout(() => input?.focus(), 40);
    },

    uncheckAll() {
        let count = 0;
        for (const c in STATE.list) {
            if (!STATE.list[c]) continue;
            STATE.list[c].forEach(i => { if (i.checked) { i.checked = false; count++; } });
        }
        if (count === 0) return U.toast('Nessuna spunta da azzerare ℹ️', 'warning');
        this.rerender();
        U.toast(`🧹 ${count} spunte azzerate! Lista intatta.`);
    },

    clearSearch() {
        const input = document.getElementById('searchItems');
        input.value = '';
        document.getElementById('searchClear').classList.remove('visible');
        this.filterList();
        input.focus();
    },

    resetSession() {
        if (!confirm('♻️ RESET SESSIONE\n\nVerranno azzerati lista, configurazioni, meteo e attività.\nI template salvati rimarranno intatti.\n\nContinuare?')) return;
        STATE.list = {};
        STATE.config = { ...DEFAULT_CONFIG };
        STATE.filter = 'all';
        STATE.currentTemplateName = '';
        document.getElementById('nights').value = DEFAULT_CONFIG.nights;
        document.getElementById('gender').value = DEFAULT_CONFIG.gender;
        document.getElementById('transport').value = DEFAULT_CONFIG.transport;
        document.getElementById('laundryFreq').value = DEFAULT_CONFIG.laundryFreq;
        document.getElementById('laundryBuffer').value = DEFAULT_CONFIG.laundryBuffer;
        document.getElementById('searchItems').value = '';
        document.getElementById('searchClear').classList.remove('visible');
        document.getElementById('templateSelect').value = '';
        STATE.config.weather = [];
        document.querySelectorAll('.weather-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        STATE.config.activities = [];
        document.querySelectorAll('.act-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        STATE.config.laundry = false;
        document.getElementById('laundryToggle').classList.remove('active');
        document.getElementById('laundryToggle').setAttribute('aria-pressed','false');
        document.getElementById('laundryFreqBox').classList.remove('visible');
        document.getElementById('laundryInfo').classList.remove('visible');
        document.getElementById('daytripBanner').classList.remove('visible');
        document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
        document.getElementById('filter-all').classList.add('active-filter');
        localStorage.removeItem(Storage.KEY);
        this.rerender();
        U.toast('♻️ Sessione completamente resettata!');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    restoreConfig(cfg) {
        if (cfg.nights != null) document.getElementById('nights').value = cfg.nights;
        if (cfg.gender) document.getElementById('gender').value = cfg.gender;
        if (cfg.transport) document.getElementById('transport').value = cfg.transport;
        if (cfg.laundryFreq != null) document.getElementById('laundryFreq').value = cfg.laundryFreq;
        if (cfg.laundryBuffer != null) document.getElementById('laundryBuffer').value = cfg.laundryBuffer;
        document.getElementById('laundryToggle').classList.toggle('active', !!cfg.laundry);
        document.getElementById('laundryFreqBox').classList.toggle('visible', !!cfg.laundry);
        document.getElementById('daytripBanner').classList.toggle('visible', cfg.nights === 0);
        document.querySelectorAll('.weather-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
        (cfg.weather || []).forEach(w => { const b = document.getElementById(`w-${w}`); if(b) { b.classList.add('active'); b.setAttribute('aria-pressed','true'); } });
        document.querySelectorAll('.act-btn').forEach(b => b.classList.remove('active'));
        (cfg.activities || []).forEach(id => { const b = document.getElementById(`act-${id}`); if(b) b.classList.add('active'); });
        this._updateLaundryInfo();
    },

    saveTemplate() {
        const name = document.getElementById('templateName').value.trim();
        if (!name) return U.toast('Inserisci un nome ⚠️', 'error');
        const tpl = Storage.getTpl();
        tpl[name] = { config: U.clone(STATE.config), list: U.clone(STATE.list) };
        Storage.setTpl(tpl);
        this.loadTemplateDropdown();
        U.toast(`💾 "${name}" salvato!`);
        document.getElementById('templateName').value = '';
    },

    loadTemplate(name) {
        const tpl = Storage.getTpl()[name];
        if (!tpl) return;
        if (!confirm(`📂 Caricare "${name}"?`)) { document.getElementById('templateSelect').value = ''; return; }
        STATE.list = U.clone(tpl.list || {});
        STATE.config = U.clone(tpl.config || { ...DEFAULT_CONFIG });
        Object.values(STATE.list).flat().forEach(i => i.checked = false);
        this.restoreConfig(STATE.config);
        this.rerender();
        STATE.currentTemplateName = name;
        U.toast(`📂 "${name}" caricato!`);
        document.getElementById('templateSelect').value = '';
    },

    deleteTemplate() {
        const name = document.getElementById('templateSelect').value;
        if (!name) return U.toast('Seleziona un template', 'error');
        if (!confirm(`Eliminare "${name}"?`)) return;
        if (name === STATE.currentTemplateName) STATE.currentTemplateName = '';
        const tpl = Storage.getTpl();
        delete tpl[name];
        Storage.setTpl(tpl);
        this.loadTemplateDropdown();
        U.toast(`🗑️ "${name}" eliminato`);
    },

    loadTemplateDropdown() {
        const sel = document.getElementById('templateSelect');
        sel.innerHTML = '<option value="">📂 Carica template...</option>';
        Object.keys(Storage.getTpl()).forEach(name => {
            const opt = document.createElement('option');
            opt.value = name; opt.textContent = name;
            sel.appendChild(opt);
        });
    },

    filterList() {
        clearTimeout(this._searchT);
        this._searchT = setTimeout(() => {
            const term = document.getElementById('searchItems').value.toLowerCase();
            document.getElementById('searchClear').classList.toggle('visible', term.length > 0);
            document.querySelectorAll('.item-row').forEach(row => {
                row.style.display = (row.querySelector('.item-text')?.textContent.toLowerCase() || '').includes(term) ? 'flex' : 'none';
            });
            document.querySelectorAll('.cat-box').forEach(box => {
                box.style.display = [...box.querySelectorAll('.item-row')].some(r => r.style.display !== 'none') ? 'block' : 'none';
            });
        }, 180);
    },

    copyList() {
        let text = `🎒 PACKLIST${STATE.config.laundry ? ' 🧺' : ''}\n${'═'.repeat(42)}\n\n`;
        let suitcaseG = 0;
        for (const c in STATE.list) {
            if (!STATE.list[c].length) continue;
            text += `📦 ${c.toUpperCase()}\n`;
            [...STATE.list[c]].sort((a,b) => a.checked - b.checked).forEach(i => {
                text += `  ${i.checked ? '✅' : '⬜'} ${i.q}x ${i.n}${i.worn ? ' 🧥' : ''} (${U.weight((i.w||100)*i.q)})\n`;
                if (i.checked && !i.worn) suitcaseG += (i.w||100) * i.q;
            });
            text += '\n';
        }
        const all = Object.values(STATE.list).flat(), done = all.filter(i => i.checked).length;
        text += `📊 ${done}/${all.length} item (${all.length ? Math.round(done/all.length*100) : 0}%)\n⚖️ In valigia: ${U.weight(suitcaseG)}\n\nPacklist Pro v1.00.14 ✨`;
        navigator.clipboard.writeText(text)
            .then(() => U.toast('📋 Lista copiata!'))
            .catch(() => {
                const ta = document.createElement('textarea');
                ta.value = text;
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
                U.toast('📋 Lista copiata!');
            });
    },

    exportPDF() {
        if (typeof window.jspdf === 'undefined') return U.toast('PDF non disponibile ❌', 'error');
        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const tplName = document.getElementById('templateName').value.trim() || STATE.currentTemplateName || 'Packlist Pro';
            doc.setFontSize(13); doc.setTextColor(11,15,26);
            doc.text(tplName, 10, 14);
            doc.setFontSize(8); doc.setTextColor(100,116,139);
            doc.text(U.stripEmoji(`Notti: ${STATE.config.nights} · Mezzo: ${STATE.config.transport}${STATE.config.laundry ? ' · Lavanderia' : ''}`), 10, 21);
            doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, 10, 27);
            let y = 33;
            for (const cat in STATE.list) {
                if (!STATE.list[cat].length) continue;
                doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(90, 103, 242);
                doc.text(U.stripEmoji(cat.toUpperCase()), 10, y); y += 5;
                const rows = STATE.list[cat].map(i => [`${i.q}x`, U.stripEmoji(i.n) + (i.worn ? ' [ind.]' : ''), U.weight((i.w && !isNaN(i.w) ? i.w : 100) * i.q), i.checked ? '[x]' : '[ ]']);
                doc.autoTable({
                    startY: y, head: [['Qt.', 'Articolo', 'Peso', '']], body: rows, theme: 'grid',
                    headStyles: { fillColor: [90,103,242], textColor: 255, fontStyle: 'bold', fontSize: 7, halign: 'left', cellPadding: 2 },
                    styles: { fontSize: 7, cellPadding: 1.5, halign: 'left' },
                    columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { cellWidth: 24, halign: 'right' }, 3: { cellWidth: 10, halign: 'center' } },
                    margin: { left: 10, right: 10 }
                });
                y = doc.lastAutoTable.finalY + 4;
                if (y > 270) { doc.addPage(); y = 14; }
            }
            const all = Object.values(STATE.list).flat(), done = all.filter(i => i.checked).length;
            const bagG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + ((i.w && !isNaN(i.w) ? i.w : 100) * i.q), 0);
            doc.setFontSize(8); doc.setTextColor(71,85,105);
            doc.text(`Progresso: ${done}/${all.length} · In valigia: ${U.weight(bagG)}`, 10, y + 4);
            doc.setFontSize(7);
            doc.text('Packlist Pro v1.00.14', 10, y + 10);
            doc.save(`Packlist_${new Date().toLocaleDateString('it-IT').replace(/\//g,'-')}.pdf`);
            U.toast('📄 PDF esportato!');
        } catch(e) {
            console.error(e);
            U.toast(`❌ Errore PDF: ${e.message}`, 'error');
        }
    },

    generate() {
        try {
            if (Object.values(STATE.list).flat().some(i => i.checked) && !confirm('⚠️ Rigenerare sovrascriverà la lista. Continuare?')) return;
            this.syncConfig();
            const { nights, gender, transport, laundry, laundryFreq, laundryBuffer, weather, activities } = STATE.config;
            const isDaytrip = nights === 0;

            let nCalc;
            if (isDaytrip) { nCalc = 1; }
            else if (laundry) { nCalc = Math.min(nights, laundryFreq) + laundryBuffer; }
            else { nCalc = nights <= 2 ? nights : nights + 1; }
            nCalc = Math.max(1, nCalc);

            // Preserve custom items
            const custom = {};
            for (const cat in STATE.list) {
                STATE.list[cat].forEach(i => {
                    if (i.custom) { if (!custom[cat]) custom[cat]=[]; custom[cat].push(i); }
                });
            }
            STATE.list = {};

            const addItems = (arr, mult) => {
                if (!arr) return;
                arr.forEach(i => {
                    if (!i.n || !i.cat) return;
                    if (isDaytrip && i.overnight) return;
                    if (i.s !== 'U' && i.s !== gender) return;
                    if (!STATE.list[i.cat]) STATE.list[i.cat] = [];
                    STATE.list[i.cat].push({ n: i.n, cat: i.cat, q: i.q === 'n' ? mult : 1, checked: false, uid: U.uid(), w: i.w || 100, v: i.v || 1, worn: !!i.worn, custom: false });
                });
            };

            addItems(DB.base, nCalc);
            addItems(DB.documents, 1);
            addItems(DB.comfort, 1);
            if (laundry && !isDaytrip) addItems(DB.laundry, 1);

            const weatherCovered = new Set();
            weather.forEach(w => {
                addItems(DB.weather[w], 1);
                DB.weather[w]?.forEach(i => weatherCovered.add(normalizeName(i.n)));
            });

            addItems(DB.transport[transport], 1);

            const HEAVY_ACTIVITIES = ['trekking','alpinismo','ferrata','moto_adv','sport_invernali'];
            const heavyCount = activities.filter(a => HEAVY_ACTIVITIES.includes(a)).length;
            if (heavyCount > 1) {
                setTimeout(() => U.toast('⚠️ Più attività tecniche selezionate: verifica duplicati gear nella lista', 'warning'), 800);
            }

            activities.forEach(id => {
                const basePrefixes = ['comuni'];
                basePrefixes.push(isDaytrip ? 'giornata' : (nights >= 2 ? 'multiday' : 'giornata'));
                if (gender === 'F') basePrefixes.push('donna');
                if (gender === 'M') basePrefixes.push('uomo');

                const weatherPrefixes = [];
                weather.forEach(w => {
                    if (w==='rain') weatherPrefixes.push('pioggia');
                    if (w==='sun') weatherPrefixes.push('sole');
                    if (w==='cold') weatherPrefixes.push('freddo');
                });

                basePrefixes.forEach(p => {
                    const key = `${id}_${p}`;
                    if (DB.extra[key]) addItems(DB.extra[key], nCalc);
                });

                weatherPrefixes.forEach(p => {
                    const key = `${id}_${p}`;
                    if (DB.extra[key]) {
                        const filtered = DB.extra[key].filter(i => !weatherCovered.has(normalizeName(i.n)));
                        addItems(filtered, nCalc);
                    }
                });
            });

            // Deduplicator: Math.max for max quantity across contexts
            const seenByName = new Map();
            for (const cat in STATE.list) {
                for (const item of STATE.list[cat]) {
                    const nameKey = normalizeName(item.n);
                    if (seenByName.has(nameKey)) {
                        const existing = seenByName.get(nameKey);
                        existing.q = Math.max(existing.q, item.q);
                    } else {
                        seenByName.set(nameKey, { ...item, cat });
                    }
                }
            }

            const deduped = {};
            seenByName.forEach(item => {
                if (!deduped[item.cat]) deduped[item.cat] = [];
                deduped[item.cat].push(item);
            });
            STATE.list = deduped;

            for (const cat in custom) {
                if (!STATE.list[cat]) STATE.list[cat] = [];
                STATE.list[cat].push(...custom[cat]);
            }
            Object.keys(STATE.list).forEach(cat => { if (!STATE.list[cat]?.length) delete STATE.list[cat]; });

            if (!Object.keys(STATE.list).length) return U.toast("Nessun item! Seleziona un'attività ⚠️", 'error');
            WARNINGS.filter(w => w.check(STATE)).forEach((w, i) => setTimeout(() => U.toast(w.msg, 'warning'), i * 600));

            document.getElementById('searchItems').value = '';
            document.getElementById('searchClear').classList.remove('visible');
            this.rerender();
            const totalItems = Object.values(STATE.list).flat().length;
            U.toast(`✅ ${totalItems} item · ${isDaytrip ? 'giornata' : laundry ? nCalc + ' cambi (lavanderia)' : nCalc + ' notti'}`);
            setTimeout(() => document.getElementById('statsBar').scrollIntoView({ behavior: 'smooth' }), 150);
        } catch(e) {
            console.error(e);
            U.toast(`❌ Errore generazione: ${e.message}`, 'error');
        }
    },

    _fabLock: false,
    toggleMenu() {
        if (this._fabLock) return;
        this._fabLock = true;
        setTimeout(() => this._fabLock = false, 300);
        const menu = document.getElementById('fabMenu');
        const btn = document.getElementById('fabMain');
        const isOpen = menu.classList.toggle('open');
        btn.classList.toggle('open', isOpen);
        btn.setAttribute('aria-expanded', isOpen);
    },

    setFilter(filterType) {
        STATE.filter = filterType;
        document.querySelectorAll('.fab-item').forEach(btn => btn.classList.remove('active-filter'));
        const activeBtn = document.getElementById(`filter-${filterType}`);
        if(activeBtn) activeBtn.classList.add('active-filter');
        if(window.innerWidth < 768) this.toggleMenu();
        this.rerender();
    }
};

// ── PWA APP MANAGER ──────────────────────────────────────────
const App = {
    _deferredPrompt: null,

    init() {
        // Offline indicator
        const updateOnlineStatus = () => {
            document.getElementById('offlineBar').classList.toggle('visible', !navigator.onLine);
        };
        window.addEventListener('online', updateOnlineStatus);
        window.addEventListener('offline', updateOnlineStatus);
        updateOnlineStatus();

        // Install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this._deferredPrompt = e;
            if (!localStorage.getItem('pwa_install_dismissed')) {
                document.getElementById('installBanner').classList.add('visible');
            }
        });

        window.addEventListener('appinstalled', () => {
            document.getElementById('installBanner').classList.remove('visible');
            this._deferredPrompt = null;
            U.toast('✅ Packlist Pro installata!');
        });
    },

    async install() {
        if (!this._deferredPrompt) return;
        this._deferredPrompt.prompt();
        const { outcome } = await this._deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('installBanner').classList.remove('visible');
        }
        this._deferredPrompt = null;
    },

    dismissInstall() {
        document.getElementById('installBanner').classList.remove('visible');
        localStorage.setItem('pwa_install_dismissed', '1');
    }
};

// ── EVENT LISTENERS ──────────────────────────────────────────
document.getElementById('results').addEventListener('click', e => {
    const btn = e.target.closest('[data-action]');
    if (btn) {
        e.stopPropagation();
        const { action, cat, uid, input: inputId } = btn.dataset;
        if (action === 'worn') Ctrl.toggleWorn(cat, uid);
        else if (action === 'edit') Ctrl.editWeight(cat, uid);
        else if (action === 'del') Ctrl.removeItem(cat, uid);
        else if (action === 'add') Ctrl.addCustom(cat, inputId);
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
    if (e.key === 'Escape') {
        const menu = document.getElementById('fabMenu');
        if (menu.classList.contains('open')) Ctrl.toggleMenu();
    }
    // Keyboard shortcut: Ctrl+G = Generate
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        Ctrl.generate();
    }
});

// Close FAB on outside click/tap
const closeFabOutside = (e) => {
    const container = document.querySelector('.fab-container');
    const menu = document.getElementById('fabMenu');
    if (!menu.classList.contains('open')) return;
    if (container.contains(e.target)) return;
    Ctrl.toggleMenu();
};
document.addEventListener('click', closeFabOutside);
document.addEventListener('touchstart', closeFabOutside, { passive: true });
window.addEventListener('scroll', () => {
    if (document.getElementById('fabMenu').classList.contains('open')) Ctrl.toggleMenu();
}, { passive: true });

// ── SERVICE WORKER ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            console.log('[App] SW registered:', reg.scope);
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) reg.update();
            });
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing;
                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        U.toast('🔄 Nuova versione disponibile! Tocca per aggiornare.', 'warning', () => {
                            newWorker.postMessage({ action: 'skipWaiting' });
                            window.location.reload();
                        });
                    }
                });
            });
        }).catch(err => console.warn('[App] SW registration failed:', err));

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    });
}

// ── INIT ─────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    // Build activity grid
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

    // Activity clicks
    grid.addEventListener('click', e => {
        const btn = e.target.closest('.act-btn');
        if (!btn) return;
        btn.classList.toggle('active');
        btn.setAttribute('aria-pressed', btn.classList.contains('active'));
        Ctrl.syncConfig();
    });

    // Activity keyboard
    grid.addEventListener('keydown', e => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('act-btn')) {
            e.preventDefault();
            e.target.click();
        }
    });

    // Restore saved state
    const data = Storage.load();
    if (data) {
        STATE.list = data.list || {};
        STATE.config = data.config || { ...DEFAULT_CONFIG };
        Ctrl.restoreConfig(STATE.config);
        if (Object.keys(STATE.list).length) Ctrl.rerender();
    }

    Ctrl.loadTemplateDropdown();
    App.init();

    // Handle ?action=new shortcut (PWA shortcut)
    if (new URLSearchParams(location.search).get('action') === 'new') {
        Ctrl.resetSession();
        history.replaceState(null, '', './');
    }
});
