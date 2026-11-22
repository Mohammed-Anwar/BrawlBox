/* Catch It: tap the falling good items, avoid the bombs. Score = points, bombs cost 5. */
(() => {
  const GOOD = [
    { icon: '🍎', pts: 10 }, { icon: '⭐', pts: 15 }, { icon: '💎', pts: 25 },
  ];
  const BAD = [{ icon: '💣', pts: -5 }];

  BrawlBox.registerGame('catch-falling', {
    start(stage, api) {
      const { rnd } = BrawlBox.util;
      let score = 0;
      let items = [];

      stage.innerHTML = `
        <style>
          .cf-field { position: relative; width: min(92vw, 560px); height: 420px; border-radius: 24px;
            background: rgba(255,255,255,.06); overflow: hidden; touch-action: none; }
          .cf-item { position: absolute; top: -60px; font-size: 40px; border: 0; background: none;
            cursor: pointer; user-select: none; }
        </style>
        <p class="g-rule">Tap the good ones, avoid the bombs!</p>
        <div class="cf-field" id="cf-field"></div>`;
      const field = stage.querySelector('#cf-field');

      const spawn = setInterval(() => {
        const pick = Math.random() < 0.3 ? rnd(BAD) : rnd(GOOD);
        const el = document.createElement('button');
        el.className = 'cf-item';
        el.textContent = pick.icon;
        el.style.left = (Math.random() * 88) + '%';
        const it = { el, pick, y: -50, v: 1.5 + Math.random() * 2.5, alive: true };
        el.onpointerdown = (e) => {
          if (!it.alive) return;
          it.alive = false;
          el.remove();
          if (pick.pts > 0) {
            score += pick.pts;
            api.sfx('good');
            api.burst(e.clientX, e.clientY);
          } else {
            score = Math.max(0, score + pick.pts);
            api.sfx('bad');
          }
          api.setScore(score);
        };
        field.appendChild(el);
        items.push(it);
      }, 450);

      const step = setInterval(() => {
        const H = field.clientHeight;
        items = items.filter(it => {
          if (!it.alive) return false;
          it.y += it.v;
          it.el.style.top = it.y + 'px';
          if (it.y > H) { it.alive = false; it.el.remove(); return false; }
          return true;
        });
      }, 16);

      api.onStop(() => { clearInterval(spawn); clearInterval(step); });
    },
  });
})();
