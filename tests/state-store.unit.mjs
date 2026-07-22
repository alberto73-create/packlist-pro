import assert from 'node:assert/strict';
import { createStateStore } from '../js/modules/state-store.js';

const store = createStateStore({ count: 0, label: 'initial' });
const changes = [];
const unsubscribe = store.subscribe(change => changes.push(change));

const next = store.setState({ count: 1 }, 'counter:increment');
assert.equal(next.count, 1);
assert.equal(store.getState().count, 1);
assert.equal(changes.length, 1);
assert.equal(changes[0].previousState.count, 0);
assert.deepEqual(changes[0].changedKeys, ['count']);
assert.equal(changes[0].source, 'counter:increment');

store.setState({ count: 1 }, 'counter:no-change');
assert.equal(changes.length, 1, 'identical values must not emit an event');
unsubscribe();
store.setState({ label: 'updated' }, 'label:update');
assert.equal(changes.length, 1, 'unsubscribed listeners must not receive events');

console.log('State store unit tests passed');
