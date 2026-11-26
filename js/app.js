/* BrawlBox app: room flow, phases, host timer, scoring and stars. */
(async () => {
  const $ = id => document.getElementById(id);
  const MIN_PLAYERS = 2;
  const MAX_ROUNDS = 30;                                   // most rounds when repeats are allowed

  // Screen timers in seconds. The leader sets them in the lobby (saved in the room).
  const TIMES = { intro: 10, result: 5, standings: 10 };   // defaults
  const MIN_TIMER = 2;                                     // shortest allowed screen timer
  const MAX_TIMER = 60;                                    // longest allowed screen timer (keep in sync with max="60" in index.html)
  const TIMER_INPUTS = { intro: 't-intro', result: 't-result', standings: 't-standings' };
  const COUNT_EL = { intro: 'intro-countdown', results: 'result-countdown', standings: 'stand-countdown' };
  const GRACE = 3;                                         // seconds to let final scores arrive
  const MAX_STARS = 5;                                     // most stars a game can give out
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const PALETTE = ['#ff4d8d', '#22d3ee', '#4ade80', '#ffd23f', '#a855f7', '#fb923c', '#38bdf8', '#f43f5e', '#84cc16', '#e879f9'];

  const clampTimer = (v, fallback = MIN_TIMER) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(MAX_TIMER, Math.max(MIN_TIMER, n)) : fallback;
  };
  const timerOf = (r, key) => clampTimer(r?.timers?.[key], TIMES[key]);
  const poolOf = r => r?.pool || [];
  // Rounds: at least one per picked game. Without repeats it is exactly the game count.
   const roundBounds = (pool, replay) => ({
    min: 1,
    max: replay ? MAX_ROUNDS : Math.max(1, pool.length),
  });
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const catalogById = id => BrawlBox.catalog.find(g => g.id === id);
  const gameTime = (r, gi) => BrawlBox.timeOf(catalogById(r.schedule[gi]), r.players);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const genCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const setUrgent = (el, sec) => el.classList.toggle('urgent', sec <= SFX.WARN_S);

  // Firebase user id for this tab (waits for anonymous sign-in).
  const uid = await DB.ready();
  let code = sessionStorage.getItem('bb_room');
  let room = null, unsub = null;
  let activeRun = null, runIndex = null;
  const shownKeys = new Set();
  const once = (key, fn) => { if (!shownKeys.has(key)) { shownKeys.add(key); fn(); } };

  // Stars for a place. Max stars = players (capped at MAX_STARS), minus one per place down.
  const starsFor = (rank, players) => Math.max(0, Math.min(MAX_STARS, players) - (rank - 1));
  // Dense ranking: tied scores share a place, and the next score takes the next place.
  function denseRanks(ids, valueOf) {
    let rank = 0, prev = null;
    return ids.map(id => {
      const v = valueOf(id);
      if (prev === null || v !== prev) rank++;
      prev = v;
      return rank;
    });
  }
  VFX.init();
  document.addEventListener('pointerdown', () => SFX.unlock(), { once: true });

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));
    $('btn-leave-fab').classList.toggle('hidden', name === 'home');
  }
  const closeSheets = () => ['picker', 'start-sheet'].forEach(id => $(id).classList.add('hidden'));

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
      gameIndex: 0, pool: BrawlBox.catalog.map(g => g.id), replay: false,
      timers: { ...TIMES },
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
    closeSheets();
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
    if (room.phase !== 'lobby') closeSheets();

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
  const allReady = () => Object.keys(room.players)
    .filter(id => id !== room.hostId)
    .every(id => room.players[id].ready);
  const canStart = () => Object.keys(room.players).length >= MIN_PLAYERS && allReady() && poolOf(room).length > 0;

  function renderLobby() {
    shownKeys.clear();
    const isHost = room.hostId === uid;
    const me = room.players[uid];
    const ids = Object.keys(room.players);
    const pool = poolOf(room);

    $('room-code').textContent = code;
    $('room-count').textContent = `👥 ${plural(ids.length, 'player')}`;

    $('player-list').innerHTML = ids.map(id => {
      const p = room.players[id];
      const tag = id === room.hostId
        ? '<span class="tag host">👑 Leader</span>'
        : `<span class="tag ${p.ready ? 'ok' : ''}">${p.ready ? '✅ Ready' : '⏳ Waiting'}</span>`;
      return `<li><span>${esc(p.name)}${id === uid ? ' <small>(you)</small>' : ''}</span>${tag}</li>`;
    }).join('');

    $('btn-ready').className = 'btn big ' + (me.ready ? 'ghost' : 'success') + (isHost ? ' hidden' : '');
    $('btn-ready').textContent = me.ready ? 'Cancel ready' : "I'm ready!";
    $('btn-ready').onclick = () => {
      if (!room || !room.players?.[uid]) return;
      DB.set(`rooms/${code}/players/${uid}/ready`, !room.players[uid].ready);
    };

    $('lobby-games').innerHTML = pool.length
      ? pool.map(id => `<span class="mini">${catalogById(id)?.icon || '❔'}</span>`).join('') +
        ` <small class="muted">${plural(pool.length, 'game')} picked</small>`
      : '<small class="muted">No games picked yet</small>';
    $('btn-pick').classList.toggle('hidden', !isHost);

    Object.entries(TIMER_INPUTS).forEach(([key, id]) => {
      const el = $(id);
      el.disabled = !isHost;
      if (document.activeElement !== el) el.value = timerOf(room, key);   // don't overwrite while typing
    });

    $('btn-start').classList.toggle('hidden', !isHost);
    $('btn-start').disabled = !canStart();

    let hint;
    if (!isHost) hint = me.ready ? 'Waiting for the leader to start…' : 'Tap "I\'m ready!" when you are set';
    else if (ids.length < MIN_PLAYERS) hint = `Need at least ${MIN_PLAYERS} players to start`;
    else if (!allReady()) hint = 'Waiting for everyone to be ready';
    else if (!pool.length) hint = 'Pick at least one game';
    else hint = 'Everyone is ready! Press Start to set the rounds';
    $('lobby-hint').textContent = hint;
  }

  // Screen timers: the leader edits them, everyone sees them
  Object.entries(TIMER_INPUTS).forEach(([key, id]) => {
    $(id).onchange = e => {
      if (!room || room.hostId !== uid) return;
      const v = clampTimer(e.target.value, TIMES[key]);
      e.target.value = v;
      DB.set(`rooms/${code}/timers/${key}`, v);
    };
  });

  /* ---------- GAME PICKER (popup) ---------- */
  let pickSel = new Set();
  function openPicker() {
    pickSel = new Set(poolOf(room));
    $('picker-grid').innerHTML = [...BrawlBox.catalog].reverse().map(g => `
      <button class="pk-card" data-id="${g.id}">
        ${BrawlBox.visual(g, BrawlBox.timeOf(g, room.players))}
        <span class="pk-row">
          <span class="pk-name">${esc(g.name)}</span>
          <span class="pk-check">✓</span>
        </span>
      </button>`).join('');
    paintPicker();
    $('picker').classList.remove('hidden');
  }
  function paintPicker() {
    $('picker-grid').querySelectorAll('.pk-card').forEach(b => b.classList.toggle('on', pickSel.has(b.dataset.id)));
    $('picker-count').textContent = `${pickSel.size} selected`;
  }
  $('picker-grid').onclick = e => {
    const b = e.target.closest('.pk-card');
    if (!b) return;
    const id = b.dataset.id;
    if (pickSel.has(id)) pickSel.delete(id); else pickSel.add(id);
    SFX.play('tap');
    paintPicker();
  };
  $('btn-pick').onclick = openPicker;
  $('picker-all').onclick = () => { pickSel = new Set(BrawlBox.catalog.map(g => g.id)); paintPicker(); };
  $('picker-none').onclick = () => { pickSel.clear(); paintPicker(); };
  $('picker').onclick = e => { if (e.target.id === 'picker') $('picker').classList.add('hidden'); };
  $('picker-done').onclick = () => {
    if (!room || room.hostId !== uid) return;
    const pool = BrawlBox.catalog.map(g => g.id).filter(id => pickSel.has(id));
    DB.set(`rooms/${code}/pool`, pool.length ? pool : null);
    $('picker').classList.add('hidden');
  };

  /* ---------- START SHEET (rounds are set here, right before the game starts) ---------- */
  const sheet = { rounds: 0, replay: false };
  function openStartSheet() {
    if (!room || room.hostId !== uid || !canStart()) return;
    sheet.replay = !!room.replay;
    sheet.rounds = poolOf(room).length;          // default: every picked game once
    renderSheet();
    $('start-sheet').classList.remove('hidden');
  }
  function renderSheet() {
    const pool = poolOf(room);
    const { min, max } = roundBounds(pool, sheet.replay);
    sheet.rounds = Math.min(max, Math.max(min, sheet.rounds));
    $('ss-games').innerHTML = pool.map(id => catalogById(id)?.icon || '❔').join(' ') +
      ` <span class="muted">${plural(pool.length, 'game')}</span>`;
    $('ss-replay').checked = sheet.replay;
    $('ss-rounds').textContent = sheet.rounds;
    $('ss-minus').disabled = sheet.rounds <= min;
    $('ss-plus').disabled = sheet.rounds >= max;
    $('ss-note').textContent = sheet.replay
      ? `Rounds: 1 to ${max}. Games can repeat.`
      : `Rounds: 1 to ${max}. Each game is played at most once.`;
  }
  $('btn-start').onclick = openStartSheet;
  $('ss-cancel').onclick = () => $('start-sheet').classList.add('hidden');
  $('ss-replay').onchange = e => { sheet.replay = e.target.checked; renderSheet(); };
  $('ss-minus').onclick = () => { sheet.rounds--; renderSheet(); };
  $('ss-plus').onclick = () => { sheet.rounds++; renderSheet(); };
  $('ss-go').onclick = () => startGame();

  function startGame() {
    if (!room || room.hostId !== uid || !canStart()) return;
    const pool = poolOf(room);
    const { min, max } = roundBounds(pool, sheet.replay);
    const rounds = Math.min(max, Math.max(min, sheet.rounds));
    const schedule = Picker.schedule(pool, rounds, sheet.replay);
    const stars = Object.fromEntries(Object.keys(room.players).map(id => [id, 0]));
    const colors = BrawlBox.util.shuffle(PALETTE);
    const players = Object.fromEntries(
      Object.keys(room.players).map((id, i) => [id, { ...room.players[id], color: colors[i % colors.length] }])
    );
    closeSheets();
    patchRoom({
      phase: 'intro', replay: sheet.replay, rounds, gameIndex: 0, schedule,
      results: {}, stars, roundResult: null, phaseDur: timerOf(room, 'intro'),
      players, live: null,
    });
  }

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

  /* ---------- TIMER SOUND TOGGLE ---------- */
  const paintSound = () => {
    $('btn-sound').textContent = SFX.timerOn ? '🔔 Timer sound: On' : '🔕 Timer sound: Off';
  };
  $('btn-sound').onclick = () => { SFX.setTimerSound(!SFX.timerOn); paintSound(); };
  paintSound();

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
    const entry = { ...catalogById(room.schedule[gi]), time: gameTime(room, gi) };
    const stage = $('play-stage');
    $('hud-name').textContent = `${entry.icon} ${entry.name}`;
    $('hud-time').textContent = `${entry.time}s`;
    $('hud-time').classList.remove('urgent');
    $('play-wait').classList.add('hidden');
    showScreen('play');

    const mine = room.live?.[gi]?.scores?.[uid] || 0;
    $('hud-score').textContent = mine;
    if (room.live?.[gi]?.finished?.[uid]) return showWait(mine);   // refreshed after finishing

    // Register yourself on the board right away, even before your first point
    if (room.live?.[gi]?.scores?.[uid] === undefined) saveScore(gi, 0);

    stage.innerHTML = '<p class="g-sub">Loading game…</p>';
    let lastSec = -1;                            // onTick fires 5x a second; only act when the number changes
    let run;
    try {
      run = await runGame(entry, stage, {
        onTick: s => {
          if (s === lastSec) return;
          lastSec = s;
          $('hud-time').textContent = `${s}s`;
          setUrgent($('hud-time'), s);
          SFX.timerTick(s);
        },
        onScore: n => { $('hud-score').textContent = n; saveScore(gi, n); },
        onFinish: score => {
          if (runIndex !== gi) return;      // stopped by a phase change, not a real finish
          saveScore(gi, score, true);
          showWait(score);
        },
      }, { uid, code, gi, players: room.players, epoch: room.phaseStart });
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
    renderWait(room.gameIndex);
  }

  // "Collecting results" panel: who has sent their score so far
  function renderWait(gi) {
    const ids = Object.keys(room.players);
    const done = room.live?.[gi]?.finished || {};
    const count = ids.filter(id => done[id]).length;
    $('wait-count').textContent = `${count} of ${ids.length} players done`;
    $('wait-pips').innerHTML = ids.map(id =>
      `<span class="cr-pip ${done[id] ? 'done' : ''}">${done[id] ? '✅' : '⏳'} ${esc(room.players[id].name)}${id === uid ? ' (you)' : ''}</span>`
    ).join('');
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

    // Keep the "collecting results" panel up to date while it is open
    if (!$('play-wait').classList.contains('hidden')) renderWait(gi);
  }

  /* ---------- ROUND RESULT ---------- */
  function renderResult() {
    const gi = room.gameIndex, g = catalogById(room.schedule[gi]);
    const rr = room.roundResult || {};
    const order = rr.order || [];
    const awarded = rr.awarded || {};
    $('result-name').textContent = `${g.icon} ${g.name}`;
    $('result-list').innerHTML = order.map(o => {
      const p = room.players[o.id];
      const st = awarded[o.id] || 0;
      return `<li class="rank r${Math.min(o.rank, 3)}">
        <span class="pos">${o.rank}</span>
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
    const inQueue = room.schedule.length - (gi + 1);   // games still to play after this one
    $('stand-progress').innerHTML = inQueue > 0
      ? `Games in queue: <b class="q-num">${inQueue}</b>`
      : `Games in queue: <b class="q-done">done</b>`;
    const ids = sortedIds();
    const ranks = denseRanks(ids, id => stars[id] || 0);
    $('stand-list').innerHTML = ids.map((id, i) => `<li class="rank r${Math.min(ranks[i], 3)}">
      <span class="pos">${ranks[i]}</span>
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

    const ranks = denseRanks(ids, id => stars[id] || 0);
    $('final-list').innerHTML = ids.map((id, i) => `<li class="rank r${Math.min(ranks[i], 3)}">
      <span class="pos">${ranks[i]}</span>
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
    const ids = Object.keys(r.players);

    const sorted = ids
      .map(id => ({ id, score: scores[id] ?? 0, submitted: id in scores }))
      .sort((a, b) => (b.score - a.score) || (b.submitted - a.submitted));

    const ranks = denseRanks(sorted, o => o.score);
    const order = sorted.map((o, i) => ({ ...o, rank: ranks[i] }));

    // Only players with points get stars
    const awarded = {};
    order.forEach(o => {
      if (o.score > 0) {
        const st = starsFor(o.rank, ids.length);
        if (st > 0) awarded[o.id] = st;
      }
    });

    const stars = { ...(r.stars || {}) };
    ids.forEach(id => { stars[id] = (stars[id] || 0) + (awarded[id] || 0); });

    patchRoomIf('playing', r.phaseStart, {
      phase: 'results', phaseDur: timerOf(r, 'result'), roundResult: { order, awarded }, stars,
    });
  }

  function hostTick(r) {
    const el = (Date.now() - r.phaseStart) / 1000;

    if (r.phase === 'intro' && el >= r.phaseDur) {
      return patchRoomIf('intro', r.phaseStart, { phase: 'playing', phaseDur: gameTime(r, r.gameIndex) });
    }
    if (r.phase === 'playing' && el >= r.phaseDur + GRACE) return finishRound(r);
    if (r.phase === 'results' && el >= r.phaseDur) {
      return patchRoomIf('results', r.phaseStart, { phase: 'standings', phaseDur: timerOf(r, 'standings') });
    }
    if (r.phase === 'standings' && el >= r.phaseDur) {
      if (r.gameIndex + 1 < r.schedule.length) {
        return patchRoomIf('standings', r.phaseStart, { phase: 'intro', gameIndex: r.gameIndex + 1, phaseDur: timerOf(r, 'intro') });
      }
      return patchRoomIf('standings', r.phaseStart, { phase: 'final', phaseDur: 0 });
    }
  }

  // Countdown numbers on the intro, result and standings screens, with the timer tick sound
  let lastTick = '';
  function updateCountdowns(r) {
    if (!r) return;
    const id = COUNT_EL[r.phase];
    if (!id) return;
    const left = Math.max(0, Math.ceil(r.phaseDur - (Date.now() - r.phaseStart) / 1000));
    const el = $(id);
    el.textContent = left;
    setUrgent(el, left);
    const key = `${r.phaseStart}:${left}`;
    if (key !== lastTick) { lastTick = key; SFX.timerTick(left); }
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