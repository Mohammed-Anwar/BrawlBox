/* Red Light: shared. Hold to run on GREEN, let go on RED.
   Still holding after RED starts (past RED_GRACE_MS) and you are out.
   The light is worked out from the shared start time, so every phone shows the same light.
   Score = meters run, plus a time bonus if you reach the line. Everyone's runner is visible. */
(() => {
  // ---- Tuning (change these) ----
  const TRACK_M = 100;            // distance to the finish line, in meters
  const RUN_SPEED = 9;            // meters per second while holding on GREEN
  const FIRST_GREEN_MS = 2000;    // the first GREEN lasts this long
  const GREEN_MIN_MS = 1500;      // shortest GREEN
  const GREEN_MAX_MS = 3500;      // longest GREEN
  const RED_MIN_MS = 1200;        // shortest RED
  const RED_MAX_MS = 3000;        // longest RED
  const RED_GRACE_MS = 1000;       // reaction time allowed after RED starts
  const WRITE_STEP_M = 2;         // send score to the database every N meters
  const FINISH_BONUS = 20;        // max bonus points for reaching the line (more if faster)
  const LIGHT_PAD_MS = 5000;      // schedule extra time past the game length

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function mulberry32(a) {
    return () => {
      let t = (a += 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  BrawlBox.registerGame('red-light', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const ids = Object.keys(room.players);
      const epoch = room.epoch;

      // Light schedule. Same seed on every phone = same light.
      const rnd = mulberry32(Math.floor(epoch));
      const between = (a, b) => a + rnd() * (b - a);
      const segs = [];
      let t = 0, green = true;
      const total = api.timeLimit * 1000 + LIGHT_PAD_MS;
      while (t < total) {
        segs.push({ start: t, green });
        const len = segs.length === 1 ? FIRST_GREEN_MS
          : green ? between(GREEN_MIN_MS, GREEN_MAX_MS) : between(RED_MIN_MS, RED_MAX_MS);
        t += len;
        green = !green;
      }
      const lightAt = ms => {
        let s = segs[0];
        for (const x of segs) { if (x.start <= ms) s = x; else break; }
        return s;
      };

      let progress = 0, out = false, finished = false, lastSent = -1;
      let holdPtr = false, holdKey = false, scoresMap = {}, outMap = {};
      let raf = 0, last = performance.now(), dead = false;
      const isHolding = () => holdPtr || holdKey;

      stage.innerHTML = `
        <style>
          .rl-light { width: 110px; height: 110px; border-radius: 50%; transition: background .12s, box-shadow .12s; }
          .rl-light.green { background: #4ade80; box-shadow: 0 0 40px #4ade80; }
          .rl-light.red { background: #ef4444; box-shadow: 0 0 40px #ef4444; }
          .rl-msg { font-size: 1.5rem; font-weight: 900; margin: 0; min-height: 1.5em; }
          .rl-lanes { width: min(92vw, 520px); display: flex; flex-direction: column; gap: 6px; }
          .rl-lane { display: flex; align-items: center; gap: 8px; }
          .rl-name { width: 90px; text-align: left; font-weight: 800; font-size: .9rem; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
          .rl-track { position: relative; flex: 1; height: 30px; border-radius: 10px; background: rgba(255,255,255,.08); }
          .rl-runner { position: absolute; top: 0; line-height: 30px; font-size: 22px; transition: left .15s linear, opacity .3s; }
          .rl-finish { position: absolute; right: 2px; top: 0; line-height: 30px; font-size: 18px; }
          .rl-hold { font: inherit; font-size: 1.4rem; font-weight: 900; width: min(88vw, 340px); padding: 22px; border: 0; border-radius: 22px;
            background: #22d3ee; color: #241b4b; box-shadow: 0 6px 0 #0e7490; touch-action: none; user-select: none; -webkit-user-select: none; }
          .rl-hold.on { transform: translateY(4px); box-shadow: 0 2px 0 #0e7490; }
        </style>
        <div class="rl-light" id="rl-light"></div>
        <p class="rl-msg" id="rl-msg"></p>
        <div class="rl-lanes" id="rl-lanes"></div>
        <button class="rl-hold" id="rl-hold">🏃 HOLD TO RUN</button>
        <p class="g-sub" id="rl-you"></p>`;

      const $ = s => stage.querySelector(s);
      const lightEl = $('#rl-light'), msgEl = $('#rl-msg'), holdBtn = $('#rl-hold'), youEl = $('#rl-you');
      const lanesEl = $('#rl-lanes');

      lanesEl.innerHTML = ids.map(id => `
        <div class="rl-lane">
          <span class="rl-name">${esc(room.players[id].name)}${id === me ? ' (you)' : ''}</span>
          <div class="rl-track"><span class="rl-runner" data-id="${id}">🏃</span><span class="rl-finish">🏁</span></div>
        </div>`).join('');
      const runners = {};
      lanesEl.querySelectorAll('.rl-runner').forEach(el => { runners[el.dataset.id] = el; });

      // Input: pointer hold on the big button, or hold Space
      const updateHoldClass = () => holdBtn.classList.toggle('on', isHolding());
      holdBtn.onpointerdown = e => { holdPtr = true; holdBtn.setPointerCapture?.(e.pointerId); updateHoldClass(); };
      const releasePtr = () => { holdPtr = false; updateHoldClass(); };
      holdBtn.onpointerup = releasePtr;
      holdBtn.onpointercancel = releasePtr;
      window.addEventListener('pointerup', releasePtr);
      const onKeyDown = e => { if (e.code === 'Space') { e.preventDefault(); holdKey = true; updateHoldClass(); } };
      const onKeyUp = e => { if (e.code === 'Space') { holdKey = false; updateHoldClass(); } };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      // Shared state: other players' distance (their score) and out flags
      api.onStop(room.on('scores', v => { scoresMap = v || {}; }));
      api.onStop(room.on('out', v => { outMap = v || {}; }));

      function sendScore(force = false) {
        const step = Math.floor(progress / WRITE_STEP_M) * WRITE_STEP_M;
        if (force || step !== lastSent) { lastSent = step; api.setScore(Math.floor(progress)); }
      }

      function eliminate() {
        out = true;
        holdPtr = holdKey = false;
        updateHoldClass();
        room.set(`out/${me}`, true);
        sendScore(true);
        api.sfx('bad');
      }

      function reachLine(elapsedMs) {
        finished = true;
        progress = TRACK_M;
        const leftFrac = Math.max(0, api.timeLimit - elapsedMs / 1000) / api.timeLimit;
        api.setScore(TRACK_M + Math.round(FINISH_BONUS * leftFrac));
        api.sfx('win');
        api.finish();
      }

      function paint(green, graceLeft) {
        lightEl.className = `rl-light ${green ? 'green' : 'red'}`;
        if (out) msgEl.textContent = '💀 You are out';
        else if (finished) msgEl.textContent = '🏁 You made it!';
        else if (green) msgEl.textContent = '🟢 GREEN: hold to run!';
        else if (isHolding() && graceLeft > 0) msgEl.textContent = `🛑 STOP! Let go in ${(graceLeft / 1000).toFixed(1)}s`;
        else msgEl.textContent = '🔴 RED: let go!';

        ids.forEach(id => {
          const el = runners[id];
          if (!el) return;
          const isMe = id === me;
          const p = isMe ? progress : Math.min(TRACK_M, scoresMap[id] || 0);
          const o = isMe ? out : !!outMap[id];
          el.style.left = `${(p / TRACK_M) * 100}%`;
          el.textContent = o ? '💀' : p >= TRACK_M ? '🏆' : '🏃';
          el.style.opacity = o ? 0.6 : 1;
        });
        youEl.textContent = `Distance: ${Math.floor(progress)} / ${TRACK_M} m`;
      }

      function frame(now) {
        if (dead) return;
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const elapsed = Math.max(0, Date.now() - epoch);
        const seg = lightAt(elapsed);
        const green = seg.green;
        const sinceChange = elapsed - seg.start;
        const graceLeft = green ? 0 : Math.max(0, RED_GRACE_MS - sinceChange);

        if (!out && !finished) {
          if (isHolding() && green) {
            progress = Math.min(TRACK_M, progress + RUN_SPEED * dt);
            if (progress >= TRACK_M) reachLine(elapsed);
          } else if (isHolding() && !green && sinceChange > RED_GRACE_MS) {
            eliminate();                 // still holding after the grace window
          }
          sendScore();
        }
        paint(green, graceLeft);
        if (!dead) raf = requestAnimationFrame(frame);
      }

      api.onStop(() => {
        dead = true;
        cancelAnimationFrame(raf);
        window.removeEventListener('pointerup', releasePtr);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
      });

      raf = requestAnimationFrame(frame);
    },
  });
})();