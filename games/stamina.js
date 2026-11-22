/* Sprint Stamina: each tap pushes you forward. A full bar pushes harder, and
   every tap costs stamina. Stamina refills only when you pause for a moment.
   Score = distance covered. */
(() => {
  const MAX = 100, COST = 8, REGEN = 30, PAUSE = 0.35;

  BrawlBox.registerGame('stamina', {
    start(stage, api) {
      let st = MAX, dist = 0, idle = 0, last = performance.now(), raf = 0;

      stage.innerHTML = `
        <style>
          .sp-feed { font-size: 2rem; font-weight: 900; min-height: 2.6rem; }
          .sp-track { position: relative; width: min(92vw, 560px); height: 70px; border-radius: 22px;
            background: rgba(255,255,255,.1); overflow: hidden; }
          .sp-runner { position: absolute; top: 50%; font-size: 46px; line-height: 1; transform: translateY(-50%);
            transition: left .15s linear; }
          .sp-meter { width: min(92vw, 560px); height: 28px; border-radius: 16px; background: rgba(255,255,255,.12); overflow: hidden; }
          .sp-fill { height: 100%; width: 100%; background: #4ade80; transition: background .2s; }
          .sp-btn { font: inherit; font-size: 1.8rem; font-weight: 900; width: min(80vw, 320px); height: 110px; border: 0;
            border-radius: 28px; color: #241b4b; background: #fb923c; cursor: pointer; box-shadow: 0 10px 0 #c2410c;
            touch-action: none; user-select: none; }
          .sp-btn:active { transform: translateY(6px); box-shadow: 0 4px 0 #c2410c; }
        </style>
        <p class="g-rule">Tap to push! Pause to catch your breath.</p>
        <div class="sp-feed" id="sp-feed">&nbsp;</div>
        <div class="sp-track"><div class="sp-runner" id="sp-runner">🏃</div></div>
        <p class="g-sub">Stamina</p>
        <div class="sp-meter"><div class="sp-fill" id="sp-fill"></div></div>
        <button class="sp-btn" id="sp-btn">PUSH! 💨</button>`;

      const $ = s => stage.querySelector(s);
      const runner = $('#sp-runner'), fill = $('#sp-fill'), feed = $('#sp-feed'), btn = $('#sp-btn');

      const say = (text, color) => {
        feed.textContent = text;
        feed.style.color = color;
        feed.animate([{ transform: 'scale(.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }],
          { duration: 220, easing: 'ease-out' });
      };

      const frame = now => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        idle += dt;
        if (idle > PAUSE) st = Math.min(MAX, st + REGEN * dt);   // refill only after a pause
        fill.style.width = st + '%';
        fill.style.background = st > 50 ? '#4ade80' : st > 20 ? '#fbbf24' : '#ef4444';
        runner.style.left = ((dist % 100) * 0.88) + '%';
        raf = requestAnimationFrame(frame);
      };

      btn.onpointerdown = (e) => {
        idle = 0;
        let gain;
        if (st >= COST) {
          gain = 2 + (st / MAX) * 7;                 // a full bar pushes hardest
          st -= COST;
          api.sfx('tick');
          say(`+${Math.round(gain)}`, '#ffd23f');
        } else {
          gain = 0.5;                                // exhausted: almost no push
          st = 0;
          api.sfx('bad');
          say('Exhausted! 😮‍💨', '#ef4444');
        }
        dist += gain;
        api.setScore(Math.floor(dist));
        api.burst(e.clientX, e.clientY, 8);
      };

      raf = requestAnimationFrame(frame);
      api.onStop(() => cancelAnimationFrame(raf));
    },
  });
})();