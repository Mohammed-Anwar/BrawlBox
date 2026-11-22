/* BrawlBox app: room flow, phases, host timer, scoring and stars. */
(async () => {
  const $ = id => document.getElementById(id);
  const MIN_PLAYERS = 2;
  const MAX_ROUNDS = 30;

  // Intro (intro: 10): shows the next game's name and rule, with a countdown. Then the game starts.
  // Result (result: 5): shows that game's ranking, with each player's score and the stars they earned in this game.
  // Standings (standings: 10): shows the running star totals for all players. After the last game, the app goes to the final screen instead.
  const TIMES = { intro: 10, result: 5, standings: 10 };   // seconds
  const GRACE = 3;                                         // seconds to let final scores arrive
  const maxRounds = r => r.replay ? MAX_ROUNDS : Math.max(1, (r.pool || []).length);
  const STARS = [5, 4, 3, 2, 1];                           // 6th place and below get none
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PALETTE = ['#ff4d8d', '#22d3ee', '#4ade80', '#ffd23f', '#a855f7', '#fb923c', '#38bdf8', '#f43f5e', '#84cc16', '#e879f9'];

  const catalogById = id => BrawlBox.catalog.find(g => g.id === id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

  // Firebase user id for this tab (waits for anonymous sign-in).
  const uid = await DB.ready();
  let code = sessionStorage.getItem('bb_room');
  let room = null, unsub = null;
  let activeRun = null, runIndex = null;
  const shownKeys = new Set();
  const once = (key, fn) => { if (!shownKeys.has(key)) { shownKeys.add(key); fn(); } };

  VFX.init();
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    $('btn-leave-fab').classList.toggle('hidden', name === 'home');
  }

  /* ---------- HOME ---------- */
  const nameInput = $('name-input');
  nameInput.value = localStorage.getItem('bb_name') || '';
  const homeError = msg => { $('home-error').textContent = msg || ''; };
  function readName() {
    const n = nameInput.value.trim();
    if (!n) { homeError('Type your name first'); return null; }
    localStorage.setItem('bb_name', n);
    return n;
  }

  $('code-input').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase(); });

    $('btn-create').onclick = async () => {
    const name = readName(); if (!name) return;
    let c;
    do { c = genCode(); } while (await DB.getOnce(`rooms/${c}`));
    await DB.set(`rooms/${c}`, {
      hostId: uid, phase: 'lobby', phaseStart: Date.now(), phaseDur: 0,
      gameIndex: 0, rounds: 5, pool: BrawlBox.catalog.map(g => g.id),
      schedule: [], results: {}, stars: {}, roundResult: null,
      players: { [uid]: { name, ready: true } }, createdAt: Date.now(),
    });
    enterRoom(c);
  };

  $('btn-join').onclick = async () => {
    const name = readName(); if (!name) return;
    const c = $('code-input').value.trim().toUpperCase();
    const r = c && await DB.getOnce(`rooms/${c}`);
    if (!r) return homeError('Room not found. Check the code.');
    const mine = r.players?.[uid];
    if (r.phase !== 'lobby' && !mine) return homeError('That game already started.');
    await DB.set(`rooms/${c}/players/${uid}`, { name, ready: mine?.ready || false });
    enterRoom(c);
  };

  /* ---------- ROOM SUBSCRIPTION ---------- */
  function enterRoom(c) {
    code = c;
    sessionStorage.setItem('bb_room', c);
    if (unsub) unsub();
    unsub = DB.on(`rooms/${c}`, r => { room = r; render(); });
  }

  function leaveLocal(msg = '') {
    if (unsub) { unsub(); unsub = null; }
    code = null; room = null;
    sessionStorage.removeItem('bb_room');
    stopRun();
    showScreen('home');
    homeError(msg);
  }

  function leaveRoom() {
    const c = code, isHost = room?.hostId === uid;
    if (!c) return;
    if (!confirm(isHost ? 'Leave? As the leader, this closes the room for everyone.' : 'Leave this room?')) return;
    leaveLocal();                     // unsubscribe first so the listener doesn't react
    if (isHost) DB.set(`rooms/${c}`, null);
    else DB.set(`rooms/${c}/players/${uid}`, null);
  }
  $('btn-leave').onclick = leaveRoom;
  $('btn-leave-fab').onclick = leaveRoom;

  /* ---------- RENDER (called on every room change) ---------- */
  function render() {
    if (!code) return;
    if (!room) return leaveLocal('That room was closed.');
    if (!room.players?.[uid] && room.hostId !== uid) return leaveLocal('You are no longer in that room.');

    switch (room.phase) {
      case 'lobby':     stopRun(); renderLobby(); showScreen('lobby'); break;
      case 'intro':     stopRun(); renderIntro(); showScreen('intro'); break;
      case 'playing':
        if (runIndex !== room.gameIndex) { stopRun(); startPlay(room.gameIndex); }
        showScreen('play');
        renderBoard();
        break;
      case 'results':   stopRun(); renderResult(); showScreen('result'); break;
      case 'standings': stopRun(); renderStandings(); showScreen('standings'); break;
      case 'final':     stopRun(); renderFinal(); showScreen('final'); break;
    }
  }

  /* ---------- LOBBY ---------- */
  function renderLobby() {
    shownKeys.clear();
    const isHost = room.hostId === uid;
    const me = room.players[uid];
    const ids = Object.keys(room.players);
    const others = ids.filter(id => id !== room.hostId);
    const pool = room.pool || [];
    const allReady = others.every(id => room.players[id].ready);

    $('room-code').textContent = code;
    $('room-count').textContent = `👥 ${ids.length} player${ids.length === 1 ? '' : 's'}`;

    $('player-list').innerHTML = ids.map(id => {
      const p = room.players[id];
      const tag = id === room.hostId
        ? '<span class="tag host">👑 Leader</span>'
        : `<span class="tag ${p.ready ? 'ok' : ''}">${p.ready ? '✅ Ready' : '⏳ Waiting'}</span>`;
      return `<li><span>${esc(p.name)}${id === uid ? ' <small>(you)</small>' : ''}</span>${tag}</li>`;
    }).join('');

    $('btn-ready').className = 'btn big ' + (me.ready ? 'ghost' : 'success') + (isHost ? ' hidden' : '');
    $('btn-ready').textContent = me.ready ? 'Cancel ready' : "I'm ready!";
    $('btn-start').classList.toggle('hidden', !isHost);
    $('rounds-minus').classList.toggle('hidden', !isHost);
    $('rounds-plus').classList.toggle('hidden', !isHost);
    $('rounds-val').textContent = room.rounds;
    $('rounds-minus').disabled = !isHost || room.rounds <= 1;
    $('rounds-plus').disabled = !isHost || room.rounds >= maxRounds(room);
    $('replay-check').checked = !!room.replay;
    $('replay-check').disabled = !isHost;
    $('rounds-note').textContent = room.replay
      ? `Games can repeat. Up to ${MAX_ROUNDS} rounds.`
      : `Each game is played once, so the maximum is ${pool.length} round${pool.length === 1 ? '' : 's'} (the games you picked).`;

    $('pool-list').innerHTML = BrawlBox.catalog.map(g => {
      const on = pool.includes(g.id);
      return `<label class="pool-item ${on ? 'on' : ''}">
        <input type="checkbox" data-id="${g.id}" ${on ? 'checked' : ''} ${isHost ? '' : 'disabled'}>
        <span class="pi">${g.icon}</span><span class="pn">${esc(g.name)}</span><small>${g.time}s</small>
      </label>`;
    }).join('');

    const ok = ids.length >= MIN_PLAYERS && allReady && pool.length > 0;
    $('btn-start').disabled = !ok;

    let hint;
    if (!isHost) hint = me.ready ? 'Waiting for the leader to start…' : 'Tap "I\'m ready!" when you are set';
    else if (ids.length < MIN_PLAYERS) hint = `Need at least ${MIN_PLAYERS} players to start`;
    else if (!allReady) hint = 'Waiting for everyone to be ready';
    else if (!pool.length) hint = 'Pick at least one game';
    else hint = `Everyone is ready! ${pool.length} games in the pool, ${room.rounds} rounds`;
    $('lobby-hint').textContent = hint;
  }

    $('pool-list').addEventListener('change', () => {
    if (!room || room.hostId !== uid) return;
    const pool = [...$('pool-list').querySelectorAll('input:checked')].map(i => i.dataset.id);
    DB.update(`rooms/${code}`, cur => cur && {
      ...cur, pool,
      rounds: Math.min(cur.rounds, cur.replay ? MAX_ROUNDS : Math.max(1, pool.length)),
    });
  });

  const setRounds = n => {
    if (room?.hostId === uid) DB.set(`rooms/${code}/rounds`, Math.min(maxRounds(room), Math.max(1, n)));
  };
  $('rounds-minus').onclick = () => setRounds(room.rounds - 1);
  $('rounds-plus').onclick = () => setRounds(room.rounds + 1);

  $('replay-check').onchange = e => {
    if (room?.hostId !== uid) return;
    const replay = e.target.checked;
    DB.update(`rooms/${code}`, cur => cur && {
      ...cur, replay,
      rounds: Math.min(cur.rounds, replay ? MAX_ROUNDS : Math.max(1, (cur.pool || []).length)),
    });
  };
  $('btn-ready').onclick = () => {
    DB.set(`rooms/${code}/players/${uid}/ready`, !room.players[uid].ready);
  };

  $('btn-start').onclick = () => {
    if (!room || room.hostId !== uid) return;
    const schedule = Picker.schedule(room.pool, room.rounds, !!room.replay);
    const stars = Object.fromEntries(Object.keys(room.players).map(id => [id, 0]));
    const colors = BrawlBox.util.shuffle(PALETTE);
    const players = Object.fromEntries(
      Object.keys(room.players).map((id, i) => [id, { ...room.players[id], color: colors[i % colors.length] }])
    );
    patchRoom({ phase: 'intro', gameIndex: 0, schedule, results: {}, stars, roundResult: null, phaseDur: TIMES.intro, players, live: null });
  };

    // Host-only writes that also reset the phase clock.
  function patchRoom(obj) {
    if (!code) return;
    DB.update(`rooms/${code}`, cur => cur && { ...cur, phaseStart: Date.now(), ...obj });
  }

  // Only applies if the room is still in the phase the host saw. This stops
  // the 250ms timer from applying the same change twice (which would skip a game).
  function patchRoomIf(phase, phaseStart, obj) {
    if (!code) return;
    DB.update(`rooms/${code}`, cur =>
      (cur && cur.phase === phase && cur.phaseStart === phaseStart)
        ? { ...cur, phaseStart: Date.now(), ...obj }
        : undefined);
  }

  /* ---------- INTRO (next game info) ---------- */
  function renderIntro() {
    const gi = room.gameIndex, g = catalogById(room.schedule[gi]);
    $('intro-progress').textContent = `Game ${gi + 1} of ${room.schedule.length}`;
    $('intro-icon').textContent = g.icon;
    $('intro-name').textContent = g.name;
    $('intro-rule').textContent = g.rule;
    once(`intro-${gi}`, () => { SFX.play('start'); loadGame(g.id).catch(() => {}); });   // preload the file
  }

  /* ---------- PLAYING ---------- */
    function saveScore(gi, score, finished = false) {
    if (!code) return;
    DB.set(`rooms/${code}/live/${gi}/scores/${uid}`, Math.round(score)).catch(() => {});
    if (finished) DB.set(`rooms/${code}/live/${gi}/finished/${uid}`, true).catch(() => {});
  }

  async function startPlay(gi) {
    runIndex = gi;                               // set first so render() doesn't start it twice
    const entry = catalogById(room.schedule[gi]);
    const stage = $('play-stage');
    $('hud-name').textContent = `${entry.icon} ${entry.name}`;
    $('hud-time').textContent = `${entry.time}s`;
    $('play-wait').classList.add('hidden');
    showScreen('play');

    const mine = room.live?.[gi]?.scores?.[uid] || 0;
    $('hud-score').textContent = mine;
    if (room.live?.[gi]?.finished?.[uid]) return showWait(mine);   // refreshed after finishing

    // Register yourself on the board right away, even before your first point
    if (room.live?.[gi]?.scores?.[uid] === undefined) saveScore(gi, 0);

    stage.innerHTML = '<p class="g-sub">Loading game…</p>';
    let run;
    try {
      run = await runGame(entry, stage, {
        onTick: s => { $('hud-time').textContent = `${s}s`; },
        onScore: n => { $('hud-score').textContent = n; saveScore(gi, n); },
        onFinish: score => {
          if (runIndex !== gi) return;      // stopped by a phase change, not a real finish
          saveScore(gi, score, true);
          showWait(score);
        },
      }, { uid, code, gi, players: room.players });
    } catch (e) {
      stage.innerHTML = `<p class="g-rule">Oops! This game failed to load.</p><p class="g-sub">${esc(e.message)}</p>`;
      saveScore(gi, 0, true);
      return;
    }
    if (runIndex !== gi) return run.finish();   // phase moved on while the file was loading
    activeRun = run;
  }

  function showWait(score) {
    $('wait-score').textContent = score;
    $('play-wait').classList.remove('hidden');
  }

  function stopRun() {
    const run = activeRun;
    activeRun = null;
    runIndex = null;
    if (run) run.finish();
  }
    
  /* ---------- LIVE SCOREBOARD (this game only, shown during play) ---------- */
  const ROW_STEP = 52;   // row height (44px) + gap (8px)
  const board = { gi: null, rows: new Map() };

  function renderBoard() {
    const gi = room.gameIndex;
    const scores = room.live?.[gi]?.scores || {};
    const box = $('live-list');

    if (board.gi !== gi) {          // new game: start with an empty board
      box.innerHTML = '';
      board.rows.clear();
      board.gi = gi;
    }

    const ids = Object.keys(room.players).sort((a, b) =>
      (scores[b] || 0) - (scores[a] || 0) || room.players[a].name.localeCompare(room.players[b].name));

    // Remove rows for players who left
    for (const [id, row] of board.rows) {
      if (!room.players[id]) { row.remove(); board.rows.delete(id); }
    }

    ids.forEach((id, i) => {
      let row = board.rows.get(id);
      if (!row) {
        row = document.createElement('div');
        row.className = 'live-row';
        row.innerHTML = `<span class="lr-dot"></span><span class="lr-name"></span><b class="lr-score">0</b>`;
        row.querySelector('.lr-dot').style.background = room.players[id].color || '#cccccc';
        row.querySelector('.lr-name').textContent = room.players[id].name + (id === uid ? ' (you)' : '');
        row.dataset.score = '0';
        box.appendChild(row);
        board.rows.set(id, row);
      }

      // Slide into position (CSS transition animates the move)
      row.style.transform = `translateY(${i * ROW_STEP}px)`;
      row.classList.toggle('lead', i === 0 && (scores[id] || 0) > 0);

      // Pop the number when it goes up
      const s = scores[id] || 0;
      const prev = Number(row.dataset.score);
      if (s !== prev) {
        const el = row.querySelector('.lr-score');
        el.textContent = s;
        if (s > prev) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
        row.dataset.score = s;
      }
    });

    box.style.height = Math.max(0, ids.length * ROW_STEP - 8) + 'px';
  }

  /* ---------- ROUND RESULT ---------- */
  function renderResult() {
    const gi = room.gameIndex, g = catalogById(room.schedule[gi]);
    const rr = room.roundResult || {};
    const order = rr.order || [];
    const awarded = rr.awarded || {};
    $('result-name').textContent = `${g.icon} ${g.name}`;
    $('result-list').innerHTML = order.map((o, i) => {
      const p = room.players[o.id];
      const st = awarded[o.id] || 0;
      return `<li class="rank r${i + 1}">
        <span class="pos">${i + 1}</span>
        <span class="rname">${esc(p ? p.name : '?')}${o.id === uid ? ' <small>(you)</small>' : ''}</span>
        <span class="rscore">${o.submitted ? o.score : '—'}</span>
        <span class="rstars">${st ? '⭐'.repeat(st) : ''}</span>
      </li>`;
    }).join('');
    once(`res-${gi}`, () => { SFX.play('win'); VFX.burst(innerWidth / 2, innerHeight / 3, 90); });
  }

  /* ---------- STANDINGS ---------- */
  const sortedIds = () => {
    const stars = room.stars || {};
    return Object.keys(room.players).sort((a, b) => (stars[b] || 0) - (stars[a] || 0));
  };

  function renderStandings() {
    const gi = room.gameIndex, stars = room.stars || {};
    $('stand-progress').textContent = `After game ${gi + 1} of ${room.schedule.length}`;
    $('stand-list').innerHTML = sortedIds().map((id, i) => `<li class="rank r${i + 1}">
      <span class="pos">${i + 1}</span>
      <span class="rname">${esc(room.players[id].name)}${id === uid ? ' <small>(you)</small>' : ''}</span>
      <span class="rstars">⭐ ${stars[id] || 0}</span>
    </li>`).join('');
    once(`stand-${gi}`, () => SFX.play('tick'));
  }

  /* ---------- FINAL ---------- */
  function renderFinal() {
    const stars = room.stars || {}, ids = sortedIds(), top = stars[ids[0]] || 0;
    const winners = ids.filter(id => (stars[id] || 0) === top);
    $('final-winner').innerHTML = `<div class="champ">${winners.map(id => esc(room.players[id].name)).join(' & ')}</div>
      <p class="muted">${top} ⭐ stars</p>`;
    $('final-list').innerHTML = ids.map((id, i) => `<li class="rank r${i + 1}">
      <span class="pos">${i + 1}</span>
      <span class="rname">${esc(room.players[id].name)}${id === uid ? ' <small>(you)</small>' : ''}</span>
      <span class="rstars">⭐ ${stars[id] || 0}</span>
    </li>`).join('');
    const host = room.hostId === uid;
    $('btn-back-lobby').classList.toggle('hidden', !host);
    $('final-hint').textContent = host ? '' : 'Waiting for the leader to go back to the lobby…';
    once('final', () => { SFX.play('win'); VFX.confetti(); });
  }

  $('btn-back-lobby').onclick = () => {
    if (!room || room.hostId !== uid) return;
    const players = Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [id, { name: p.name, ready: id === room.hostId }])
    );
    patchRoom({ phase: 'lobby', phaseDur: 0, gameIndex: 0, schedule: [], results: {}, stars: {}, roundResult: null, players, live: null });
  };

  /* ---------- HOST TIMER (only the leader's tab drives phases) ---------- */
    function finishRound(r) {
    const gi = r.gameIndex;
    const scores = r.live?.[gi]?.scores || {};
    const order = Object.keys(r.players)
      .map(id => ({ id, score: scores[id] ?? 0, submitted: id in scores }))
      .sort((a, b) => (b.score - a.score) || (b.submitted - a.submitted));

    // Only players who actually scored points get stars
    const awarded = {};
    order.filter(o => o.submitted && o.score > 0).slice(0, STARS.length).forEach((o, i) => { awarded[o.id] = STARS[i]; });

    const stars = { ...(r.stars || {}) };
    Object.keys(r.players).forEach(id => { stars[id] = (stars[id] || 0) + (awarded[id] || 0); });

    patchRoomIf('playing', r.phaseStart, { phase: 'results', phaseDur: TIMES.result, roundResult: { order, awarded }, stars });
  }

  function hostTick(r) {
    const el = (Date.now() - r.phaseStart) / 1000;

    if (r.phase === 'intro' && el >= TIMES.intro) {
      return patchRoomIf('intro', r.phaseStart, { phase: 'playing', phaseDur: catalogById(r.schedule[r.gameIndex]).time });
    }
    if (r.phase === 'playing' && el >= r.phaseDur + GRACE) return finishRound(r);
    if (r.phase === 'results' && el >= TIMES.result) {
      return patchRoomIf('results', r.phaseStart, { phase: 'standings', phaseDur: TIMES.standings });
    }
    if (r.phase === 'standings' && el >= TIMES.standings) {
      if (r.gameIndex + 1 < r.schedule.length) {
        return patchRoomIf('standings', r.phaseStart, { phase: 'intro', gameIndex: r.gameIndex + 1, phaseDur: TIMES.intro });
      }
      return patchRoomIf('standings', r.phaseStart, { phase: 'final', phaseDur: 0 });
    }
  }

  function updateCountdowns(r) {
    if (!r) return;
    const left = Math.max(0, Math.ceil(r.phaseDur - (Date.now() - r.phaseStart) / 1000));
    if (r.phase === 'intro') $('intro-countdown').textContent = left;
    if (r.phase === 'results') $('result-countdown').textContent = left;
    if (r.phase === 'standings') $('stand-countdown').textContent = left;
  }

  setInterval(() => {
    if (!code) return;
    const r = DB.get(`rooms/${code}`);
    if (!r) return;
    if (r.hostId === uid) hostTick(r);
    updateCountdowns(DB.get(`rooms/${code}`));
  }, 250);

  /* ---------- RESTORE SESSION (refresh keeps you in the room) ---------- */
  if (code) {
    if (await DB.getOnce(`rooms/${code}`)) enterRoom(code);
    else { code = null; sessionStorage.removeItem('bb_room'); }
  }
})();
