/* Tower Rush: shared. Tap to drop a rock onto YOUR tower. Score = rocks in your tower.
   Clouds drift in the background and move slower than the towers, so climbing is easy to see.
   The camera follows your tower. Taller towers show a ▲ count at the top edge. */
(() => {
  // ---- Tuning (change these) ----
  const W = 480, H = 500;            // canvas size in pixels
  const ROCK_H = 22;                 // height of one rock
  const ROCK_WIDTH_SHARE = 0.7;      // rock width as a share of its lane
  const GROUND_Y = 440;              // world y of the ground line
  const VIEW_TOP = 130;              // screen y where your tower top sits once the camera follows it
  const DROP_MS = 180;               // time for a new rock to land
  const DROP_FROM = 60;              // px above its spot where a new rock starts
  const CLOUD_COUNT = 26;            // clouds spread over the climb
  const CLOUD_SPAN = 2400;           // how high (px) the clouds are spread
  const CLOUD_PARALLAX = 0.45;       // 0 = clouds stay still, 1 = clouds move with the towers
  const CLOUD_DRIFT = 6;             // px per second sideways
  const SKY_TOP = '#312e81';         // sky color at the top of the canvas
  const SKY_BOTTOM = '#7dd3fc';      // sky color at the bottom of the canvas

  const TAU = Math.PI * 2;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BrawlBox.registerGame('tower-rush', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const ids = Object.keys(room.players);
      const laneW = W / ids.length;
      const topWorld = h => GROUND_Y - h * ROCK_H;

      let mine = 0, others = {}, dropAt = -1e9, myTopScreen = H;
      let lastLegend = '', raf = 0, dead = false;

      // Clouds: "a" is altitude above the ground. Screen y = GROUND_Y - a - cam * CLOUD_PARALLAX.
      const clouds = Array.from({ length: CLOUD_COUNT }, () => ({
        a: Math.random() * CLOUD_SPAN,
        x: Math.random() * W,
        s: 0.7 + Math.random() * 0.8,
      }));

      stage.innerHTML = `
        <style>
          .tr-canvas { width: min(92vw, ${W}px); height: auto; border-radius: 22px; touch-action: manipulation; }
          .tr-legend { width: min(92vw, ${W}px); display: grid; grid-template-columns: repeat(${ids.length}, 1fr); gap: 4px; }
          .tr-chip { font-size: .85rem; font-weight: 800; padding: 6px 2px; border-radius: 10px; color: #241b4b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .tr-chip.me { outline: 2px solid #fff; }
          .tr-drop { font: inherit; font-size: 1.3rem; font-weight: 900; width: min(92vw, 340px); padding: 18px; border: 0; border-radius: 20px;
            background: #ffd23f; color: #241b4b; box-shadow: 0 6px 0 #b45309; touch-action: manipulation; }
          .tr-drop:active { transform: translateY(4px); box-shadow: 0 2px 0 #b45309; }
        </style>
        <p class="g-sub">Tap to drop a rock on your tower. The camera follows your tower.</p>
        <canvas class="tr-canvas" id="tr-cv" width="${W}" height="${H}"></canvas>
        <div class="tr-legend" id="tr-legend"></div>
        <button class="tr-drop" id="tr-drop">🪨 Drop a rock</button>`;

      const cv = stage.querySelector('#tr-cv');
      const ctx = cv.getContext('2d');
      const legendEl = stage.querySelector('#tr-legend');
      const dropBtn = stage.querySelector('#tr-drop');

      const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
      skyGrad.addColorStop(0, SKY_TOP);
      skyGrad.addColorStop(1, SKY_BOTTOM);

      function drawCloud(x, y, s) {
        ctx.fillStyle = 'rgba(255,255,255,.88)';
        ctx.beginPath();
        ctx.arc(x, y, 18 * s, 0, TAU);
        ctx.arc(x + 22 * s, y - 8 * s, 24 * s, 0, TAU);
        ctx.arc(x + 48 * s, y, 18 * s, 0, TAU);
        ctx.arc(x + 24 * s, y + 6 * s, 20 * s, 0, TAU);
        ctx.fill();
      }

      function drawClouds(now, cam) {
        const t = now / 1000;
        for (const c of clouds) {
          const y = GROUND_Y - c.a - cam * CLOUD_PARALLAX;
          if (y < -60 || y > H + 60) continue;
          // wrap sideways so clouds keep drifting across the canvas
          const x = ((c.x + t * CLOUD_DRIFT) % (W + 120)) - 60;
          drawCloud(x, y, c.s);
        }
      }

      function drop() {
        if (dead) return;
        mine++;
        dropAt = performance.now();
        api.setScore(mine);
        api.sfx('tap');
        const r = cv.getBoundingClientRect();
        const laneX = (ids.indexOf(me) + 0.5) * laneW;
        api.burst(r.left + laneX * r.width / W, r.top + myTopScreen * r.height / H);
      }

      function updateLegend() {
        const counts = ids.map(id => (id === me ? mine : (others[id] || 0)));
        const key = counts.join(',');
        if (key === lastLegend) return;
        lastLegend = key;
        legendEl.innerHTML = ids.map((id, i) => `
          <span class="tr-chip ${id === me ? 'me' : ''}" style="background:${room.players[id].color || '#ccc'}">
            ${esc(room.players[id].name)}: ${counts[i]}</span>`).join('');
      }

      function frame(now) {
        if (dead) return;
        const cam = Math.min(0, topWorld(mine) - VIEW_TOP);   // screen y = world y - cam
        myTopScreen = topWorld(mine) - cam;

        // Sky and clouds (behind everything)
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, W, H);
        drawClouds(now, cam);

        // Ground line
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.fillRect(0, GROUND_Y - cam, W, 4);

        ids.forEach((id, i) => {
          const h = id === me ? mine : (others[id] || 0);
          const color = room.players[id].color || '#cccccc';
          const cx = (i + 0.5) * laneW;
          const rw = laneW * ROCK_WIDTH_SHARE;

          if (id === me) {
            ctx.fillStyle = 'rgba(255,255,255,.12)';
            ctx.fillRect(i * laneW, 0, laneW, H);
          }

          ctx.fillStyle = color;
          for (let k = 0; k < h; k++) {
            let y = GROUND_Y - (k + 1) * ROCK_H - cam;
            if (id === me && k === h - 1) {                    // the newest rock drops in
              const t = Math.min(1, (now - dropAt) / DROP_MS);
              y -= DROP_FROM * (1 - t) * (1 - t);
            }
            if (y > H || y + ROCK_H < 0) continue;
            ctx.fillRect(cx - rw / 2, y, rw, ROCK_H - 3);
          }

          // Tower goes above the screen: show how many rocks it has up there
          if (h > 0 && topWorld(h) - cam < 0) {
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#241b4b';
            ctx.strokeText(`▲ ${h}`, cx, 16);
            ctx.fillStyle = color;
            ctx.fillText(`▲ ${h}`, cx, 16);
          }
        });

        updateLegend();
        if (!dead) raf = requestAnimationFrame(frame);
      }

      api.onStop(room.on('scores', v => { others = v || {}; }));

      cv.addEventListener('pointerdown', drop);
      dropBtn.onclick = drop;
      const onKey = e => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); drop(); } };
      window.addEventListener('keydown', onKey);

      api.onStop(() => {
        dead = true;
        cancelAnimationFrame(raf);
        cv.removeEventListener('pointerdown', drop);
        window.removeEventListener('keydown', onKey);
      });

      raf = requestAnimationFrame(frame);
    },
  });
})();