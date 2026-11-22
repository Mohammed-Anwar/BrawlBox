/* Quick Draw: wait for green, tap fast. 5 tries. Score = sum of (1000 - ms). */
(() => {
  BrawlBox.registerGame('reaction', {
    start(stage, api) {
      const MAX = 5;
      let tries = 0, score = 0, state = 'wait', waitT = 0, nextT = 0, goAt = 0;
      api.onStop(() => { clearTimeout(waitT); clearTimeout(nextT); });

      stage.innerHTML = `
        <p class="g-rule">Wait for GREEN, then tap!</p>
        <button class="g-reaction" id="rt-box">Get ready…</button>
        <p class="g-sub">Try <b id="rt-try">1</b> of ${MAX}</p>`;
      const box = stage.querySelector('#rt-box');
      const tryEl = stage.querySelector('#rt-try');

      const paint = (cls, text) => { box.className = 'g-reaction ' + cls; box.textContent = text; };

      const arm = () => {
        state = 'wait';
        paint('wait', 'Wait…');
        waitT = setTimeout(() => {
          state = 'go'; goAt = performance.now(); paint('go', 'TAP!');
        }, 1000 + Math.random() * 2500);
      };

      const nextTry = () => {
        tries++;
        if (tries >= MAX) return api.finish();
        tryEl.textContent = tries + 1;
        nextT = setTimeout(arm, 1000);
      };

      box.onclick = (e) => {
        if (state === 'wait') {                       // too early
          clearTimeout(waitT);
          state = 'done';
          api.sfx('bad');
          paint('early', 'Too early!');
          nextTry();
        } else if (state === 'go') {
          const ms = performance.now() - goAt;
          score += Math.max(0, Math.round(1000 - ms));
          api.setScore(score);
          state = 'done';
          api.sfx('good');
          api.burst(e.clientX, e.clientY);
          paint('done', `${Math.round(ms)} ms`);
          nextTry();
        }
      };
      arm();
    },
  });
})();
