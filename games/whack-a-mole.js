/* Mole Whack: whack the moles before they hide. Score = moles hit. */
(() => {
  BrawlBox.registerGame('whack-a-mole', {
    start(stage, api) {
      let score = 0;
      stage.innerHTML = `<p class="g-rule">Whack every mole that pops up! 🔨</p><div class="g-grid" id="wm-grid"></div>`;
      const grid = stage.querySelector('#wm-grid');
      const holes = Array.from({ length: 9 }, () => {
        const h = document.createElement('div');
        h.className = 'g-hole';
        grid.appendChild(h);
        return h;
      });

      const timers = [];
      const spawn = setInterval(() => {
        const free = holes.filter(h => !h.firstChild);
        if (!free.length) return;
        const hole = free[Math.floor(Math.random() * free.length)];
        const m = document.createElement('button');
        m.className = 'g-mole';
        m.textContent = '🐹';
        m.onclick = (e) => {
          if (m.dataset.hit) return;
          m.dataset.hit = '1';
          score++;
          api.setScore(score);
          api.sfx('pop');
          api.burst(e.clientX, e.clientY);
          m.textContent = '💥';
        };
        hole.appendChild(m);
        timers.push(setTimeout(() => m.remove(), 900));
      }, 650);

      api.onStop(() => {
        clearInterval(spawn);
        timers.forEach(t => clearTimeout(t));
      });
    },
  });
})();
