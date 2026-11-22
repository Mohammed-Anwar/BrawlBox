/* Color Clash: tap the INK color, not the word. Score = correct answers. */
(() => {
  const COLORS = [
    { name: 'RED',    css: '#ef4444' },
    { name: 'BLUE',   css: '#3b82f6' },
    { name: 'GREEN',  css: '#22c55e' },
    { name: 'YELLOW', css: '#eab308' },
    { name: 'PURPLE', css: '#a855f7' },
  ];

  BrawlBox.registerGame('stroop', {
    start(stage, api) {
      const { rnd, shuffle } = BrawlBox.util;
      let score = 0;
      stage.innerHTML = `
        <p class="g-rule">Tap the INK color, not the word!</p>
        <div class="g-word" id="st-word"></div>
        <div class="g-choices" id="st-c"></div>`;
      const wordEl = stage.querySelector('#st-word');
      const cEl = stage.querySelector('#st-c');

      const make = () => {
        const word = rnd(COLORS);
        const ink = rnd(COLORS.filter(c => c !== word));
        wordEl.textContent = word.name;
        wordEl.style.color = ink.css;
        cEl.innerHTML = '';
        shuffle(COLORS).forEach(c => {
          const b = document.createElement('button');
          b.className = 'g-choice';
          b.textContent = c.name;
          b.onclick = (e) => {
            if (c === ink) {
              score++; api.setScore(score); api.sfx('good'); api.burst(e.clientX, e.clientY); make();
            } else {
              api.sfx('bad');
              b.classList.remove('shake'); void b.offsetWidth; b.classList.add('shake');
            }
          };
          cEl.appendChild(b);
        });
      };
      make();
    },
  });
})();
