/* Box Stack: solo. Boxes drift down from the sky. Drag one with your finger or mouse
   and let go over your tower to drop it. Only boxes that have come to rest count toward
   your height, so a box still in the air never adds to the score.
   Score = tallest settled height (Peak keeps your best). Physics: Matter.js from a CDN. */
(() => {
  // ---- Tuning (change these) ----
  const W = 360, H = 520;            // canvas size in pixels
  const BLOCK = 34;                  // size of one box cell
  const CELL_GAP = 1;                // space between cells of one box
  const GROUND_TOP = 470;            // world y of the ground surface
  const VIEW_TOP = 150;              // screen y where the tower top sits once the camera follows it
  const SKY_LINE_Y = 62;             // screen y where sky boxes hover
  const FALL_SPEED = 130;            // px/s for sky boxes falling to the hover line
  const HOVER_LIFE_S = 6;            // seconds a sky box hovers before it floats away
  const SPAWN_EVERY_MS = 2000;       // time between new sky boxes
  const MAX_SKY = 4;                 // most sky boxes at once
  const SWAY_PX = 14;                // side-to-side sway of sky boxes
  const GRAB_PAD = 10;               // extra px around a box that still counts as a grab
  const SETTLE_SPEED = 0.15;         // a box is "at rest" when it moves slower than this (px per step)
  const SETTLE_STEPS = 30;           // ...for this many physics steps in a row
  const SCORE_MODE = 'peak';         // 'peak' = best height ever, 'final' = height right now
  const PHYSICS_STEP = 1000 / 60;    // Matter.js step in ms
  const MATTER_URL = 'https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js';

  const SHAPES = {
    I: { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], color: '#22d3ee' },
    O: { cells: [[0, 0], [1, 0], [0, 1], [1, 1]], color: '#ffd23f' },
    T: { cells: [[0, 0], [1, 0], [2, 0], [1, 1]], color: '#a855f7' },
    L: { cells: [[0, 0], [0, 1], [0, 2], [1, 2]], color: '#fb923c' },
    J: { cells: [[1, 0], [1, 1], [1, 2], [0, 2]], color: '#38bdf8' },
    S: { cells: [[1, 0], [2, 0], [0, 1], [1, 1]], color: '#4ade80' },
    Z: { cells: [[0, 0], [1, 0], [1, 1], [2, 1]], color: '#ff4d8d' },
  };

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  // Size and cell offsets for each shape, relative to the shape's center
  const layout = key => {
    const { cells, color } = SHAPES[key];
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    const w = (Math.max(...xs) - x0 + 1) * BLOCK;
    const h = (Math.max(...ys) - y0 + 1) * BLOCK;
    return {
      w, h, color,
      offsets: cells.map(([x, y]) => ({ ox: (x - x0) * BLOCK + BLOCK / 2 - w / 2, oy: (y - y0) * BLOCK + BLOCK / 2 - h / 2 })),
    };
  };
  const LAYOUT = Object.fromEntries(Object.keys(SHAPES).map(k => [k, layout(k)]));

  let matterP = null;
  function loadMatter() {
    if (window.Matter) return Promise.resolve(window.Matter);
    return matterP ||= new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = MATTER_URL;
      s.onload = () => resolve(window.Matter);
      s.onerror = () => reject(new Error('Could not load the physics engine.'));
      document.head.appendChild(s);
    });
  }

  function init(M, stage, api) {
    const { Engine, Bodies, Body, World } = M;
    const engine = Engine.create({ gravity: { x: 0, y: 1 } });
    World.add(engine.world, Bodies.rectangle(W / 2, GROUND_TOP + 500, 3000, 1000, { isStatic: true, friction: 0.9 }));

    stage.innerHTML = `
      <style>
        .bs-canvas { width: min(92vw, ${W}px); height: auto; border-radius: 22px;
          background: linear-gradient(#1e1b4b, #312e81); touch-action: none; cursor: grab; }
        .bs-canvas.dragging { cursor: grabbing; }
        .bs-hud { display: flex; gap: 14px; font-weight: 800; justify-content: center; }
        .bs-hud b { color: var(--yellow); font-size: 1.3rem; }
        .bs-tip { min-height: 1.4em; margin: 0; font-weight: 800; }
      </style>
      <div class="bs-hud"><span>🏗️ Height <b id="bs-h">0</b></span><span>⭐ Best <b id="bs-best">0</b></span></div>
      <canvas class="bs-canvas" id="bs-cv" width="${W}" height="${H}"></canvas>
      <p class="bs-tip" id="bs-tip"></p>`;

    const $ = s => stage.querySelector(s);
    const cv = $('#bs-cv'), ctx = cv.getContext('2d');
    const elH = $('#bs-h'), elBest = $('#bs-best'), elTip = $('#bs-tip');

    let sky = [];        // boxes in the sky, in screen coordinates
    let held = null;     // box being dragged: { key, body, x, y, offX, offY } (screen coordinates)
    let placed = [];     // Matter bodies that have been dropped
    let cam = 0;         // world y - cam = screen y
    let peak = 0, shownH = -1, shownBest = -1, shownScore = -1;
    let acc = 0, last = performance.now(), lastSpawn = last, raf = 0, dead = false;

    function makeBody(key, x, y) {
      const L = LAYOUT[key];
      const parts = L.offsets.map(o => Bodies.rectangle(o.ox, o.oy, BLOCK - CELL_GAP, BLOCK - CELL_GAP,
        { friction: 0.8, frictionStatic: 1, restitution: 0 }));
      const body = Body.create({ parts });
      Body.setPosition(body, { x, y });
      body.bbColor = L.color;
      body.settleSteps = 0;
      return body;
    }

    function spawnSky() {
      const keys = Object.keys(SHAPES);
      sky.push({
        key: keys[Math.floor(Math.random() * keys.length)],
        x: 60 + Math.random() * (W - 120), dx: 0, sy: -90,
        phase: 'fall', t: 0, sway: Math.random() * Math.PI * 2,
      });
    }

    const toCanvas = e => {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
    };

    function pickSky(p) {
      for (let i = sky.length - 1; i >= 0; i--) {      // top-most box first
        const s = sky[i], L = LAYOUT[s.key];
        if (Math.abs(p.x - s.dx) <= L.w / 2 + GRAB_PAD && Math.abs(p.y - s.sy) <= L.h / 2 + GRAB_PAD) return s;
      }
      return null;
    }

    function setTip() {
      elTip.textContent = held ? 'Let go to drop it on your tower.' : 'Drag a falling box onto your tower, then let go.';
    }

    // A box counts as settled after it has been nearly still for SETTLE_STEPS steps
    function physicsStep() {
      Engine.update(engine, PHYSICS_STEP);
      for (const b of placed) {
        const still = Math.abs(b.velocity.x) + Math.abs(b.velocity.y) < SETTLE_SPEED
          && Math.abs(b.angularVelocity) < 0.01;
        b.settleSteps = still ? (b.settleSteps || 0) + 1 : 0;
      }
    }

    // Height of the tallest box that is at rest. Boxes still in the air do not count.
    function settledHeight() {
      let topY = GROUND_TOP;
      for (const b of placed) {
        if ((b.settleSteps || 0) >= SETTLE_STEPS) topY = Math.min(topY, b.bounds.min.y);
      }
      return Math.max(0, Math.round((GROUND_TOP - topY) / BLOCK));
    }

    function drawBoxAt(key, cx, cy, alpha) {
      const L = LAYOUT[key];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = L.color;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      for (const o of L.offsets) {
        const x = cx + o.ox - (BLOCK - CELL_GAP) / 2, y = cy + o.oy - (BLOCK - CELL_GAP) / 2;
        ctx.fillRect(x, y, BLOCK - CELL_GAP, BLOCK - CELL_GAP);
        ctx.strokeRect(x, y, BLOCK - CELL_GAP, BLOCK - CELL_GAP);
      }
      ctx.globalAlpha = 1;
    }

    function drawBody(b, alpha = 1) {
      const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
      ctx.globalAlpha = alpha;
      ctx.fillStyle = b.bbColor;
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 1.5;
      for (const p of parts) {
        ctx.beginPath();
        p.vertices.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y - cam) : ctx.moveTo(v.x, v.y - cam)));
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    function frame(now) {
      if (dead) return;
      const dtMs = Math.min(50, now - last);
      last = now;
      const dt = dtMs / 1000;

      acc += dtMs;
      while (acc >= PHYSICS_STEP) { physicsStep(); acc -= PHYSICS_STEP; }

      // Remove boxes that fell far away
      placed = placed.filter(b => {
        if (b.position.y > GROUND_TOP + 600) { World.remove(engine.world, b); return false; }
        return true;
      });

      // Camera follows the highest box, even one still falling, so you can see it
      let topY = GROUND_TOP;
      for (const b of placed) topY = Math.min(topY, b.bounds.min.y);
      cam = Math.min(0, topY - VIEW_TOP);

      // Score only counts boxes at rest
      const h = settledHeight();
      if (h > peak) peak = h;
      if (h !== shownH) { shownH = h; elH.textContent = h; }
      if (peak !== shownBest) { shownBest = peak; elBest.textContent = peak; }
      const score = SCORE_MODE === 'final' ? h : peak;
      if (score !== shownScore) { shownScore = score; api.setScore(score); }

      // Dragged box follows the pointer (kept in screen space, converted to world space)
      if (held) Body.setPosition(held.body, { x: held.x, y: held.y + cam });

      // Sky boxes: spawn, fall to the hover line, sway, then float away
      if (now - lastSpawn >= SPAWN_EVERY_MS && sky.length < MAX_SKY) { spawnSky(); lastSpawn = now; }
      sky = sky.filter(s => {
        if (s.phase === 'fall') {
          s.sy += FALL_SPEED * dt;
          if (s.sy >= SKY_LINE_Y) { s.sy = SKY_LINE_Y; s.phase = 'hover'; }
        } else {
          s.t += dt;
          if (s.t > HOVER_LIFE_S) return false;
        }
        s.dx = s.x + Math.sin(s.sway + now / 600) * SWAY_PX;
        return true;
      });

      // Draw
      ctx.clearRect(0, 0, W, H);
      const gy = GROUND_TOP - cam;
      ctx.fillStyle = '#3b0764';
      ctx.fillRect(0, gy, W, H - gy);
      ctx.fillStyle = '#a855f7';
      ctx.fillRect(0, gy, W, 4);
      for (const s of sky) drawBoxAt(s.key, s.dx, s.sy, 0.9);
      for (const b of placed) drawBody(b);
      if (held) drawBody(held.body, 0.85);

      if (!dead) raf = requestAnimationFrame(frame);
    }

    // Input: press a sky box to grab it, move the pointer, release to drop
    const onDown = e => {
      if (dead || held) return;
      const p = toCanvas(e);
      const s = pickSky(p);
      if (!s) return;
      sky = sky.filter(x => x !== s);
      const body = makeBody(s.key, s.dx, s.sy + cam);
      Body.setStatic(body, true);
      World.add(engine.world, body);
      held = { key: s.key, body, x: s.dx, y: s.sy, offX: s.dx - p.x, offY: s.sy - p.y };
      cv.setPointerCapture?.(e.pointerId);
      cv.classList.add('dragging');
      api.sfx('pop');
      setTip();
    };

    const onMove = e => {
      if (!held) return;
      const p = toCanvas(e);
      const L = LAYOUT[held.key];
      held.x = clamp(p.x + held.offX, L.w / 2 + 2, W - L.w / 2 - 2);
      held.y = clamp(p.y + held.offY, L.h / 2 + 2, H - 4);
    };

    const onUp = () => {
      if (!held) return;
      const h = held;
      held = null;
      Body.setStatic(h.body, false);
      Body.setVelocity(h.body, { x: 0, y: 0 });
      placed.push(h.body);
      cv.classList.remove('dragging');
      api.sfx('tick');
      setTip();
    };

    cv.addEventListener('pointerdown', onDown);
    cv.addEventListener('pointermove', onMove);
    cv.addEventListener('pointerup', onUp);
    cv.addEventListener('pointercancel', onUp);

    api.onStop(() => {
      dead = true;
      cancelAnimationFrame(raf);
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', onUp);
      cv.removeEventListener('pointercancel', onUp);
      Engine.clear(engine);
    });

    setTip();
    raf = requestAnimationFrame(frame);
  }

  BrawlBox.registerGame('box-stack', {
    start(stage, api) {
      let stopped = false;
      api.onStop(() => { stopped = true; });
      stage.innerHTML = '<p class="g-sub">Loading physics…</p>';
      loadMatter()
        .then(M => { if (!stopped) init(M, stage, api); })
        .catch(e => {
          if (!stopped) stage.innerHTML = `<p class="g-rule">Oops! Physics failed to load.</p><p class="g-sub">${e.message}</p>`;
        });
    },
  });
})();