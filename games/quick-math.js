/* Brain Blitz: solve as many sums as you can. Score = correct answers. */
(() => {
  BrawlBox.registerGame('quick-math', {
    start(stage, api) {
      const { rnd, shuffle } = BrawlBox.util;
      let score = 0;
      stage.innerHTML = `
        <p class="g-rule">Solve as many as you can!</p>
        <div class="g-question" id="qm-q"></div>
        <div class="g-choices" id="qm-c"></div>`;
      const qEl = stage.querySelector('#qm-q');
      const cEl = stage.querySelector('#qm-c');

      const make = () => {
        const op = rnd(['+', '-', '×']);
        let a = 2 + Math.floor(Math.random() * 11);
        let b = 2 + Math.floor(Math.random() * 11);
        let ans, text;
        if (op === '+') { ans = a + b; text = `${a} + ${b}`; }
        else if (op === '-') { if (a < b) [a, b] = [b, a]; ans = a - b; text = `${a} − ${b}`; }
        else { a = 2 + Math.floor(Math.random() * 8); ans = a * b; text = `${a} × ${b}`; }

        const options = new Set([ans]);
        while (options.size < 4) {
          const d = ans + (Math.floor(Math.random() * 9) - 4);
          if (d >= 0 && d !== ans) options.add(d);
        }

        qEl.textContent = text;
        cEl.innerHTML = '';
        shuffle([...options]).forEach(v => {
          const b = document.createElement('button');
          b.className = 'g-choice';
          b.textContent = v;
          b.onclick = (e) => {
            if (v === ans) {
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
