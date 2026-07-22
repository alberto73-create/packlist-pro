// js/modules/state-store.js - Store osservabile minimale e indipendente dal DOM

/**
 * @template State
 * @typedef {Object} StateChange
 * @property {State} previousState
 * @property {State} state
 * @property {string[]} changedKeys
 * @property {string} source
 */

/**
 * Crea uno store shallow-immutable con sottoscrizioni sincrone.
 * Le mutazioni devono passare da `setState` per notificare gli osservatori.
 * @template {Record<string, unknown>} State
 * @param {State} initialState
 */
export function createStateStore(initialState) {
    /** @type {State} */
    let state = initialState;
    /** @type {Set<(change: StateChange<State>) => void>} */
    const listeners = new Set();

    return {
        getState: () => state,
        /** @param {Partial<State>} patch @param {string} [source] */
        setState(patch, source = 'unknown') {
            const changedKeys = Object.keys(patch).filter(key => state[key] !== patch[key]);
            if (!changedKeys.length) return state;
            const previousState = state;
            state = { ...state, ...patch };
            const change = { previousState, state, changedKeys, source };
            listeners.forEach(listener => listener(change));
            return state;
        },
        /** @param {(change: StateChange<State>) => void} listener */
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        }
    };
}
