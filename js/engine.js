/* BrawlBox engine: shared by index.html, debug.html and every game file. */

const BrawlBox = {
  games: {},                       // filled by games/*.js
  registerGame(id, def) { this.games[id] = def; },

  // Metadata for the lobby and timers. Game files only contain start().
  catalog: [
    { id: 'odd-one-out',  name: 'Odd One Out', icon: '🔍', rule: 'Tap the one that is different. Fast!', time: 30 },
    { id: 'reaction',     name: 'Quick Draw',  icon: '⚡', rule: 'Wait for GREEN, then tap as fast as you can. 5 tries!', time: 30 },
    { id: 'quick-math',   name: 'Brain Blitz', icon: '🧮', rule: 'Solve as many sums as you can!', time: 30 },
    { id: 'stroop',       name: 'Color Clash', icon: '🎨', rule: 'Tap the INK color, not the word!', time: 25 },
    { id: 'whack-a-mole', name: 'Mole Whack',  icon: '🔨', rule: 'Whack every mole that pops up!', time: 25 },
    { id: 'tiles-claim', name: 'Tile Grab', icon: '🟦', rule: 'Tap any tile to take it, even from others!', time: 20 },
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

/* ---------- SFX (synthesized, no audio files) ---------- */
const SFX = {
  ctx: null,
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
  burst(x, y, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = Math.random() * 8 + 2;
      this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 3, life: 1,
        size: Math.random() * 8 + 4, color: `hsl(${Math.random() * 360} 90% 60%)` });
    }
  },
  confetti(n = 140) {
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

/* ---------- Room store ----------*/
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
    update: (p, fn) => ref(p).transaction(fn).catch(e => console.warn('update retried:', e.message)),
    on(p, cb) {
      const r = ref(p);
      const handler = snap => { const v = snap.val(); live.set(p, v); cb(v); };
      r.on('value', handler);
      return () => { r.off('value', handler); live.delete(p); };
    },
  };
})();

/* ---------- Game loader and runner ---------- */
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

// Loads a game, runs it inside `stage`, and handles the timer and score.
// handlers: { onTick(secondsLeft), onScore(n), onFinish(score) }
/* Shared state for a game. In a room it is backed by Firebase under
   rooms/<CODE>/live/<gameIndex>. In solo mode (debug.html) it is in memory. */
function makeChannel(ctx) {
  if (ctx) {
    const base = `rooms/${ctx.code}/live/${ctx.gi}`;
    return {
      uid: ctx.uid,
      players: ctx.players,
      set: (key, val) => DB.set(`${base}/${key}`, val),
      on: (key, cb) => DB.on(`${base}/${key}`, cb),
    };
  }
  const root = {};
  const subs = [];
  const read = key => key.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), root);
  const notify = () => subs.forEach(s => s.cb(read(s.key)));
  return {
    uid: 'me',
    players: { me: { name: 'You', color: '#ff4d8d' } },
    set(key, val) {
      const ks = key.split('/').filter(Boolean);
      let o = root;
      ks.slice(0, -1).forEach(k => { o[k] = o[k] || {}; o = o[k]; });
      o[ks[ks.length - 1]] = val;
      notify();
    },
    on(key, cb) {
      const sub = { key, cb };
      subs.push(sub);
      cb(read(key));
      return () => { subs.splice(subs.indexOf(sub), 1); };
    },
  };
}

// Loads a game, runs it inside `stage`, and handles the timer and score.
// handlers: { onTick(secondsLeft), onScore(n), onFinish(score) }
// ctx (optional): { uid, code, gi, players } for games that share state in a room
async function runGame(entry, stage, handlers = {}, ctx = null) {
  const def = await loadGame(entry.id);
  stage.innerHTML = '';
  let score = 0, done = false, timer = null;
  const stops = [];
  const startedAt = performance.now();

  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    stops.forEach(fn => { try { fn(); } catch (e) {} });
    handlers.onFinish?.(score);
  };

  const api = {
    timeLimit: entry.time,
    room: makeChannel(ctx),
    setScore(n) { score = n; handlers.onScore?.(n); },
    getScore: () => score,
    finish,
    sfx: name => SFX.play(name),
    burst: (x, y) => VFX.burst(x, y),
    onStop: fn => stops.push(fn),
  };

  timer = setInterval(() => {
    const left = entry.time - (performance.now() - startedAt) / 1000;
    handlers.onTick?.(Math.max(0, Math.ceil(left)));
    if (left <= 0) finish();
  }, 200);

  try { def.start(stage, api); } catch (e) { console.error(e); finish(); }
  return { finish };
}
