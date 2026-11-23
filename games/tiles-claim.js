/* Tile Grab: take tiles with your color. Anyone can take any tile.
   Score = number of tiles you hold when time runs out. */
(() => {
  // Grid size (cols x rows) by player count: 2 players = index 0.
  // 6 players use 6x5 (assumption, same as 5 players).
  const SIZES = [
    [5, 5], [6, 5], [6, 5], [6, 6], [7, 6], [7, 7],
    [8, 7], [8, 8], [9, 8], [9, 9], [10, 9], [10, 10],
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BrawlBox.registerGame('tiles-claim', {
    start(stage, api) {
      const room = api.room;
      const n = Math.max(2, Object.keys(room.players).length);
      const [cols, rows] = SIZES[Math.min(n - 2, SIZES.length - 1)];
      const total = cols * rows;
      const colorOf = uid => (room.players[uid] && room.players[uid].color) || '#cccccc';

      let tiles = {};   // index -> owner uid
      let score = 0;

      stage.innerHTML = `
        <style>
          .tc-grid { display: grid; gap: 6px; width: min(92vw, 520px); }
          .tc-tile {
            aspect-ratio: 1; border: 0; border-radius: 12px; background: #fff; cursor: pointer;
            box-shadow: inset 0 -4px 0 rgba(0,0,0,.12); transition: background .15s, transform .1s;
          }
          .tc-tile:active { transform: scale(.9); }
          .tc-legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
          .tc-chip { padding: 4px 12px; border-radius: 999px; font-weight: 800; color: #241b4b; }
          .tc-chip.me { outline: 3px solid #fff; }
        </style>
        <p class="g-rule">Tap any tile to take it, even from others!</p>
        <div class="tc-grid" id="tc-grid" style="grid-template-columns: repeat(${cols}, 1fr)"></div>
        <div class="tc-legend" id="tc-legend"></div>`;

      const gridEl = stage.querySelector('#tc-grid');
      const legend = stage.querySelector('#tc-legend');
      const tileEls = [];

      for (let i = 0; i < total; i++) {
        const b = document.createElement('button');
        b.className = 'tc-tile';
        b.onclick = (e) => {
          if (tiles[i] === room.uid) return;        // already yours
          room.set(`tiles/${i}`, room.uid);
          api.sfx('tap');
          api.burst(e.clientX, e.clientY);
        };
        gridEl.appendChild(b);
        tileEls.push(b);
      }

      const render = () => {
        const counts = {};
        for (let i = 0; i < total; i++) {
          const owner = tiles[i];
          tileEls[i].style.background = owner ? colorOf(owner) : '#ffffff';
          if (owner) counts[owner] = (counts[owner] || 0) + 1;
        }
        const mine = counts[room.uid] || 0;
        if (mine !== score) { score = mine; api.setScore(score); }
        legend.innerHTML = Object.keys(room.players).map(id => `
          <span class="tc-chip ${id === room.uid ? 'me' : ''}" style="background:${colorOf(id)}">
            ${esc(room.players[id].name)}: ${counts[id] || 0}
          </span>`).join('');
      };

      const off = room.on('tiles', (val) => { tiles = val || {}; render(); });
      api.onStop(off);
    },
  });
})();