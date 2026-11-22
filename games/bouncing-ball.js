/* Bouncing Ball: tap the BALL itself while it is low to bounce it up. Each good
   tap also nudges it sideways, left or right, and it bounces off the side walls.
   Combo multiplier x1 rising to x5 (+1 every 5 bounces). Hitting the floor
   resets the combo. Score = total points. */
(() => {
  const G = 1.6;        // gravity
  const KICK = 1.3;     // upward speed from one good tap
  const LOW = 0.32;     // tap window: ball must be below this height
  const HIGH = 0.42;    // ball must rise above this before the next tap counts
  const FLOOR = 26;     // px of floor band
  const S = 72;         // ball size in px
  const NUDGE_MIN = 0.1, NUDGE_MAX = 0.2;   // sideways push per tap (fraction of the width)
  const DRAG = 1.2;     // how quickly sideways speed fades

  BrawlBox.registerGame('bouncing-ball', {
    start(stage, api) {
      let y = 0.5, vy = 0;          // height: 0 = floor, 1 = top
      let x = 0.5, vx = 0;          // sideways position and speed, as a fraction of the usable width
      let score = 0, combo = 0, armed = true, squash = 0;
      let last = performance.now(), raf = 0;

      stage.innerHTML = `
        <style>
          .bb-combo { font-weight: 900; font-size: 1.3rem; color: #ffd23f; min-height: 1.8rem; }
          .bb-field { position: relative; width: min(92vw, 560px); height: 380px; border-radius: 26px; overflow: hidden;
            background: linear-gradient(#1e1b4b, #312e81); user-select: none; }
          .bb-zone { position: absolute; left: 0; right: 0; bottom: ${FLOOR}px; height: ${LOW * 100}%;
            background: rgba(74,222,128,.12); border-top: 2px dashed rgba(74,222,128,.5); pointer-events: none; }
          .bb-floor { position: absolute; left: 0; right: 0; bottom: 0; height: ${FLOOR}px; background: #4ade80; pointer-events: none; }
          .bb-ball { position: absolute; left: 0; top: 0; width: ${S}px; height: ${S}px; font-size: ${S - 14}px;
            line-height: ${S}px; text-align: center; cursor: pointer; touch-action: none; user-select: none;
            -webkit-user-select: none; will-change: transform; }
        </style>
        <p class="g-rule">Tap the ball when it is low to keep it bouncing!</p>
        <div class="bb-combo" id="bb-combo">&nbsp;</div>
        <div class="bb-field" id="bb-field">
          <div class="bb-zone"></div>
          <div class="bb-floor"></div>
          <div class="bb-ball" id="bb-ball">🏀</div>
        </div>`;

      const $ = s => stage.querySelector(s);
      const field = $('#bb-field'), ball = $('#bb-ball'), comboEl = $('#bb-combo');
      const mult = () => Math.min(5, 1 + Math.floor(combo / 5));

      const showCombo = () => {
        comboEl.innerHTML = combo > 0 ? `Combo ×${mult()} · ${combo} bounce${combo === 1 ? '' : 's'}` : '&nbsp;';
      };

      const frame = now => {
        const dt = Math.min(0.03, (now - last) / 1000);
        last = now;

        // Vertical bounce
        vy -= G * dt;
        y += vy * dt;
        if (y > HIGH) armed = true;
        if (y <= 0) {                                   // hit the floor
          y = 0;
          if (combo > 0) { combo = 0; showCombo(); api.sfx('bad'); }
          vy = 0.7;                                     // weak automatic bounce keeps the game going
          armed = true;
          squash = 1;
        }

        // Sideways drift with drag, bouncing off the walls
        x += vx * dt;
        vx *= Math.exp(-DRAG * dt);
        if (x < 0) { x = 0; vx = Math.abs(vx) * 0.7; }
        if (x > 1) { x = 1; vx = -Math.abs(vx) * 0.7; }

        squash *= 0.85;
        const W = field.clientWidth, H = field.clientHeight - FLOOR - S;
        ball.style.left = (x * (W - S)) + 'px';
        ball.style.top = ((1 - y) * H) + 'px';
        ball.style.transform = `scale(${1 + squash * 0.25}, ${1 - squash * 0.2})`;
        raf = requestAnimationFrame(frame);
      };

      // Only the ball is tappable
      ball.onpointerdown = (e) => {
        e.preventDefault();
        if (!armed || y > LOW) return;                  // too early or already used this bounce
        armed = false;
        vy = KICK;
        // Nudge sideways, randomly left or right
        const dir = Math.random() < 0.5 ? -1 : 1;
        vx += dir * (NUDGE_MIN + Math.random() * (NUDGE_MAX - NUDGE_MIN));
        combo++;
        score += mult();
        api.setScore(score);
        api.sfx('good');
        const r = ball.getBoundingClientRect();
        api.burst(r.left + r.width / 2, r.top + r.height / 2, 14);
        squash = -1;
        showCombo();
      };
      ball.oncontextmenu = e => e.preventDefault();

      showCombo();
      raf = requestAnimationFrame(frame);
      api.onStop(() => cancelAnimationFrame(raf));
    },
  });
})();