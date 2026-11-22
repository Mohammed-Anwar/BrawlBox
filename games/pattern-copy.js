/* Pattern Copy: watch the sequence, then tap it in order. Each finished
   sequence scores level x 10 and adds one step. A wrong tap replays the sequence. */
(() => {
  const N = 9;

  BrawlBox.registerGame('pattern-copy', {
    start(stage, api) {
      let score = 0, level = 0, pos = 0, busy = true;
      let seq = [];
      const timers = [];
      const later = (fn, ms) => timers.push(setTimeout(fn, ms));

      stage.innerHTML = `
        <style>
          .pc-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; width: min(88vw, 360px); }
          .pc-tile { aspect-ratio: 1; border: 0; border-radius: 18px; background: rgba(255,255,255,.2);
            cursor: pointer; transition: background .15s, transform .1s; }
          .pc-tile.lit { background: #ffd23f; transform: scale(1.06); }
          .pc-tile.ok { background: #4ade80; }
          .pc-tile.bad { background: #ef4444; }
        </style>
        <p class="g-rule" id="pc-msg"></p>
        <div class="pc-grid" id="pc-grid"></div>`;

      const msg = stage.querySelector('#pc-msg');
      const grid = stage.querySelector('#pc-grid');
      const tiles = [];
      for (let i = 0; i < N; i++) {
        const b = document.createElement('button');
        b.className = 'pc-tile';
        b.onpointerdown = (e) => tap(i, e);
        grid.appendChild(b);
        tiles.push(b);
      }

      const flash = (i, cls, ms) => {
        tiles[i].classList.add(cls);
        later(() => tiles[i].classList.remove(cls), ms);
      };

      function playSequence() {
        busy = true; pos = 0;
        msg.textContent = 'Watch carefully…';
        seq.forEach((t, k) => later(() => flash(t, 'lit', 450), 600 + k * 650));
        later(() => { busy = false; msg.textContent = 'Your turn! Tap in order'; }, 600 + seq.length * 650);
      }

      function nextLevel() {
        level++;
        seq.push(Math.floor(Math.random() * N));
        playSequence();
      }

      function tap(i, e) {
        if (busy) return;
        if (i === seq[pos]) {
          pos++;
          flash(i, 'ok', 200);
          api.sfx('tap');
          api.burst(e.clientX, e.clientY, 10);
          if (pos === seq.length) {
            score += level * 10;
            api.setScore(score);
            api.sfx('good');
            busy = true;
            msg.textContent = '✅ Nice!';
            later(nextLevel, 800);
          }
        } else {
          api.sfx('bad');
          flash(i, 'bad', 400);
          busy = true;
          msg.textContent = 'Oops! Watch again…';
          later(playSequence, 900);
        }
      }

      api.onStop(() => timers.forEach(clearTimeout));
      nextLevel();
    },
  });
})();
