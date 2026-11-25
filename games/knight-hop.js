/* Knight Hop (shared board). Everyone shares one 5x5 board and is a chess knight.
   Jump in L-shapes onto a square nobody has touched yet. Every square you land on stays taken
   for everyone, even after you leave. The square you stand on crumbles after LIFE_MS, so jump in time.
   Score = deciseconds alive. */
(() => {
  // ---- Tuning (change these) ----
  const SIZE = 9;                  // board is SIZE x SIZE
  const LIFE_MS = 3000;            // how long you can stand on a square before it crumbles
  const HOP_MS = 360;              // how long a jump takes
  const HOP_LIFT_PX = 26;          // how high the knight arcs over the board
  const HOP_FRAMES = 12;           // animation steps in one jump
  const FALL_MS = 620;             // how long the falling knight animation lasts
  const START_DELAY_MS = 350;      // pause before the first knight lands
  const WARN_MS = 1000;            // last part of LIFE_MS where the timer bar turns red
  const STALE_GRACE_MS = 1500;     // silence allowed before another player's knight counts as crumbled
  const CLAIM_TRIES = 20;          // attempts to find a free start square
  const SCORE_UNIT_MS = 100;       // score = alive time / this (100 = deciseconds)
  const DEATH_PAUSE_MS = 700;      // pause after falling before the result is sent
  const SHAKE_MS = 240;            // length of the "not allowed" shake
  const REPAINT_MS = 250;          // how often the board refreshes other players' knights
  const MOVES = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeColor = c => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#cccccc');

  BrawlBox.registerGame('knight-hop', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const N = SIZE * SIZE;
      const rc = i => [Math.floor(i / SIZE), i % SIZE];
      const colorOf = id => safeColor(room.players[id]?.color);
      const nameOf = id => room.players[id]?.name || '?';

      let taken = {};          // shared: square index -> uid who claimed it
      let pos = {};            // shared: uid -> { i, dead }
      let seen = {};           // local: uid -> performance.now() when that player's pos last changed
      let myIndex = -1;        // my current square (or the one I am jumping to)
      let landAt = 0;          // performance.now() when I land; crumble counts from here
      let hopping = false, over = false, stopped = false;
      let raf = 0, anim = null, deathTimer = 0, lastScore = -1, lastPaint = 0;
      const t0 = performance.now();

      stage.innerHTML = `
        <style>
          .kh-wrap { width: min(92vw, 380px); display: flex; flex-direction: column; gap: 10px; }
          .kh-timer { height: 10px; border-radius: 999px; background: rgba(255,255,255,.12); overflow: hidden; }
          .kh-bar { width: 100%; height: 100%; background: #ffd23f; transform-origin: left center; }
          .kh-bar.warn { background: #ef4444; }
          .kh-board { position: relative; display: grid; grid-template-columns: repeat(${SIZE}, 1fr); gap: 6px; }
          .kh-sq { position: relative; aspect-ratio: 1; padding: 0; border: 0; border-radius: 14px; background: #fff;
            box-shadow: 0 4px 0 #c4b5fd; cursor: pointer; display: flex; align-items: center; justify-content: center;
            -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
          .kh-sq.taken { background: #3b3a66; box-shadow: none; cursor: default; }
          .kh-sq.gone { background: transparent; box-shadow: inset 0 0 0 2px rgba(255,255,255,.12); cursor: default; }
          .kh-sq.mine { outline: 4px solid #ffd23f; outline-offset: -4px; }
          .kh-sq.legal::after { content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 14px;
            margin: -7px 0 0 -7px; border-radius: 50%; background: #22d3ee; animation: kh-ping 1.1s ease-out infinite; }
          .kh-chip { width: 1.5em; height: 1.5em; border-radius: 50%; display: grid; place-items: center;
            font-size: clamp(16px, 4.5vw, 26px); line-height: 1; color: #241b4b; border: 2px solid #fff;
            box-shadow: 0 3px 0 rgba(0,0,0,.25); animation: kh-pop .3s ease-out; }
          .kh-fly { position: absolute; left: 0; top: 0; display: none; place-items: center; line-height: 1; color: #241b4b;
            border-radius: 50%; border: 2px solid #fff; box-shadow: 0 3px 0 rgba(0,0,0,.25); pointer-events: none; z-index: 2; }
          .kh-status { min-height: 1.4em; font-weight: 800; margin: 0; }
          .kh-legend { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
          .kh-leg { padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.12); font-weight: 800; font-size: .9rem; }
          .kh-leg i { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 6px; }
          .kh-leg.out { opacity: .45; text-decoration: line-through; }
          .kh-sq.shake { animation: kh-shake .24s linear; }
          @keyframes kh-ping { 0% { box-shadow: 0 0 0 0 rgba(34,211,238,.8); } 100% { box-shadow: 0 0 0 16px rgba(34,211,238,0); } }
          @keyframes kh-pop { from { transform: scale(.3); opacity: 0; } to { transform: none; opacity: 1; } }
          @keyframes kh-shake { 25% { transform: translateX(-4px); } 75% { transform: translateX(4px); } }
        </style>
        <p class="g-sub">Jump like a chess knight onto squares nobody has touched. Land, then leave within ${LIFE_MS / 1000} seconds!</p>
        <div class="kh-wrap">
          <div class="kh-timer"><div class="kh-bar" id="kh-bar"></div></div>
          <div class="kh-board" id="kh-board"><div class="kh-fly" id="kh-fly">♞</div></div>
          <p class="kh-status" id="kh-status">Finding your square…</p>
          <div class="kh-legend" id="kh-legend"></div>
        </div>`;

      const boardEl = stage.querySelector('#kh-board');
      const flyer = stage.querySelector('#kh-fly');
      const barEl = stage.querySelector('#kh-bar');
      const statusEl = stage.querySelector('#kh-status');
      const legendEl = stage.querySelector('#kh-legend');
      const say = msg => { statusEl.textContent = msg; };

      const cells = [];
      for (let i = 0; i < N; i++) {
        const b = document.createElement('button');
        b.className = 'kh-sq';
        b.dataset.i = i;
        b.setAttribute('aria-label', `square ${i + 1}`);
        boardEl.appendChild(b);
        cells.push(b);
      }
      flyer.style.background = colorOf(me);

      // Squares a knight can jump to from square i: in bounds, and nobody has claimed them yet.
      const legalFrom = i => {
        const [r, c] = rc(i);
        return MOVES.map(([dr, dc]) => [r + dr, c + dc])
          .filter(([R, C]) => R >= 0 && R < SIZE && C >= 0 && C < SIZE)
          .map(([R, C]) => R * SIZE + C)
          .filter(j => !taken[j]);
      };

      // Another player counts as alive until their last move is older than LIFE + hop + grace.
      // Uses this device's clock only, so phone clocks that differ do not matter.
      const isAlive = id => {
        const p = pos[id];
        if (!p || p.dead) return false;
        return performance.now() - (seen[id] || 0) < LIFE_MS + HOP_MS + STALE_GRACE_MS;
      };

      const showFlyer = i => {
        const c = cells[i];
        flyer.style.width = `${c.offsetWidth}px`;
        flyer.style.height = `${c.offsetHeight}px`;
        flyer.style.fontSize = `${Math.round(c.offsetHeight * 0.5)}px`;
        flyer.style.display = 'grid';
      };
      const hideFlyer = () => { flyer.style.display = 'none'; };

      const hopFlyer = (from, to) => {
        showFlyer(from);
        const a = cells[from], b = cells[to];
        const frames = [];
        for (let s = 0; s <= HOP_FRAMES; s++) {
          const t = s / HOP_FRAMES, arc = Math.sin(Math.PI * t);
          const x = a.offsetLeft + (b.offsetLeft - a.offsetLeft) * t;
          const y = a.offsetTop + (b.offsetTop - a.offsetTop) * t - arc * HOP_LIFT_PX;
          frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 + arc * 0.28})` });
        }
        anim = flyer.animate(frames, { duration: HOP_MS, easing: 'linear' });
        return anim.finished.then(hideFlyer, hideFlyer);
      };

      const fall = i => {
        showFlyer(i);
        const c = cells[i];
        anim = flyer.animate([
          { transform: `translate(${c.offsetLeft}px, ${c.offsetTop}px)`, opacity: 1 },
          { transform: `translate(${c.offsetLeft - 3}px, ${c.offsetTop + 60}px) rotate(-12deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(${c.offsetLeft}px, ${c.offsetTop + 260}px) rotate(60deg)`, opacity: 0 },
        ], { duration: FALL_MS, easing: 'ease-in', fill: 'forwards' });
      };

      const shake = el => {
        api.sfx('tick');
        el.animate([
          { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' },
        ], { duration: SHAKE_MS });
      };

      // Redraw every square: taken/crumbled look, legal-move dots, and the knights standing on it.
      const paint = () => {
        if (stopped) return;
        lastPaint = performance.now();
        const ids = Object.keys(room.players);
        const chips = Array.from({ length: N }, () => []);
        const crumbled = new Set();

        ids.forEach(id => {
          if (id === me) {
            if (myIndex < 0) return;
            if (over) crumbled.add(myIndex);
            else if (!hopping) chips[myIndex].push(id);
            return;
          }
          const p = pos[id];
          if (!p) return;
          if (isAlive(id)) chips[p.i].push(id);
          else crumbled.add(p.i);
        });

        const legal = new Set(myIndex >= 0 && !hopping && !over ? legalFrom(myIndex) : []);

        cells.forEach((cell, i) => {
          const cls = ['kh-sq'];
          if (crumbled.has(i)) cls.push('gone');
          else if (taken[i]) cls.push('taken');
          if (legal.has(i)) cls.push('legal');
          if (i === myIndex && !over) cls.push('mine');
          cell.className = cls.join(' ');

          const html = chips[i].map(id => `<span class="kh-chip" style="background:${colorOf(id)}">♞</span>`).join('');
          if (cell.dataset.h !== html) {
            cell.dataset.h = html;
            cell.innerHTML = html;
          }
        });

        legendEl.innerHTML = ids.map(id => {
          const alive = id === me ? (!over && myIndex >= 0) : isAlive(id);
          return `<span class="kh-leg ${alive ? '' : 'out'}"><i style="background:${colorOf(id)}"></i>${esc(nameOf(id))}${id === me ? ' (you)' : ''}</span>`;
        }).join('');
      };

      const die = () => {
        over = true;
        const score = Math.floor((performance.now() - t0) / SCORE_UNIT_MS);
        api.setScore(score);
        api.sfx('bad');
        room.set(`pos/${me}`, { i: myIndex, dead: true }).catch(() => {});
        fall(myIndex);
        const r = cells[myIndex].getBoundingClientRect();
        api.burst(r.left + r.width / 2, r.top + r.height / 2, 40);
        say('Fell off! Your time is saved.');
        paint();
        deathTimer = setTimeout(() => api.finish(), DEATH_PAUSE_MS);
      };

      const landed = to => {
        const r = cells[to].getBoundingClientRect();
        api.burst(r.left + r.width / 2, r.top + r.height * 0.85, 14);
        cells[to].animate([
          { transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' },
        ], { duration: 240 });
        say(legalFrom(to).length ? '' : 'No moves left. Wait for your square to crumble.');
      };

      const jump = async to => {
        if (hopping || over || myIndex < 0 || stopped) return;
        const from = myIndex;
        hopping = true;
        api.sfx('tap');

        // Claim the square first. If someone got it a moment earlier, the database refuses.
        try {
          await room.set(`visited/${to}`, me);
        } catch (e) {
          hopping = false;
          shake(cells[to]);
          return paint();
        }
        if (stopped) return;

        taken[to] = me;
        myIndex = to;
        room.set(`pos/${me}`, { i: to, dead: false }).catch(() => {});
        paint();

        await hopFlyer(from, to);
        if (stopped || over) return;

        hopping = false;
        landAt = performance.now();
        landed(to);
        paint();
      };

      // Find a free square for my knight. Others may claim squares at the same time, so
      // a rejected claim just means try another one.
      const claimStart = async () => {
        for (let t = 0; t < CLAIM_TRIES && !stopped; t++) {
          const free = [];
          for (let i = 0; i < N; i++) if (!taken[i]) free.push(i);
          if (!free.length) break;
          const i = free[Math.floor(Math.random() * free.length)];
          try {
            await room.set(`visited/${i}`, me);
            taken[i] = me;
            return i;
          } catch (e) { /* someone claimed it first: pick again */ }
        }
        return -1;
      };

      (async () => {
        const i = await claimStart();
        if (stopped) return;
        if (i < 0) return say('No free square left. Watch the board.');
        myIndex = i;
        landAt = performance.now() + START_DELAY_MS;
        room.set(`pos/${me}`, { i, dead: false }).catch(() => {});
        say('Hop onto a fresh square!');
        paint();
      })();

      const onClick = e => {
        const b = e.target.closest('.kh-sq');
        if (!b || over || hopping || myIndex < 0) return;
        const j = Number(b.dataset.i);
        if (!legalFrom(myIndex).includes(j)) return shake(b);
        jump(j);
      };
      boardEl.addEventListener('click', onClick);

      const tick = now => {
        if (stopped) return;
        if (!over) {
          if (myIndex >= 0 && !hopping && landAt) {
            const left = LIFE_MS - (now - landAt);
            if (left <= 0) die();
            else {
              barEl.style.transform = `scaleX(${Math.min(1, left / LIFE_MS)})`;
              barEl.classList.toggle('warn', left < WARN_MS);
            }
          }
          if (!over) {
            const score = Math.floor((now - t0) / SCORE_UNIT_MS);
            if (score !== lastScore) { lastScore = score; api.setScore(score); }
          }
        }
        if (now - lastPaint >= REPAINT_MS) paint();
        raf = requestAnimationFrame(tick);
      };

      api.onStop(room.on('visited', v => { taken = v || {}; paint(); }));

      api.onStop(room.on('pos', v => {
        const next = v || {};
        Object.keys(next).forEach(id => {
          const old = pos[id], now = next[id];
          if (!old || old.i !== now.i || !!old.dead !== !!now.dead) seen[id] = performance.now();
        });
        pos = next;
        paint();
      }));

      api.onStop(() => {
        stopped = true;
        over = true;
        cancelAnimationFrame(raf);
        clearTimeout(deathTimer);
        if (anim) anim.cancel();
        boardEl.removeEventListener('click', onClick);
      });

      paint();
      raf = requestAnimationFrame(tick);
    },
  });
})();
