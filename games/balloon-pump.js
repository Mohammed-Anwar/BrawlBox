/* Balloon Pump (hold version): hold to inflate. Let go after holding long
   enough to bank the balloon (1 point). It floats into the background.
   Let go too early and it shrinks back. Hold too long and it pops.
   No size numbers are shown. Score = balloons banked. */
(() => {
  const START = 0.5;        // starting scale
  const GROW = 0.35;        // scale gained per second of holding
  const GOOD_HOLD = 1500;   // must hold at least this long to bank (ms)
  const MAX_BG = 80;        // balloons kept in the background

  BrawlBox.registerGame('balloon-pump', {
    start(stage, api) {
      const rand = (a, b) => a + Math.random() * (b - a);
      let count = 0, holding = false, popped = false, dead = false;
      let holdStart = 0, popAt = 0, scale = START, anim = null, popTimer = null, raf = 0;

      stage.innerHTML = `
        <style>
          .bp-wrap { position: relative; width: min(92vw, 560px); height: 380px; border-radius: 26px;
            overflow: hidden; background: linear-gradient(#312e81, #1e1b4b); }
          .bp-bg { position: absolute; inset: 0; pointer-events: none; }
          .bp-float { position: absolute; width: 80px; height: 80px; font-size: 70px; line-height: 80px;
            text-align: center; opacity: .55; }
          .bp-main { position: absolute; left: 50%; top: 50%; width: 0; height: 0; }
          .bp-face { position: absolute; left: -65px; top: -65px; width: 130px; height: 130px;
            font-size: 130px; line-height: 130px; text-align: center; transform-origin: 50% 90%;
            user-select: none; -webkit-user-select: none; pointer-events: none; }
          .bp-hold { font: inherit; font-size: 1.4rem; font-weight: 900; width: min(80vw, 320px); padding: 18px;
            border: 0; border-radius: 20px; color: #241b4b; background: #22d3ee; cursor: pointer;
            box-shadow: 0 6px 0 #0e7490; touch-action: none; user-select: none; -webkit-user-select: none; }
          .bp-hold.on { transform: translateY(4px); box-shadow: 0 2px 0 #0e7490; }
        </style>
        <p class="g-rule">Hold to inflate. Let go at the right moment!</p>
        <div class="bp-wrap" id="bp-wrap">
          <div class="bp-bg" id="bp-bg"></div>
          <div class="bp-main"><div class="bp-face" id="bp-face">🎈</div></div>
        </div>
        <button class="bp-hold" id="bp-hold">HOLD 💨</button>`;

      const wrap = stage.querySelector('#bp-wrap');
      const bg = stage.querySelector('#bp-bg');
      const face = stage.querySelector('#bp-face');
      const hold = stage.querySelector('#bp-hold');

      const setScale = s => { scale = s; face.style.transform = `scale(${s})`; };
      const cancelAnim = () => { if (anim) { anim.cancel(); anim = null; } };

      function newBalloon() {
        popAt = rand(3500, 6000);                 // hidden: when it pops
        face.textContent = '🎈';
        face.style.filter = `hue-rotate(${Math.round(rand(0, 360))}deg)`;
        setScale(START);
      }

      function press(e) {
        if (popped || holding) return;
        cancelAnim();
        holding = true;
        holdStart = performance.now();
        hold.classList.add('on');
        hold.setPointerCapture?.(e.pointerId);
        api.sfx('tick');
      }

      function release() {
        if (!holding) return;
        holding = false;
        hold.classList.remove('on');
        if (popped) return;
        const held = performance.now() - holdStart;
        if (held >= GOOD_HOLD) bank(); else deflate();
      }

      function bank() {
        const fr = face.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();
        const cx = fr.left + fr.width / 2 - wr.left;
        const cy = fr.top + fr.height / 2 - wr.top;

        count++;
        api.setScore(count);
        api.sfx('good');
        api.burst(fr.left + fr.width / 2, fr.top, 30);
        sendToBg(cx, cy, scale);
        newBalloon();
      }

      function sendToBg(cx, cy, s) {
        const W = wrap.clientWidth, H = wrap.clientHeight, size = 80;
        const tx = rand(size / 2, W - size / 2);
        const ty = rand(size / 2, H - size / 2);

        const el = document.createElement('div');
        el.className = 'bp-float';
        el.textContent = '🎈';
        el.style.left = (tx - size / 2) + 'px';
        el.style.top = (ty - size / 2) + 'px';
        el.style.filter = face.style.filter;
        bg.appendChild(el);
        if (bg.children.length > MAX_BG) bg.firstElementChild.remove();

        // Float from the main balloon's spot to its spot in the background
        el.animate([
          { transform: `translate(${cx - tx}px, ${cy - ty}px) scale(${s * 0.9})`, opacity: 1 },
          { transform: 'translate(0, 0) scale(1)', opacity: 0.55 },
        ], { duration: 800, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' });
      }

      function deflate() {
        cancelAnim();
        anim = face.animate(
          [{ transform: `scale(${scale})` }, { transform: `scale(${START * 0.7})` }],
          { duration: 380, easing: 'ease-in', fill: 'forwards' }
        );
        anim.onfinish = () => {
          cancelAnim();
          setScale(START);
        };
      }

      function pop() {
        popped = true;
        holding = false;
        hold.classList.remove('on');
        cancelAnim();
        face.textContent = '💥';
        face.style.transform = 'scale(1.3)';
        api.sfx('bad');
        const fr = face.getBoundingClientRect();
        api.burst(fr.left + fr.width / 2, fr.top + fr.height / 2, 30);
        popTimer = setTimeout(() => { popped = false; newBalloon(); }, 900);
      }

      function frame() {
        if (dead) return;
        if (holding && !popped) {
          const held = performance.now() - holdStart;
          if (held >= popAt) pop();
          else setScale(START + (held / 1000) * GROW);
        }
        raf = requestAnimationFrame(frame);
      }

      const onWindowUp = () => release();
      hold.onpointerdown = press;
      hold.onpointerup = release;
      hold.onpointercancel = release;
      hold.oncontextmenu = e => e.preventDefault();
      window.addEventListener('pointerup', onWindowUp);

      api.onStop(() => {
        dead = true;
        cancelAnimationFrame(raf);
        clearTimeout(popTimer);
        cancelAnim();
        window.removeEventListener('pointerup', onWindowUp);
      });

      newBalloon();
      raf = requestAnimationFrame(frame);
    },
  });
})();