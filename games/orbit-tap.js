/* Orbit Tap: a bar sweeps around a ring. Every tap reverses it.
   A tap while the bar is inside a green arc scores 1 point, and that arc jumps to a new place.
   Every correct tap makes the bar faster (capped). Solo. */
(() => {
  const TAU = Math.PI * 2;
  const ARC = 0.5;
  const SIZE = 320;
  const C = SIZE / 2, R = SIZE / 2 - 24;
  const BASE_SPEED = 2;
  const SPEED_STEP = 0.45;
  const MAX_SPEED = 10;
  const norm = a => ((a % TAU) + TAU) % TAU;
  const inArc = (a, start) => norm(a - start) <= ARC;
  const randAngle = () => Math.random() * TAU;

  const placeArc = avoid => {
    for (let k = 0; k < 30; k++) {
      const s = randAngle();
      const gap = Math.min(norm(s - avoid), norm(avoid - s));
      if (gap > ARC + 0.5) return s;
    }
    return norm(avoid + Math.PI);
  };

  BrawlBox.registerGame('orbit-tap', {
    start(stage, api) {
      stage.innerHTML = `
        <style>
          .ot-canvas { width: min(86vw, ${SIZE}px); height: auto; aspect-ratio: 1; touch-action: none; cursor: pointer; }
          .ot-score { font-size: 2.4rem; font-weight: 900; color: var(--yellow); margin: 0; }
          .ot-speed { font-weight: 800; margin: 0; opacity: .8; }
        </style>
        <p class="g-sub">Tap to flip the bar. Hit the green arcs for points!</p>
        <p class="ot-score" id="ot-score">0</p>
        <p class="ot-speed" id="ot-speed">Speed 1.0x</p>
        <canvas class="ot-canvas" id="ot-cv" width="${SIZE}" height="${SIZE}"></canvas>`;

      const cv = stage.querySelector('#ot-cv');
      const scoreEl = stage.querySelector('#ot-score');
      const speedEl = stage.querySelector('#ot-speed');
      const ctx = cv.getContext('2d');
      let angle = randAngle(), dir = 1, score = 0, hits = 0, last = performance.now(), raf = 0;
      let arcs = [placeArc(angle), placeArc(angle)];

      const speed = () => Math.min(MAX_SPEED, BASE_SPEED + hits * SPEED_STEP);

      const draw = () => {
        ctx.clearRect(0, 0, SIZE, SIZE);
        ctx.lineCap = 'butt'; ctx.lineWidth = 22;
        ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(C, C, R, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#4ade80';
        arcs.forEach(s => { ctx.beginPath(); ctx.arc(C, C, R, s, s + ARC); ctx.stroke(); });
        ctx.lineCap = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#ff4d8d'; ctx.beginPath();
        ctx.moveTo(C, C); ctx.lineTo(C + Math.cos(angle) * (R + 6), C + Math.sin(angle) * (R + 6)); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(C, C, 8, 0, TAU); ctx.fill();
      };

      const onTap = () => {
        const hit = arcs.findIndex(s => inArc(angle, s));
        dir = -dir;
        if (hit >= 0) {
          score++; hits++;
          scoreEl.textContent = score;
          speedEl.textContent = `Speed ${(speed() / BASE_SPEED).toFixed(1)}x`;
          api.setScore(score); api.sfx('good'); arcs[hit] = placeArc(angle);
          const r = cv.getBoundingClientRect(), k = r.width / SIZE;
          api.burst(r.left + (C + Math.cos(angle) * R) * k, r.top + (C + Math.sin(angle) * R) * k, 24);
        } else api.sfx('tap');
      };

      const frame = now => {
        const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
        last = now;
        angle = norm(angle + dir * speed() * dt);
        draw(); raf = requestAnimationFrame(frame);
      };

      cv.addEventListener('pointerdown', onTap);
      api.onStop(() => { cancelAnimationFrame(raf); cv.removeEventListener('pointerdown', onTap); });
      raf = requestAnimationFrame(frame);
    },
  });
})();
