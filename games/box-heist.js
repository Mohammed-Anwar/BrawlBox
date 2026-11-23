/* Box Heist: gems sit in a central pile. Grab one into your box, or steal one from another box. */
(() => {
    const COOLDOWN = 600,
        valueOf = i => i % 5 === 0 ? 3 : 1;
    const esc = s => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [c]));
    BrawlBox.registerGame('box-heist', {
        start(stage, api) {
            const room = api.room,
                me = room.uid,
                ids = Object.keys(room.players),
                N = 8 + ids.length * 4;
            let tiles = {},
                lastGrab = -1e9,
                lastScore = -1;
            stage.innerHTML = `<style>
      .bh-label{font-weight:800;opacity:.8;margin:0}.bh-pile{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;width:min(92vw,520px);min-height:96px;padding:12px;border-radius:20px;background:rgba(255,210,63,.12)}
      .bh-gem{height:72px;font-size:34px;border:0;border-radius:16px;background:#fff;cursor:pointer;box-shadow:0 4px 0 #c4b5fd}.bh-gem.gold{background:#ffd23f;box-shadow:0 4px 0 #b45309}
      .bh-boxes{display:flex;flex-direction:column;gap:8px;width:min(92vw,520px)}.bh-box{display:flex;align-items:center;gap:10px;padding:8px 12px;border-radius:16px;background:rgba(255,255,255,.08);border-left:8px solid #fff}
      .bh-name{flex:1;min-width:0;text-align:left;font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bh-chips{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;max-width:60%}
      .bh-chip{height:56px;min-width:56px;font-size:26px;border:0;border-radius:14px;background:#fff;cursor:pointer;box-shadow:0 4px 0 #c4b5fd}.bh-chip.gold{background:#ffd23f;box-shadow:0 4px 0 #b45309}.bh-total{font-weight:900;font-size:1.3rem;color:var(--yellow);min-width:2ch;text-align:right}.bh-empty{opacity:.5;font-size:.9rem}
    </style><p class="g-rule">Grab for your box. Steal from theirs!</p><p class="bh-label">Central pile</p><div class="bh-pile" id="bh-pile"></div><p class="bh-label">Boxes</p><div class="bh-boxes" id="bh-boxes"></div>`;
            const pileEl = stage.querySelector('#bh-pile'),
                boxesEl = stage.querySelector('#bh-boxes'),
                colorOf = id => room.players[id]?.color || '#ffffff',
                gemIcon = i => valueOf(i) > 1 ? '🪙' : '💎',
                gemClass = i => valueOf(i) > 1 ? 'gold' : '';
            const render = () => {
                const pile = [],
                    box = Object.fromEntries(ids.map(id => [id, []]));
                for (let i = 0; i < N; i++) {
                    const o = tiles[i];
                    if (o && box[o]) box[o].push(i);
                    else pile.push(i)
                }
                pileEl.innerHTML = pile.length ? pile.map(i => `<button class="bh-gem ${gemClass(i)}" data-i="${i}">${gemIcon(i)}</button>`).join('') : '<p class="g-sub">The pile is empty. Steal!</p>';
                boxesEl.innerHTML = ids.map(id => {
                    const items = box[id],
                        total = items.reduce((s, i) => s + valueOf(i), 0),
                        chips = items.map(i => `<button class="bh-chip ${gemClass(i)}" data-i="${i}">${gemIcon(i)}</button>`).join('');
                    return `<div class="bh-box" style="border-left-color:${colorOf(id)}"><span class="bh-name">${esc(room.players[id].name)}${id===me?' (you)':''}</span><div class="bh-chips">${chips||'<span class="bh-empty">empty</span>'}</div><span class="bh-total">${total}</span></div>`
                }).join('');
                const mine = (box[me] || []).reduce((s, i) => s + valueOf(i), 0);
                if (mine !== lastScore) {
                    lastScore = mine;
                    api.setScore(mine)
                }
            };
            const onClick = e => {
                const b = e.target.closest('[data-i]');
                if (!b) return;
                const i = Number(b.dataset.i),
                    now = performance.now();
                if (tiles[i] === me || now - lastGrab < COOLDOWN) {
                    b.animate([{
                        transform: 'translateX(-5px)'
                    }, {
                        transform: 'translateX(5px)'
                    }, {
                        transform: 'none'
                    }], {
                        duration: 240
                    });
                    return
                }
                lastGrab = now;
                Promise.resolve(room.set(`tiles/${i}`, me)).catch(() => {});
                api.sfx('pop');
                const r = b.getBoundingClientRect();
                api.burst(r.left + r.width / 2, r.top + r.height / 2, 14)
            };
            stage.addEventListener('click', onClick);
            api.onStop(() => stage.removeEventListener('click', onClick));
            api.onStop(room.on('tiles', v => {
                tiles = v || {};
                render()
            }));
        }
    });
})();