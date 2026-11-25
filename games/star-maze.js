/* Star Maze: shared. Everyone starts in the same corner of one maze and moves one cell at a time.
   Stars are hidden in the maze. EVERY player can claim every star, once each.
   A star pays more the earlier you claim it. Score = points from the stars you claimed.
   The maze has loops, so there are several routes between places.
   The round ends early once every player has claimed every star. Everyone's dot is visible. */
(() => {
  // ---- Tuning (change these) ----
  const COLS = 15, ROWS = 11;          // maze size in cells
  const CELL = 26;                     // pixels per cell
  const START = 0;                     // start cell (top-left corner)
  const STAR_COUNT = 5;                // stars hidden in the maze
  const MIN_STAR_STEPS = 8;            // stars are at least this many steps from the start
  const LOOP_CHANCE = 0.2;            // share of inner walls knocked down to make extra routes (0 = one path only)
  const MOVE_COOLDOWN_MS = 110;        // minimum time between moves (holding a key is smooth, not instant)
  const REPEAT_DELAY_MS = 260;         // on-screen buttons: wait before they start repeating
  const STAR_MAX_POINTS = 100;         // points for a star claimed at 0 seconds
  const STAR_LOSS_PER_SEC = 4;         // points lost per second
  const STAR_MIN_POINTS = 10;          // a star never pays less than this
  const WALL_COLOR = '#c4b5fd';
  const DIRS = { N: [-1, 0], S: [1, 0], W: [0, -1], E: [0, 1] };
  const OPP = { N: 'S', S: 'N', W: 'E', E: 'W' };
  const KEYS = { ArrowUp: 'N', ArrowDown: 'S', ArrowLeft: 'W', ArrowRight: 'E' };

  function mulberry32(a) {
    return () => {
      let t = (a += 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Walls: walls[cell][dir] === true means a wall. Same seed on every phone = same maze.
  function buildMaze(rnd) {
    const N = COLS * ROWS;
    const walls = Array.from({ length: N }, () => ({ N: true, S: true, E: true, W: true }));
    const seen = new Array(N).fill(false);
    const stack = [START];
    seen[START] = true;
    while (stack.length) {
      const cur = stack[stack.length - 1];
      const r = Math.floor(cur / COLS), c = cur % COLS;
      const opts = [];
      for (const d of ['N', 'S', 'E', 'W']) {
        const nr = r + DIRS[d][0], nc = c + DIRS[d][1];
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS && !seen[nr * COLS + nc]) opts.push([d, nr * COLS + nc]);
      }
      if (!opts.length) { stack.pop(); continue; }
      const [d, nx] = opts[Math.floor(rnd() * opts.length)];
      walls[cur][d] = false;
      walls[nx][OPP[d]] = false;
      seen[nx] = true;
      stack.push(nx);
    }
    return walls;
  }

  // Knock down some inner walls so the maze has loops (several routes between places)
  function addLoops(walls, rnd) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        if (c < COLS - 1 && walls[i].E && rnd() < LOOP_CHANCE) {
          walls[i].E = false;
          walls[i + 1].W = false;
        }
        if (r < ROWS - 1 && walls[i].S && rnd() < LOOP_CHANCE) {
          walls[i].S = false;
          walls[i + COLS].N = false;
        }
      }
    }
  }

  // Steps from the start to every cell (breadth-first search)
  function distances(walls, from) {
    const dist = new Array(COLS * ROWS).fill(Infinity);
    dist[from] = 0;
    const q = [from];
    for (let qi = 0; qi < q.length; qi++) {
      const cur = q[qi];
      for (const d of Object.keys(DIRS)) {
        if (walls[cur][d]) continue;
        const nx = cur + DIRS[d][0] * COLS + DIRS[d][1];
        if (dist[nx] === Infinity) { dist[nx] = dist[cur] + 1; q.push(nx); }
      }
    }
    return dist;
  }

  function placeStars(dist, rnd) {
    const cands = [];
    dist.forEach((d, i) => { if (d !== Infinity && d >= MIN_STAR_STEPS) cands.push(i); });
    const out = [];
    while (out.length < STAR_COUNT && cands.length) {
      out.push(cands.splice(Math.floor(rnd() * cands.length), 1)[0]);
    }
    return out;
  }

  BrawlBox.registerGame('star-maze', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const ids = Object.keys(room.players);
      const epoch = room.epoch;

      const rnd = mulberry32(Math.floor(epoch));
      const walls = buildMaze(rnd);
      addLoops(walls, rnd);
      const starCells = placeStars(distances(walls, START), rnd);

      let mine = START, positions = {}, stars = {}, score = -1, lastMove = 0;
      let dead = false, repeatT = 0, repeatI = 0, finished = false;
      const sentClaims = new Set();      // stars I already sent a claim for (stops double writes)

      stage.innerHTML = `
        <style>
          .sm-canvas { width: min(92vw, ${COLS * CELL}px); height: auto; border-radius: 16px; background: rgba(255,255,255,.04); }
          .sm-hud { display: flex; gap: 14px; font-weight: 800; justify-content: center; flex-wrap: wrap; }
          .sm-hud b { color: var(--yellow); }
          .sm-pad { display: grid; grid-template-columns: repeat(3, 84px); gap: 8px; }
          .sm-pad button { font: inherit; font-size: 1.8rem; height: 76px; border: 0; border-radius: 18px; background: #fff; color: #241b4b;
            box-shadow: 0 5px 0 #c4b5fd; touch-action: none; user-select: none; -webkit-user-select: none; }
          .sm-pad button:active { transform: translateY(3px); box-shadow: 0 2px 0 #c4b5fd; }
        </style>
        <div class="sm-hud"><span>⭐ You still need <b id="sm-left">${STAR_COUNT}</b></span><span>Your points <b id="sm-pts">0</b></span></div>
        <canvas class="sm-canvas" id="sm-cv" width="${COLS * CELL}" height="${ROWS * CELL}"></canvas>
        <div class="sm-pad" id="sm-pad">
          <span></span><button data-d="N">▲</button><span></span>
          <button data-d="W">◀</button><span></span><button data-d="E">▶</button>
          <span></span><button data-d="S">▼</button><span></span>
        </div>
        <p class="g-sub">Arrow keys or the buttons. Walk onto a ⭐ to claim it. Every star can be claimed by everyone.</p>`;

      const cv = stage.querySelector('#sm-cv');
      const ctx = cv.getContext('2d');
      const leftEl = stage.querySelector('#sm-left');
      const ptsEl = stage.querySelector('#sm-pts');
      const pad = stage.querySelector('#sm-pad');

      const cellCenter = c => ({ x: (c % COLS + 0.5) * CELL, y: (Math.floor(c / COLS) + 0.5) * CELL });
      const pagePoint = c => {
        const r = cv.getBoundingClientRect(), p = cellCenter(c);
        return { x: r.left + p.x * r.width / cv.width, y: r.top + p.y * r.height / cv.height };
      };
      const pointsFor = t => Math.max(STAR_MIN_POINTS, Math.round(STAR_MAX_POINTS - (t / 1000) * STAR_LOSS_PER_SEC));

      // stars[i] = { uid: timeMs, ... } : one entry per player who claimed star i
      const myClaimOf = i => stars[i] && stars[i][me];

      function draw() {
        ctx.clearRect(0, 0, cv.width, cv.height);

        // Walls
        ctx.strokeStyle = WALL_COLOR;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const i = r * COLS + c, x = c * CELL, y = r * CELL;
            if (walls[i].N) { ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); }
            if (walls[i].W) { ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); }
            if (r === ROWS - 1 && walls[i].S) { ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); }
            if (c === COLS - 1 && walls[i].E) { ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); }
          }
        }
        ctx.stroke();

        // Every star stays on the board. A star you claimed is faded.
        // Small dots in the corner show who has claimed it.
        ctx.font = `${CELL * 0.75}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        starCells.forEach((cell, i) => {
          const p = cellCenter(cell);
          ctx.globalAlpha = myClaimOf(i) ? 0.35 : 1;
          ctx.fillText('⭐', p.x, p.y + 1);
          ctx.globalAlpha = 1;

          const claimers = ids.filter(id => stars[i] && stars[i][id] !== undefined);
          claimers.forEach((id, j) => {
            ctx.beginPath();
            ctx.arc(p.x - CELL * 0.3 + j * CELL * 0.2, p.y + CELL * 0.36, CELL * 0.08, 0, Math.PI * 2);
            ctx.fillStyle = room.players[id]?.color || '#ffffff';
            ctx.fill();
          });
        });

        // Dots. Players on the same cell are spread out in a ring so all are visible.
        const groups = {};
        ids.forEach(id => {
          if (!room.players[id]) return;
          const c = id === me ? mine : (positions[id] ?? START);
          (groups[c] ||= []).push(id);
        });
        Object.entries(groups).forEach(([c, list]) => {
          const p = cellCenter(Number(c));
          list.forEach((id, j) => {
            const spread = list.length > 1 ? CELL * 0.22 : 0;
            const a = (j / list.length) * Math.PI * 2;
            const x = p.x + Math.cos(a) * spread, y = p.y + Math.sin(a) * spread;
            ctx.beginPath();
            ctx.arc(x, y, CELL * 0.22, 0, Math.PI * 2);
            ctx.fillStyle = room.players[id].color || '#ffffff';
            ctx.fill();
            if (id === me) { ctx.lineWidth = 2.5; ctx.strokeStyle = '#ffffff'; ctx.stroke(); }
          });
        });
      }

      function refresh() {
        let pts = 0, mineLeft = 0;
        starCells.forEach((_, i) => {
          const t = myClaimOf(i);
          if (t !== undefined) pts += pointsFor(t);
          else mineLeft++;
        });
        leftEl.textContent = mineLeft;
        ptsEl.textContent = pts;
        if (pts !== score) { score = pts; api.setScore(pts); }

        // Round ends early once every player has claimed every star
        const allDone = starCells.every((_, i) => ids.every(id => stars[i] && stars[i][id] !== undefined));
        if (allDone && !finished && !dead) { finished = true; api.finish(); }
      }

      function claim(cell) {
        const i = starCells.indexOf(cell);
        if (i < 0 || myClaimOf(i) !== undefined || sentClaims.has(i)) return;
        sentClaims.add(i);
        const t = Math.max(0, Math.round(Date.now() - epoch));   // ms since the game started
        room.set(`stars/${i}/${me}`, t).then(() => {
          if (dead) return;
          api.sfx('good');
          const p = pagePoint(cell);
          api.burst(p.x, p.y);
        }).catch(err => {
          sentClaims.delete(i);                 // allow a retry on the next step
          console.error('Star claim rejected:', err.code || err.message, `stars/${i}/${me}`);
        });
      }

      function move(d) {
        if (dead) return;
        const now = performance.now();
        if (now - lastMove < MOVE_COOLDOWN_MS) return;
        if (walls[mine][d]) { api.sfx('tick'); return; }     // bumped a wall
        lastMove = now;
        mine += DIRS[d][0] * COLS + DIRS[d][1];
        room.set(`pos/${me}`, mine);
        api.sfx('tap');
        claim(mine);
        draw();
      }

      // Keyboard
      const onKey = e => {
        const d = KEYS[e.key];
        if (d) { e.preventDefault(); move(d); }
      };
      window.addEventListener('keydown', onKey);

      // On-screen buttons (hold to repeat)
      const stopRepeat = () => { clearTimeout(repeatT); clearInterval(repeatI); };
      pad.querySelectorAll('button').forEach(b => {
        const d = b.dataset.d;
        b.onpointerdown = e => {
          e.preventDefault();
          move(d);
          stopRepeat();
          repeatT = setTimeout(() => { repeatI = setInterval(() => move(d), MOVE_COOLDOWN_MS); }, REPEAT_DELAY_MS);
        };
        b.onpointerup = stopRepeat;
        b.onpointercancel = stopRepeat;
        b.onpointerleave = stopRepeat;
      });

      // Shared state
      api.onStop(room.on('pos', v => { positions = v || {}; draw(); }));
      api.onStop(room.on('stars', v => { stars = v || {}; refresh(); draw(); }));

      api.onStop(() => {
        dead = true;
        window.removeEventListener('keydown', onKey);
        stopRepeat();
      });

      draw();
      refresh();
    },
  });
})();