import assert from 'node:assert/strict';
import {
    calculateItemQuantity,
    generatePacklist,
    isTransportCompatible,
    isWeatherCompatible,
    normalizeTransportMode
} from '../js/modules/packlist-generator.js';

const config = {
    nights: 4,
    gender: 'F',
    transports: ['car'],
    weather: ['rain'],
    activities: ['hiking'],
    laundry: false,
    laundryFreq: 3,
    laundryBuffer: 1
};

assert.equal(normalizeTransportMode('auto'), 'car');
assert.equal(normalizeTransportMode('backpack'), 'walking');
assert.equal(isTransportCompatible({ transportModes: ['car'] }, ['car']), true);
assert.equal(isTransportCompatible({ transportModes: ['plane'] }, ['car']), false);
assert.equal(isWeatherCompatible({ weatherModes: ['rain'] }, ['rain']), true);
assert.equal(isWeatherCompatible({ weatherModes: ['sun'] }, ['rain']), false);

const underwear = { n: 'Mutande', cat: 'Abbigliamento Base', q: 'n' };
assert.equal(calculateItemQuantity(underwear, config), 4, 'the departure-worn item must reduce daily clothing by one');
assert.equal(calculateItemQuantity(underwear, { ...config, nights: 9, laundry: true, laundryFreq: 4, laundryBuffer: 1 }), 4, 'laundry frequency and buffer cap daily clothing');
assert.equal(calculateItemQuantity({ n: 'Coltellino', cat: 'Essenziali', q: 'n' }, { ...config, nights: 0 }, new Set(['Coltellino'])), 0, 'day-trip exclusions must be respected');

const database = {
    base: [
        { n: 'Mutande', cat: 'Abbigliamento Base', s: 'U', q: 'n', w: 50 },
        { n: 'Impermeabile', cat: 'Abbigliamento', s: 'U', q: 1, weatherModes: ['rain'], w: 300 },
        { n: 'Occhiali da sole', cat: 'Accessori', s: 'U', q: 1, weatherModes: ['sun'], w: 30 },
        { n: 'Abito', cat: 'Abbigliamento', s: 'F', q: 1, w: 500 }
    ],
    laundry: [],
    weather: {},
    transport: {},
    extra: { hiking: [{ n: 'Borraccia', cat: 'Trekking', s: 'U', q: 1, w: 200 }] }
};
const previousList = {
    'Abbigliamento Base': [{ n: 'Mutande', cat: 'Abbigliamento Base', uid: 'saved-id', q: 2, w: 55, checked: true, worn: true, bulky: false }],
    Personali: [{ n: 'Farmaco personale', cat: 'Personali', uid: 'custom-id', q: 1, w: 20, custom: true }]
};
const list = generatePacklist(database, config, previousList, [{ id: 'bag-1' }], new Set(), () => 'new-id');

assert.deepEqual(Object.keys(list), ['Abbigliamento Base', 'Abbigliamento', 'Trekking', 'Personali']);
assert.equal(list['Abbigliamento Base'][0].uid, 'saved-id');
assert.equal(list['Abbigliamento Base'][0].w, 55);
assert.equal(list['Abbigliamento Base'][0].checked, true);
assert.equal(list['Abbigliamento Base'][0].worn, true);
assert.equal(list.Accessori, undefined, 'weather-incompatible items must be excluded');
assert.equal(list.Trekking[0].baggageId, 'bag-1');
assert.equal(list.Personali[0], previousList.Personali[0], 'custom items must be preserved');

console.log('Packlist generator unit tests passed');
