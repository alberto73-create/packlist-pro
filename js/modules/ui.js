// ═══════════════════════════════════════════════════════════════════
// 4. VIEW
// ═══════════════════════════════════════════════════════════════════
import { STATE, U, FILTER_MAP } from './db.js';

export const View = {
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

            let shouldShow = true;
            if (filter !== 'all') {
                const allowedCats = FILTER_MAP[filter] || [];
                shouldShow = allowedCats.includes(cat);
            }

            if (!shouldShow) continue;

            const sorted  = [...items].sort((a,b) => (a.checked ? 1 : 0) - (b.checked ? 1 : 0));
            const pending = sorted.filter(i => !i.checked).length;

            const box = document.createElement('div');
            box.className = 'cat-box';
            box.dataset.cat = cat;
            box.innerHTML = `<div class="cat-header"><span class="cat-name">${U.esc(cat)}</span><span class="cat-count">${pending}/${items.length}</span></div>`;

            sorted.forEach(item => {
                const row = document.createElement('div');
                row.className = `item-row ${item.checked ? 'taken' : 'pending'}`;
                row.dataset.uid = item.uid;
                row.dataset.cat = cat;
                row.setAttribute('role', 'checkbox');
                row.setAttribute('aria-checked', item.checked);
                row.setAttribute('tabindex', '0');

                const bulkBadge      = item.v >= 3  ? `<span class="badge" title="Ingombrante">📦</span>` : '';
                const wornBadge      = item.worn     ? `<span class="badge" title="Da indossare in viaggio">🧥</span>` : '';
                const protectedBadge = item.custom   ? `<span class="badge" title="Item personale">⭐</span>` : '';
                const wDisplay       = U.weight((item.w || 100) * item.q);

                row.innerHTML = `
                    <div class="item-content">
                        <span class="qty">${item.q}x</span>
                        <span class="item-text">${U.esc(item.n)}${bulkBadge}${wornBadge}${protectedBadge}</span>
                        <span class="item-weight">${wDisplay}</span>
                    </div>
                    <div class="item-actions">
                        <button class="ia-btn worn"
                            data-action="worn" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                            title="${item.worn ? 'Metti nello zaino' : 'Segna come indossato'}"
                            aria-label="Toggle indossato">${item.worn ? '🧥' : '🎒'}</button>
                        <button class="ia-btn edit"
                            data-action="edit" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                            title="Modifica peso" aria-label="Modifica peso">⚖️</button>
                        <button class="ia-btn del"
                            data-action="del" data-cat="${U.esc(cat)}" data-uid="${item.uid}"
                            title="Rimuovi" aria-label="Rimuovi ${U.esc(item.n)}">✕</button>
                    </div>`;
                box.appendChild(row);
            });

            const inputId = `add-${cat.replace(/\W/g,'')}`;
            const addRow = document.createElement('div');
            addRow.className = 'add-custom';
            addRow.innerHTML = `
                <input type="text" id="${inputId}" placeholder="+ Aggiungi item personalizzato...">
                <button class="btn-sm" data-action="add" data-cat="${U.esc(cat)}" data-input="${inputId}">+ Add</button>`;
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
        if (!all.length) {
            bar.classList.remove('visible');
            return;
        }

        const done = all.filter(i => i.checked).length;
        const pct  = Math.round(done / all.length * 100);
        const bagG = all.filter(i => i.checked && !i.worn).reduce((s,i) => s + ((i.w && !isNaN(i.w) ? i.w : 100) * i.q), 0);
        const wornG = all.filter(i => i.checked && i.worn).reduce((s,i) => s + ((i.w && !isNaN(i.w) ? i.w : 100) * i.q), 0);
        const totG = bagG + wornG;

        bar.classList.add('visible');
        document.getElementById('progressPct').textContent = pct;
        document.getElementById('progressPct').className = `pct-display ${pct === 0 ? 'zero' : pct < 100 ? 'mid' : 'done'}`;
        document.getElementById('progressFill').style.width = `${pct}%`;
        document.getElementById('suitcaseWeight').textContent = U.weight(bagG);
        document.getElementById('totalWeight').textContent = U.weight(totG);
        document.getElementById('wornWeight').textContent = U.weight(wornG);

        const weightPct = totG / 15000 * 100;
        const weightFill = document.getElementById('weightFill');
        weightFill.style.width = `${Math.min(weightPct, 100)}%`;
        weightFill.className = `weight-fill ${totG < 8000 ? 'light' : totG < 12000 ? 'mid' : 'heavy'}`;

        document.getElementById('suitcaseWeight').className = `chip-val ${bagG < 8000 ? 'light' : bagG < 12000 ? 'mid' : 'heavy'}`;
        document.getElementById('totalWeight').className = `chip-val ${totG < 8000 ? 'light' : totG < 12000 ? 'mid' : 'heavy'}`;
    }
};
