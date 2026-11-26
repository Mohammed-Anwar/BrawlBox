/* BrawlBox engine: shared by index.html, debug.html and every game file. */

const BrawlBox = {
  games: {},                       // filled by games/*.js
  registerGame(id, def) { this.games[id] = def; },

  // Metadata for the lobby and timers. Game files only contain start().
  // `time` is seconds, or a function of the players object (used by Auction House).
  catalog: [
    { id: 'odd-one-out',      name: 'Odd One Out',    icon: '🔍', rule: 'Tap the one that is different. Fast!', time: 30 },
    { id: 'reaction',         name: 'Quick Draw',     icon: '⚡', rule: 'Wait for GREEN, then tap as fast as you can. 5 tries!', time: 30 },
    { id: 'quick-math',       name: 'Brain Blitz',    icon: '🧮', rule: 'Solve as many sums as you can!', time: 30 },
    { id: 'stroop',           name: 'Color Clash',    icon: '🎨', rule: 'Tap the INK color, not the word!', time: 25 },
    { id: 'whack-a-mole',     name: 'Mole Whack',     icon: '🔨', rule: 'Whack every mole that pops up!', time: 25 },
    { id: 'tiles-claim',      name: 'Tile Grab',      icon: '🟦', rule: 'Tap any tile to take it, even from others!', time: 20, hot: true },
    { id: 'catch-falling',    name: 'Catch It',       icon: '🧺', rule: 'Tap the good items, avoid the bombs!', time: 25 },
    { id: 'pattern-copy',     name: 'Pattern Copy',   icon: '🧩', rule: 'Watch the tiles light up, then tap them in order.', time: 30 },
    { id: 'trivia-buzz',      name: 'Trivia Buzz',    icon: '💡', rule: 'Answer fast! Quicker correct answers score more.', time: 25 },
    { id: 'balloon-pump',     name: 'Balloon Pump',   icon: '🎈', rule: 'Hold to inflate. Let go before it pops!', time: 25 },
    { id: 'speed-typing',     name: 'Speed Typing',   icon: '⌨️', rule: 'Type the sentence as fast as you can!', time: 20 , hot: true},
    { id: 'precision-timing', name: 'Perfect Stop',   icon: '🎯', rule: 'Stop the marker inside the green zone!', time: 25 },
    { id: 'stamina',          name: 'Sprint Stamina', icon: '🏃', rule: 'Tap to push! Pause to catch your breath.', time: 20 },
    { id: 'bouncing-ball',    name: 'Bouncing Ball',  icon: '🏀', rule: 'Tap when the ball is low to keep it bouncing!', time: 25 },
    { id: 'auction-house',    name: 'Auction House',  icon: '🏛️', rule: 'Bid your gold on items. Highest bid takes it!',
      time: players => BrawlBox.auction.duration(Object.keys(players).length) },
    { id: 'orbit-tap',      name: 'Orbit Tap',     icon: '🌀', rule: 'Tap to flip the bar. Tap on a green arc to score!', time: 25 },
    { id: 'lane-dash',      name: 'Lane Dash',     icon: '🏁', rule: 'Drag your car across 3 lanes. Dodge the traffic!', time: 30 },
    { id: 'box-heist',      name: 'Box Heist',     icon: '💰', rule: 'Grab gems from the pile or steal from other boxes!', time: 25 },
    { id: 'knight-hop',     name: 'Knight Hop',    icon: '♞',  rule: 'Jump like a chess knight. Never reuse a square!', time: 30, hot: true },

    //{ id: 'word-chain',     name: 'Word Chain',    icon: '🔗', rule: 'Start your word with the last letter of the last word!', time: 40 },
    //{ id: 'unique-answer',  name: 'Unique Answer', icon: '💬', rule: 'Name answers nobody else gave!', time: 30 },
    //{ id: 'letter-grab',    name: 'Letter Grab',   icon: '🔤', rule: 'Drag across letters to spell words. Longer words, more points!', time: 45 },
    
    { id: 'red-light',    name: 'Red Light',     icon: '🚦', rule: 'Hold to run on GREEN. Let go on RED, or you are out!', time: 40, isNew: true, hot: true },
    { id: 'tower-rush',   name: 'Tower Rush',    icon: '🪨', rule: 'Tap to drop rocks on your tower. Tallest tower wins!', time: 30, isNew: true, hot: true },
    { id: 'box-stack',    name: 'Box Stack',     icon: '📦', rule: 'Drag falling boxes onto your tower. Build as high as you can!', time: 40, isNew: true, hot: true },
    { id: 'memory-floor', name: 'Memory Floor',  icon: '🧠', rule: 'Memorize the lit tiles, then tap them. Get them all right!', time: 40 , isNew: true, hot: true},
    { id: 'star-maze',    name: 'Star Maze',     icon: '⭐', rule: 'Race through the maze and grab stars. Faster means more points!', time: 45, isNew: true, hot: true},
  ],

  util: {
    rnd: a => a[Math.floor(Math.random() * a.length)],
    shuffle: a => {
      a = [...a];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  },
};

// Resolves a catalog entry's time for a given set of players (seconds).
BrawlBox.timeOf = (g, players) => typeof g.time === 'function' ? g.time(players || {}) : g.time;
// Game image with icon fallback, HOT and NEW stickers, and an optional time panel.
// Image is images/<id>.png unless the catalog entry sets `image`.
// If the file is missing, the icon shows instead.
// Pass seconds to show the time panel (pass nothing to hide it).
BrawlBox.visual = (g, seconds) => `<span class="gv">
  <span class="gv-icon">${g.icon}</span>
  <img src="${g.image || `images/${g.id}.png`}" alt="" loading="lazy" onload="this.classList.add('ok')" onerror="this.remove()">
  ${g.hot ? '<span class="stk hot">🔥 HOT</span>' : ''}
  ${g.isNew ? '<span class="stk new">NEW</span>' : ''}
  ${seconds != null ? `<span class="gv-time">${seconds}s</span>` : ''}
</span>`;
// NEW and HOT tags come from the catalog flags `isNew` and `hot`.
BrawlBox.badges = g => `${g.isNew ? '<span class="badge new">NEW</span>' : ''}${g.hot ? '<span class="badge hot">🔥 HOT</span>' : ''}`;

// Auction House timing. Milliseconds per item, seconds for the whole game.
BrawlBox.auction = {
  BID: 10000,      // bidding window per item
  REVEAL: 3000,    // winner shown after bidding
  FINAL: 9000,     // end-of-game haul animation
  EXTRA_ITEMS: 3,  // items = players + this number
  itemCount(n) { return Math.max(1, n) + this.EXTRA_ITEMS; },
  duration(n) { return (this.itemCount(n) * (this.BID + this.REVEAL) + this.FINAL) / 1000; },
};

/* ---------- SFX (synthesized, no audio files) ---------- */
const SFX = {
  ctx: null,
  WARN_S: 5,                                                // timer flashes and ticks in the last this-many seconds
  timerOn: localStorage.getItem('bb_timer_sound') !== 'off', // timer tick on/off, remembered on this device
  setTimerSound(on) {
    this.timerOn = !!on;
    localStorage.setItem('bb_timer_sound', this.timerOn ? 'on' : 'off');
  },
  ctxGet() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  },
  unlock() { try { this.ctxGet(); } catch (e) {} },
  tone(freq, delay, dur, type = 'sine', slideTo = null) {
    const c = this.ctxGet(), t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  },
  // Short click for the last seconds of a timer. The final second is higher pitched.
  timerTick(secondsLeft) {
    if (!this.timerOn || secondsLeft <= 0 || secondsLeft > this.WARN_S) return;
    try { this.tone(secondsLeft === 1 ? 1100 : 820, 0, 0.06, 'square'); } catch (e) {}
  },
  play(name) {
    try {
      switch (name) {
        case 'tap':   this.tone(700, 0, 0.06); break;
        case 'good':  this.tone(523, 0, 0.15); this.tone(784, 0.1, 0.2); break;
        case 'bad':   this.tone(220, 0, 0.25, 'sawtooth', 110); break;
        case 'tick':  this.tone(900, 0, 0.04, 'square'); break;
        case 'pop':   this.tone(400, 0, 0.25, 'sine', 1200); break;
        case 'start': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.1, 0.2)); break;
        case 'win':   [523, 659, 784, 659, 784, 1046].forEach((f, i) => this.tone(f, i * 0.12, 0.25)); break;
      }
    } catch (e) {}
  },
};

/* ---------- VFX (confetti and bursts on a fixed canvas) ---------- */
const VFX = {
  c: null, g: null, parts: [],
  init() {
    this.c = document.getElementById('vfx');
    this.g = this.c.getContext('2d');
    const size = () => { this.c.width = innerWidth; this.c.height = innerHeight; };
    size();
    addEventListener('resize', size);
    const loop = () => { this.frame(); requestAnimationFrame(loop); };
    loop();
  },
  burst(x, y, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 8 + 2;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: .4,
        size: Math.random() * 8 + 4, color: `hsl(${Math.random() * 360} 90% 60%)` });
    }
  },
  confetti(n = 40) {
    for (let i = 0; i < n; i++) {
      this.parts.push({ x: Math.random() * innerWidth, y: -20, vx: (Math.random() - 0.5) * 3,
        vy: Math.random() * 3 + 2, life: 1.6, size: Math.random() * 10 + 5,
        color: `hsl(${Math.random() * 360} 90% 60%)` });
    }
  },
  frame() {
    const g = this.g;
    g.clearRect(0, 0, this.c.width, this.c.height);
    this.parts = this.parts.filter(p => p.life > 0);
    for (const p of this.parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life -= 0.012;
      g.globalAlpha = Math.max(p.life, 0);
      g.fillStyle = p.color;
      g.fillRect(p.x, p.y, p.size, p.size);
    }
    g.globalAlpha = 1;
  },
};

/* ---------- Game picker ----------
   Repeats OFF (default): shuffle the pool, each game is played once.
   Repeats ON: weighted picking. A picked game drops to PENALTY of its weight
   (5 games: 20% becomes about 6%), and the others recover RECOVER per round. */
const Picker = {
  PENALTY: 0.25,
  RECOVER: 0.1,
  pick(w) {
    const ids = Object.keys(w);
    let r = Math.random() * ids.reduce((s, k) => s + w[k], 0);
    for (const k of ids) { r -= w[k]; if (r <= 0) return k; }
    return ids[ids.length - 1];
  },
  penalize(w, chosen) {
    Object.keys(w).forEach(k => {
      w[k] = k === chosen ? w[k] * Picker.PENALTY : Math.min(1, w[k] + Picker.RECOVER);
    });
  },
  schedule(ids, rounds, replay = false) {
    if (!ids.length) return [];
    if (!replay) return BrawlBox.util.shuffle(ids).slice(0, rounds);
    const w = Object.fromEntries(ids.map(id => [id, 1]));
    const out = [];
    for (let i = 0; i < rounds; i++) {
      const id = Picker.pick(w);
      out.push(id);
      Picker.penalize(w, id);
    }
    return out;
  },
};

/* ---------- Room store (Firebase Realtime Database + Anonymous Auth) ----------
   get(path)        sync: reads the live copy of a room you are watching with on()
   getOnce(path)    async: fetches once (used before watching, e.g. create/join)
   set(path, v)     writes (null deletes)
   update(path, fn) transaction: fn(current) returns the new value, or undefined to abort
   on(path, cb)     live listener, returns an unsubscribe function
   ready()          resolves with this tab's Firebase user id */
const DB = (() => {
  const live = new Map();     // watched path -> latest value
  let readyP = null;

  const init = async () => {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    const auth = firebase.auth();
    // SESSION: each tab gets its own anonymous player, and refresh keeps it.
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    const user = await new Promise(res => {
      const off = auth.onAuthStateChanged(u => { off(); res(u); });
    });
    return user ? user.uid : (await auth.signInAnonymously()).user.uid;
  };

  const keys = p => p.split('/').filter(Boolean);
  const getIn = (obj, p) => keys(p).reduce((o, k) => (o == null ? undefined : o[k]), obj);
  const ref = p => firebase.database().ref(p);

  const cached = p => {
    for (const [root, val] of live) {
      if (p === root || p.startsWith(root + '/')) return getIn(val, p.slice(root.length));
    }
    return undefined;
  };

  return {
    ready: () => (readyP ||= init()),
    get: cached,
    async getOnce(p) { return (await ref(p).once('value')).val(); },
    set: (p, v) => ref(p).set(v === undefined ? null : v),
    // js/engine.js, inside DB, replace the update line:
    update: (p, fn) => ref(p).transaction(fn).then(res => {
      if (!res.committed) console.warn('update not committed:', p);
      return res;
    }).catch(e => {
      console.error('DB update failed at', p, e.code || e.message);
      return { committed: false };
    }),
    on(p, cb) {
      const r = ref(p);
      const handler = snap => { const v = snap.val(); live.set(p, v); cb(v); };
      r.on('value', handler);
      return () => { r.off('value', handler); live.delete(p); };
    },
  };
})();

/* ---------- Game loader ---------- */
function loadGame(id) {
  if (BrawlBox.games[id]) return Promise.resolve(BrawlBox.games[id]);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `games/${id}.js`;
    s.onload = () => BrawlBox.games[id]
      ? resolve(BrawlBox.games[id])
      : reject(new Error(`games/${id}.js did not register "${id}"`));
    s.onerror = () => reject(new Error(`Missing file games/${id}.js`));
    document.body.appendChild(s);
  });
}

/* ---------- Shared state for a game ----------
   In a room it is backed by Firebase under rooms/<CODE>/live/<gameIndex>.
   In solo mode (debug.html) it is in memory.
   update(key, fn) is a transaction: fn gets the current value and returns the new one,
   or undefined to abort. Resolves true if the write went through. */
function makeChannel(ctx) {
  if (ctx) {
    const base = `rooms/${ctx.code}/live/${ctx.gi}`;
    return {
      uid: ctx.uid,
      players: ctx.players,
      epoch: ctx.epoch,
      set: (key, val) => DB.set(`${base}/${key}`, val),
      update: (key, fn) => DB.update(`${base}/${key}`, fn).then(r => !!(r && r.committed)),
      on: (key, cb) => DB.on(`${base}/${key}`, cb),
    };
  }
  const root = {};
  const subs = [];
  const read = key => key.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), root);
  const write = (key, val) => {
    const ks = key.split('/').filter(Boolean);
    let o = root;
    ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; });
    o[ks[ks.length - 1]] = val;
    subs.forEach(s => s.cb(read(s.key)));
  };
  return {
    uid: 'me',
    players: { me: { name: 'You', color: '#ff4d8d' } },
    epoch: Date.now(),
    set: (key, val) => { write(key, val); return Promise.resolve(); },
    update: (key, fn) => {
      const next = fn(read(key));
      if (next === undefined) return Promise.resolve(false);
      write(key, next);
      return Promise.resolve(true);
    },
    on(key, cb) {
      const sub = { key, cb };
      subs.push(sub);
      cb(read(key));
      return () => { subs.splice(subs.indexOf(sub), 1); };
    },
  };
}

/* ---------- Game runner ----------
   Loads a game, runs it inside `stage`, and handles the timer and score.
   entry:    catalog entry (time may be a function; it is resolved here)
   handlers: { onTick(secondsLeft), onScore(n), onFinish(score) }
   ctx:      optional { uid, code, gi, players, epoch } for games that share room state */
async function runGame(entry, stage, handlers = {}, ctx = null) {
  const def = await loadGame(entry.id);
  stage.innerHTML = '';
  let score = 0, done = false, timer = null;
  const stops = [];
  const startedAt = performance.now();
  const limit = BrawlBox.timeOf(entry, ctx?.players);   // seconds, resolved for this player count

  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    stops.forEach(fn => { try { fn(); } catch (e) {} });
    handlers.onFinish?.(score);
  };

  const api = {
    timeLimit: limit,
    room: makeChannel(ctx),
    setScore(n) { score = n; handlers.onScore?.(n); },
    getScore: () => score,
    finish,
    sfx: name => SFX.play(name),
    burst: (x, y) => VFX.burst(x, y),
    onStop: fn => stops.push(fn),
  };

  timer = setInterval(() => {
    const left = limit - (performance.now() - startedAt) / 1000;
    handlers.onTick?.(Math.max(0, Math.ceil(left)));
    if (left <= 0) finish();
  }, 200);

  try { def.start(stage, api); } catch (e) { console.error(e); finish(); }
  return { finish };
}