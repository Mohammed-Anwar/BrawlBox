/* Knight Hop: a 5x5 board. You are a chess knight. Jump in L-shapes onto a square you have never landed on.
   A square you leave can't be used again. The square you stand on crumbles 3 seconds after you land,
   so you must jump in time. Score = deciseconds alive. Solo. */
(() => {
  const SIZE = 5, N = SIZE * SIZE;
  const LIFE = 3000;
  const HOP = 360;
  const MOVES = [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]];

  BrawlBox.registerGame('knight-hop', {
    start(stage, api) {
      stage.innerHTML = `
        <style>
          .kh-wrap { position: relative; width: min(92vw, 380px); }
          .kh-board { display: grid; grid-template-columns: repeat(${SIZE}, 1fr); gap: 6px; }
          .kh-sq {
            position: relative; aspect-ratio: 1; padding: 0; border: 0; border-radius: 14px;
            background: #fff; box-shadow: 0 4px 0 #c4b5fd; cursor: pointer; -webkit-tap-highlight-color: transparent;
          }
          .kh-sq.used { background: #3b3a66; box-shadow: none; cursor: default;
            transition: background-color .35s ease, box-shadow .35s ease; }
          .kh-sq.gone { background: transparent; box-shadow: inset 0 0 0 2px rgba(255,255,255,.1); cursor: default; }
          .kh-sq.current { background: #ffd23f; box-shadow: 0 4px 0 #b45309; cursor: default; }
          .kh-sq.warn { animation: kh-shake .14s linear infinite; }
          .kh-sq.legal::after {
            content: ''; position: absolute; left: 50%; top: 50%; width: 14px; height: 14px;
            margin: -7px 0 0 -7px; border-radius: 50%; background: #22d3ee;
            animation: kh-ping 1.1s ease-out infinite;
          }
          .kh-knight {
            position: absolute; left: 0; top: 0; display: flex; align-items: center; justify-content: center;
            color: #241b4b; line-height: 1; pointer-events: none; transform-origin: 50% 60%; will-change: transform;
          }
          @keyframes kh-ping { 0% { box-shadow: 0 0 0 0 rgba(34,211,238,.8); } 100% { box-shadow: 0 0 0 16px rgba(34,211,238,0); } }
          @keyframes kh-shake {
            25% { transform: translate(-2px, 1px); } 50% { transform: translate(2px, -1px); } 75% { transform: translate(-1px, -2px); }
          }
        </style>
        <p class="g-sub">Jump like a chess knight onto fresh squares. The square you land on crumbles in 3 seconds!</p>
        <div class="kh-wrap" id="kh-wrap">
          <div class="kh-board" id="kh-board"></div>
          <div class="kh-knight" id="kh-knight">♞</div>
        </div>`;

      const wrap = stage.querySelector('#kh-wrap');
      const boardEl = stage.querySelector('#kh-board');
      const knightEl = stage.querySelector('#kh-knight');
      const cells = [];
      for (let i = 0; i < N; i++) {
        const b = document.createElement('button');
        b.className = 'kh-sq'; b.dataset.i = i;
        b.setAttribute('aria-label', `square ${i + 1}`);
        boardEl.appendChild(b); cells.push(b);
      }

      const state = Array(N).fill('fresh');
      const rc = i => [Math.floor(i / SIZE), i % SIZE];
      const legalFrom = i => {
        const [r, c] = rc(i);
        return MOVES.map(([dr, dc]) => [r + dr, c + dc])
          .filter(([R, C]) => R >= 0 && R < SIZE && C >= 0 && C < SIZE)
          .map(([R, C]) => R * SIZE + C)
          .filter(j => state[j] === 'fresh');
      };

      const center = i => ({ x: cells[i].offsetLeft, y: cells[i].offsetTop, w: cells[i].offsetWidth, h: cells[i].offsetHeight });
      const placeKnight = i => {
        const p = center(i);
        knightEl.style.width = `${p.w}px`; knightEl.style.height = `${p.h}px`;
        knightEl.style.fontSize = `${Math.round(p.h * 0.62)}px`;
        knightEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
      };

      let knight = Math.floor(Math.random() * N);
      state[knight] = 'current';
      const t0 = performance.now();
      let landAt = t0 + 350;
      let over = false, hopping = false, raf = 0, lastScore = -1, deathTimer = 0;

      const paint = () => {
        const legal = new Set(over || hopping ? [] : legalFrom(knight));
        cells.forEach((b, i) => {
          b.className = `kh-sq ${state[i]}`;
          b.style.background = '';
          if (legal.has(i)) b.classList.add('legal');
        });
      };

      const land = to => {
        hopping = false;
        if (over) return;
        const p = center(to);
        knightEl.animate([
          { transform: `translate(${p.x}px, ${p.y}px) scale(1.16, 0.84)` },
          { transform: `translate(${p.x}px, ${p.y}px) scale(1)` },
        ], { duration: 200, easing: 'ease-out' });
        cells[to].animate([
          { transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' },
        ], { duration: 240 });
        const r = cells[to].getBoundingClientRect();
        api.burst(r.left + r.width / 2, r.top + r.height * 0.85, 14);
        paint();
      };

      const hop = (from, to) => {
        const a = center(from), b = center(to);
        const dist = Math.hypot(b.x - a.x, b.y - a.y);
        const lift = 26 + dist * 0.25;
        const frames = [];
        for (let s = 0; s <= 12; s++) {
          const t = s / 12, arc = Math.sin(Math.PI * t);
          const x = a.x + (b.x - a.x) * t;
          const y = a.y + (b.y - a.y) * t - arc * lift;
          frames.push({ transform: `translate(${x}px, ${y}px) scale(${1 + arc * 0.28})` });
        }
        placeKnight(to);
        const anim = knightEl.animate(frames, { duration: HOP, easing: 'linear' });
        anim.onfinish = () => land(to);
      };

      const jump = to => {
        const from = knight;
        knight = to; state[from] = 'used'; state[to] = 'current';
        hopping = true; landAt = performance.now() + HOP;
        cells[from].animate([
          { transform: 'scale(1)' }, { transform: 'scale(0.9)', offset: 0.4 }, { transform: 'scale(1)' },
        ], { duration: 320, easing: 'ease-in' });
        api.sfx('tap'); paint(); hop(from, to);
      };

      const die = () => {
        over = true;
        const id = knight;
        state[id] = 'gone';
        api.setScore(Math.floor((performance.now() - t0) / 100)); api.sfx('bad');
        cells[id].animate([
          { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
          { transform: 'translate(-3px, 4px) rotate(-3deg)', opacity: 1, offset: 0.25 },
          { transform: 'translate(3px, 6px) rotate(3deg)', opacity: 1, offset: 0.45 },
          { transform: 'translateY(180px) rotate(20deg)', opacity: 0 },
        ], { duration: 620, easing: 'ease-in', fill: 'forwards' });
        const base = knightEl.style.transform;
        knightEl.animate([
          { transform: base, opacity: 1 },
          { transform: `${base} translateY(60px) rotate(-10deg)`, opacity: 1, offset: 0.35 },
          { transform: `${base} translateY(260px) rotate(60deg)`, opacity: 0 },
        ], { duration: 620, easing: 'ease-in', fill: 'forwards' });
        const r = cells[id].getBoundingClientRect(); api.burst(r.left + r.width / 2, r.top + r.height / 2, 40);
        paint(); deathTimer = setTimeout(() => api.finish(), 700);
      };

      const tick = now => {
        if (over) return;
        if (!hopping && now >= landAt) {
          const left = LIFE - (now - landAt);
          if (left <= 0) return die();
          const f = left / LIFE, cur = cells[knight];
          cur.style.background = `hsl(${Math.round(48 * f)} 95% ${58 + 4 * f}%)`;
          cur.classList.toggle('warn', left < 1000);
        }
        const score = Math.floor((now - t0) / 100);
        if (score !== lastScore) { lastScore = score; api.setScore(score); }
        raf = requestAnimationFrame(tick);
      };

      const shake = el => el.animate([
        { transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' },
      ], { duration: 240 });

      const onClick = e => {
        const b = e.target.closest('.kh-sq');
        if (!b || over) return;
        const j = Number(b.dataset.i);
        if (hopping || !legalFrom(knight).includes(j)) { shake(b); return; }
        jump(j);
      };

      const onResize = () => { if (!hopping) placeKnight(knight); };

      boardEl.addEventListener('click', onClick);
      window.addEventListener('resize', onResize);
      api.onStop(() => {
        over = true; cancelAnimationFrame(raf); clearTimeout(deathTimer);
        boardEl.removeEventListener('click', onClick); window.removeEventListener('resize', onResize);
      });

      placeKnight(knight);
      const start = center(knight);
      knightEl.animate([
        { opacity: 0, transform: `translate(${start.x}px, ${start.y - 50}px)` },
        { opacity: 1, transform: `translate(${start.x}px, ${start.y}px)` },
      ], { duration: 350, easing: 'ease-out' });
      paint(); raf = requestAnimationFrame(tick);
    },
  });
})();
