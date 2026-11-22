/* Odd One Out: tap the emoji that doesn't match. Score = correct taps. */
(() => {
  const SETS = ['🍎','🍌','🍇','🍓','🍒','🍑','🍍','🥝','🍉','🥕','🌽','🍆','🍄','🥦','🌶️','🥑'];

  BrawlBox.registerGame('odd-one-out', {
    start(stage, api) {
      const { rnd } = BrawlBox.util;
      let score = 0;
      stage.innerHTML = `<p class="g-rule">Tap the one that is different!</p><div class="g-grid" id="og-grid"></div>`;
      const grid = stage.querySelector('#og-grid');

      const round = () => {
        grid.innerHTML = '';
        const base = rnd(SETS);
        let odd; do { odd = rnd(SETS); } while (odd === base);
        const oddIdx = Math.floor(Math.random() * 9);
        for (let i = 0; i < 9; i++) {
          const b = document.createElement('button');
          b.className = 'g-tile';
          b.textContent = i === oddIdx ? odd : base;
          b.onclick = (e) => {
            if (i === oddIdx) {
              score++; api.setScore(score); api.sfx('good'); api.burst(e.clientX, e.clientY); round();
            } else {
              api.sfx('bad');
              b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
            }
          };
          grid.appendChild(b);
        }
      };
      round();
    },
  });
})();
