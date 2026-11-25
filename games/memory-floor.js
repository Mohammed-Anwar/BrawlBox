/* Memory Floor: solo. A grid of black tiles lights up some tiles for a moment.
   Tap the tiles that lit up. All right = points and the next level.
   One wrong tap = new tiles for the same level (no points).
   Level N lights START_TILES + (N - 1) tiles. The grid grows every LEVELS_PER_GRID levels. */
(() => {
  // ---- Tuning (change these) ----
  const START_TILES = 5;        // tiles lit on level 1
  const SHOW_DELAY_MS = 1000;   // pause before the tiles light up
  const LIGHT_MS = 2000;        // how long the tiles stay lit
  const NEXT_LEVEL_MS = 800;    // pause after a perfect level
  const RETRY_MS = 1000;        // pause after a wrong tap before new tiles
  const BASE_GRID = 4;          // grid is BASE_GRID x BASE_GRID at the start
  const LEVELS_PER_GRID = 3;    // the grid grows by one row and column every this many levels
  const MAX_GRID = 7;           // biggest grid size
  const LIT_COLOR = '#ffd23f';

  const gridSize = lvl => Math.min(MAX_GRID, BASE_GRID + Math.floor((lvl - 1) / LEVELS_PER_GRID));
  const tileCount = lvl => START_TILES + (lvl - 1);

  BrawlBox.registerGame('memory-floor', {
    start(stage, api) {
      let level = 1, score = 0, size = 0, tiles = [];
      let targets = new Set(), picks = new Set();
      let phase = 'show', dead = false;
      const timers = [];
      const later = (ms, fn) => timers.push(setTimeout(() => { if (!dead) fn(); }, ms));

      stage.innerHTML = `
        <style>
          .mf-status { font-size: 1.3rem; font-weight: 800; margin: 0; min-height: 1.5em; }
          .mf-grid { display: grid; gap: 6px; width: min(90vw, 360px); }
          .mf-tile { aspect-ratio: 1; padding: 0; border: 2px solid rgba(255,255,255,.12); border-radius: 12px; background: #0b0a14;
            cursor: pointer; transition: background .25s, box-shadow .25s; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
          .mf-tile.lit { background: ${LIT_COLOR}; box-shadow: 0 0 18px ${LIT_COLOR}; }
          .mf-tile.ok { background: #4ade80; box-shadow: 0 0 14px #4ade80; }
          .mf-tile.bad { background: #ef4444; animation: mf-shake .3s; }
          @keyframes mf-shake { 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        </style>
        <p class="g-sub" id="mf-level"></p>
        <p class="mf-status" id="mf-status"></p>
        <div class="mf-grid" id="mf-grid"></div>`;

      const levelEl = stage.querySelector('#mf-level');
      const statusEl = stage.querySelector('#mf-status');
      const gridEl = stage.querySelector('#mf-grid');

      function buildGrid(n) {
        size = n;
        gridEl.innerHTML = '';
        gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
        tiles = [];
        for (let i = 0; i < n * n; i++) {
          const b = document.createElement('button');
          b.className = 'mf-tile';
          b.onclick = () => tap(i);
          gridEl.appendChild(b);
          tiles.push(b);
        }
      }

      const resetTiles = () => tiles.forEach(t => { t.className = 'mf-tile'; });

      function pickTargets(total, k) {
        const idx = [...Array(total).keys()];
        for (let i = idx.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [idx[i], idx[j]] = [idx[j], idx[i]];
        }
        return new Set(idx.slice(0, k));
      }

      function startLevel() {
        phase = 'show';
        picks = new Set();
        if (gridSize(level) !== size) buildGrid(gridSize(level));
        resetTiles();
        const n = tileCount(level);
        targets = pickTargets(size * size, n);
        levelEl.textContent = `Level ${level} · ${n} tiles`;
        statusEl.textContent = 'Get ready…';

        later(SHOW_DELAY_MS, () => {
          statusEl.textContent = 'Watch closely!';
          targets.forEach(i => tiles[i].classList.add('lit'));
          api.sfx('pop');
          later(LIGHT_MS, () => {
            resetTiles();
            phase = 'input';
            statusEl.textContent = 'Now tap the tiles that lit up!';
            api.sfx('tick');
          });
        });
      }

      function tap(i) {
        if (dead || phase !== 'input' || picks.has(i)) return;
        picks.add(i);
        const r = tiles[i].getBoundingClientRect();
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2;

        if (targets.has(i)) {
          tiles[i].classList.add('ok');
          api.sfx('tick');
          api.burst(cx, cy);
          if (picks.size === targets.size) {
            phase = 'pause';
            score += targets.size;
            api.setScore(score);
            api.sfx('good');
            statusEl.textContent = `Perfect! +${targets.size} points`;
            level++;
            later(NEXT_LEVEL_MS, startLevel);
          }
        } else {
          phase = 'pause';
          tiles[i].classList.add('bad');
          api.sfx('bad');
          statusEl.textContent = 'Wrong! New tiles coming…';
          later(RETRY_MS, startLevel);     // same level, new tiles
        }
      }

      api.onStop(() => {
        dead = true;
        timers.forEach(clearTimeout);
      });

      startLevel();
    },
  });
})();