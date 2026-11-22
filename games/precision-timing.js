/* Perfect Stop: a marker sweeps back and forth. Tap while it is inside the green
   zone. Each pass can score only once, so spamming doesn't work. Closer to the
   center = more points. The zone shrinks and the marker speeds up after each hit.
   Score = total points. */
(() => {
  BrawlBox.registerGame('precision-timing', {
    start(stage, api) {
      let score = 0, phase = 0, speed = 0.6, hw = 0.11, c = 0.5;
      let p = 0, armed = true, last = performance.now(), raf = 0;

      stage.innerHTML = `
        <style>
          .pt-feed { font-size: 2rem; font-weight: 900; min-height: 2.6rem; }
          .pt-bar { position: relative; width: min(90vw, 620px); height: 90px; border-radius: 24px;
            background: rgba(255,255,255,.12); overflow: hidden; }
          .pt-zone { position: absolute; top: 0; bottom: 0; background: #4ade80; box-shadow: 0 0 24px #4ade80; }
          .pt-mark { position: absolute; top: -8px; bottom: -8px; width: 10px; margin-left: -5px; border-radius: 6px;
            background: #fff; box-shadow: 0 0 12px #fff; }
          .pt-btn { font: inherit; font-size: 1.8rem; font-weight: 900; width: min(80vw, 320px); height: 110px; border: 0;
            border-radius: 28px; color: #241b4b; background: #22d3ee; cursor: pointer; box-shadow: 0 10px 0 #0e7490;
            touch-action: none; user-select: none; }
          .pt-btn:active { transform: translateY(6px); box-shadow: 0 4px 0 #0e7490; }
        </style>
        <p class="g-rule">Stop the marker inside the green!</p>
        <div class="pt-feed" id="pt-feed">&nbsp;</div>
        <div class="pt-bar"><div class="pt-zone" id="pt-zone"></div><div class="pt-mark" id="pt-mark"></div></div>
        <button class="pt-btn" id="pt-btn">STOP ✋</button>`;

      const $ = s => stage.querySelector(s);
      const zone = $('#pt-zone'), mark = $('#pt-mark'), feed = $('#pt-feed'), btn = $('#pt-btn');

      const placeZone = () => {
        zone.style.left = ((c - hw) * 100) + '%';
        zone.style.width = (hw * 200) + '%';
      };

      const say = (text, color) => {
        feed.textContent = text;
        feed.style.color = color;
        feed.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 260, easing: 'ease-out' });
      };

      const frame = now => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        phase = (phase + speed * dt) % 1;
        p = phase < 0.5 ? phase * 2 : (1 - phase) * 2;     // triangle wave 0 → 1 → 0
        mark.style.left = (p * 100) + '%';
        if (Math.abs(p - c) > hw) armed = true;             // re-arm once the marker leaves the zone
        raf = requestAnimationFrame(frame);
      };

      btn.onpointerdown = (e) => {
        const d = Math.abs(p - c);
        if (d <= hw && armed) {
          const acc = 1 - d / hw;                           // 1 = dead center
          const pts = 10 + Math.round(90 * acc);
          score += pts;
          api.setScore(score);
          api.sfx('good');
          api.burst(e.clientX, e.clientY, 30);
          say(acc > 0.85 ? `PERFECT! +${pts}` : `Nice! +${pts}`, '#4ade80');
          armed = false;
          speed = Math.min(1.6, speed + 0.05);
          hw = Math.max(0.035, hw - 0.006);
          c = 0.15 + Math.random() * 0.7;
          placeZone();
        } else {
          api.sfx('bad');
          say(d <= hw ? 'Already used!' : 'Miss!', '#ef4444');
        }
      };

      placeZone();
      raf = requestAnimationFrame(frame);
      api.onStop(() => cancelAnimationFrame(raf));
    },
  });
})();