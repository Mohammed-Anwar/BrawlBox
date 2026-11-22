/* Auction House: everyone starts with 100 gold. Items come one at a time.
   Bid secretly for 10s. The highest bid wins and pays. Ties and no-bids go unsold.
   At the end, every item sells for its hidden value and that goes to its owner.
   Score = gold left + sale value of items owned. */
(() => {
  const GOLD = 100;
  const A = BrawlBox.auction;
  const PERIOD = A.BID + A.REVEAL;
  const POOL = [
    { name: 'Golden Vase', icon: '🏺', min: 40, max: 90 },
    { name: 'Vintage Guitar', icon: '🎸', min: 30, max: 80 },
    { name: 'Diamond Ring', icon: '💍', min: 60, max: 120 },
    { name: 'Rubber Duck', icon: '🦆', min: 2, max: 10 },
    { name: 'Pizza Voucher', icon: '🍕', min: 5, max: 20 },
    { name: 'Oil Painting', icon: '🖼️', min: 20, max: 70 },
    { name: 'Model Car', icon: '🏎️', min: 15, max: 45 },
    { name: 'Old Map', icon: '🗺️', min: 10, max: 35 },
    { name: 'Game Console', icon: '🎮', min: 25, max: 60 },
    { name: 'Perfume', icon: '🧴', min: 8, max: 30 },
    { name: 'Rare Stamp', icon: '✉️', min: 3, max: 25 },
    { name: 'Crystal Ball', icon: '🔮', min: 35, max: 75 },
    { name: 'Gold Coin', icon: '🪙', min: 20, max: 50 },
    { name: 'Telescope', icon: '🔭', min: 18, max: 55 },
    { name: 'Chess Set', icon: '♟️', min: 12, max: 40 },
    { name: 'Violin', icon: '🎻', min: 30, max: 95 },
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Seeded random: every device gets the same items and values from the shared start time
  function mulberry32(a) {
    return () => {
      let t = (a += 0x6D2B79F5) | 0;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeItems(seed, n) {
    const rnd = mulberry32(seed);
    const pool = [...POOL];
    return Array.from({ length: n }, () => {
      const it = pool.splice(Math.floor(rnd() * pool.length), 1)[0];
      return { ...it, value: Math.round(it.min + rnd() * (it.max - it.min)) };
    });
  }

  // Replays items 0..n-1 in order. Returns gold per player, and each item's winner.
  function resolve(bids, uids, n) {
    const gold = Object.fromEntries(uids.map(u => [u, GOLD]));
    const winners = [];
    for (let k = 0; k < n; k++) {
      const b = bids[k] || {};
      let best = 0, bestUid = null, tie = false;
      for (const u of uids) {
        const amt = Math.floor(Number(b[u]) || 0);
        if (amt <= 0 || amt > gold[u]) continue;
        if (amt > best) { best = amt; bestUid = u; tie = false; }
        else if (amt === best) tie = true;
      }
      if (bestUid && !tie) {
        gold[bestUid] -= best;
        winners[k] = { uid: bestUid, price: best };
      } else {
        winners[k] = null;
      }
    }
    return { gold, winners };
  }

  BrawlBox.registerGame('auction-house', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const uids = Object.keys(room.players);
      const n = A.itemCount(uids.length);
      const epoch = room.epoch;
      const items = makeItems(Math.floor(epoch) % 4294967296, n);
      const name = id => room.players[id]?.name || '?';
      let bids = {};

      stage.innerHTML = `
        <style>
          .au-top { display: flex; gap: 12px; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; }
          .au-item { text-align: center; min-height: 170px; display: flex; flex-direction: column; align-items: center; justify-content: center; }
          .au-icon { font-size: 92px; line-height: 1.1; animation: au-bob 1.6s ease-in-out infinite; }
          .au-name { font-size: 1.6rem; font-weight: 900; }
          @keyframes au-bob { 50% { transform: translateY(-6px) rotate(-3deg); } }
          .au-panel { width: min(92vw, 560px); min-height: 170px; display: flex; flex-direction: column; align-items: center; gap: 12px; }
          .au-chips { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
          .au-chip { font: inherit; font-weight: 900; padding: 12px 16px; border: 0; border-radius: 14px; background: #fff;
            color: #241b4b; cursor: pointer; box-shadow: 0 4px 0 #c4b5fd; }
          .au-chip:disabled { opacity: .4; cursor: not-allowed; }
          .au-gold { font-weight: 900; font-size: 1.3rem; }
          .au-gold b { color: var(--yellow); }
          .au-sold { font-size: 1.2rem; font-weight: 800; text-align: center; margin: 0; animation: au-pop .45s ease; }
          @keyframes au-pop { 0% { transform: scale(.6); opacity: 0; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
          .au-row { display: flex; justify-content: space-between; gap: 12px; width: 100%; max-width: 520px; padding: 10px 14px;
            border-radius: 14px; background: rgba(255,255,255,.1); font-weight: 700; animation: au-rise .4s both; }
          @keyframes au-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
          .au-total { font-size: 2.6rem; font-weight: 900; color: var(--yellow); }
        </style>
        <div class="au-top"><span id="au-label"></span><span class="pill" id="au-cd"></span></div>
        <div class="au-item" id="au-item"></div>
        <div class="au-panel" id="au-panel"></div>
        <div class="au-gold">💰 Gold: <b id="au-gold">${GOLD}</b></div>`;

      const $ = s => stage.querySelector(s);
      const el = { label: $('#au-label'), cd: $('#au-cd'), item: $('#au-item'), panel: $('#au-panel'), gold: $('#au-gold'), tot: null };

      // Bids from everyone. Secret in the UI, public in the database.
      api.onStop(room.on('bids', v => { bids = v || {}; }));

      // Clock: the phase timeline is computed from the shared epoch
      function current() {
        const t = Math.max(0, Date.now() - epoch);
        const k = Math.floor(t / PERIOD);
        if (k < n) {
          const r = t - k * PERIOD;
          return r < A.BID
            ? { k, phase: 'bid', left: A.BID - r }
            : { k, phase: 'reveal', left: PERIOD - r };
        }
        const end = n * PERIOD + A.FINAL;
        return t < end ? { k: n, phase: 'final', left: end - t } : { k: n, phase: 'end', left: 0 };
      }

      // Gold after every item that has finished (the bid window or reveal is done)
      function standing(cur) {
        const done = cur.phase === 'bid' ? cur.k : cur.phase === 'reveal' ? cur.k + 1 : n;
        return resolve(bids, uids, done);
      }

      const totalOf = st => {
        let t = st.gold[me];
        st.winners.forEach((w, k) => { if (w && w.uid === me) t += items[k].value; });
        return t;
      };

      const setHTML = (node, html) => {
        if (node.dataset.h !== html) { node.dataset.h = html; node.innerHTML = html; }
      };

      const itemHTML = it => `<div class="au-icon">${it.icon}</div><div class="au-name">${esc(it.name)}</div>`;

      function bidHTML(k, st) {
        const gold = st.gold[me];
        const mine = bids[k]?.[me] || 0;
        const chips = [5, 10, 25, 50].map(a =>
          `<button class="au-chip" data-amt="${a}" ${mine + a > gold ? 'disabled' : ''}>+${a}</button>`).join('');
        return `<p class="au-sold">Your bid: <b>${mine}</b> <span class="g-sub">(you have ${gold})</span></p>
          <div class="au-chips">${chips}<button class="au-chip" data-amt="clear">Clear</button></div>
          <p class="g-sub">Bids stay secret until the hammer falls.</p>`;
      }

      function revealHTML(k, st) {
        const w = st.winners[k];
        if (!w) return `<p class="au-sold">No winner for ${esc(items[k].name)}. Nobody bid, or it was a tie.</p>`;
        const who = w.uid === me ? 'You take it' : `${esc(name(w.uid))} takes it`;
        return `<p class="au-sold">🔨 ${who} for <b>${w.price}</b> gold!</p>
          <p class="g-sub">Gold left: ${st.gold[me]}</p>`;
      }

      function buildFinal(st) {
        finalDone = true;
        const mine = [];
        for (let k = 0; k < n; k++) {
          const w = st.winners[k];
          if (w && w.uid === me) mine.push({ k, price: w.price, value: items[k].value });
        }
        const sum = mine.reduce((s, x) => s + x.value, 0);
        finalGold = st.gold[me];
        finalTotal = finalGold + sum;
        finalRows = mine.length;
        const d = i => (i * 0.35).toFixed(2);

        el.panel.innerHTML = `
          ${mine.length
            ? mine.map((x, i) => `<div class="au-row" style="animation-delay:${d(i)}s">
                <span>${items[x.k].icon} ${esc(items[x.k].name)} <small>paid ${x.price}</small></span>
                <b>sells for ${x.value}</b></div>`).join('')
            : '<p class="au-sold">You bought nothing this time.</p>'}
          <div class="au-row" style="animation-delay:${d(mine.length)}s"><span>💰 Gold left</span><b>${finalGold}</b></div>
          <div class="au-row" style="animation-delay:${(mine.length * 0.35 + 0.2).toFixed(2)}s"><span>🏺 Items sold for</span><b>+${sum}</b></div>
          <div class="au-total" style="animation: au-pop .5s both; animation-delay:${(mine.length * 0.35 + 0.5).toFixed(2)}s">
            = <span id="au-tot">${finalGold}</span></div>`;
        el.tot = el.panel.querySelector('#au-tot');
        tweenStart = performance.now();
        api.sfx('win');
        api.burst(innerWidth / 2, innerHeight / 3, 80);
      }

      function tweenTotal(ended) {
        if (!el.tot) return;
        const delay = finalRows * 350 + 500;
        const p = ended ? 1 : Math.min(1, Math.max(0, (performance.now() - tweenStart - delay) / 1200));
        const eased = 1 - Math.pow(1 - p, 3);
        el.tot.textContent = Math.round(finalGold + (finalTotal - finalGold) * eased);
      }

      function header(cur) {
        if (cur.phase === 'bid') return [`Item ${cur.k + 1} of ${n} · Bidding`, `⏱ ${Math.ceil(cur.left / 1000)}s`];
        if (cur.phase === 'reveal') return [`Item ${cur.k + 1} of ${n} · Sold!`, ''];
        if (cur.phase === 'final') return ['🏛️ Your haul', ''];
        return ['Auction over', ''];
      }

      function enter(cur, st) {
        if (cur.phase === 'bid') api.sfx('pop');
        if (cur.phase === 'reveal') {
          const w = st.winners[cur.k];
          if (w && w.uid === me) { api.sfx('good'); api.burst(innerWidth / 2, innerHeight / 3, 40); }
          else api.sfx('tick');
        }
      }

      function tick() {
        const cur = current();
        const st = standing(cur);

        // Live score: gold while bidding, gold plus sale value at the end
        const score = (cur.phase === 'final' || cur.phase === 'end') ? totalOf(st) : st.gold[me];
        el.gold.textContent = st.gold[me];
        if (score !== lastScore) { lastScore = score; api.setScore(score); }

        const key = cur.phase + cur.k;
        if (key !== lastKey) { lastKey = key; enter(cur, st); }

        const [label, cd] = header(cur);
        el.label.textContent = label;
        el.cd.textContent = cd;

        if (cur.phase === 'bid' || cur.phase === 'reveal') {
          setHTML(el.item, itemHTML(items[cur.k]));
        } else {
          setHTML(el.item, '');
        }

        if (cur.phase === 'bid') setHTML(el.panel, bidHTML(cur.k, st));
        else if (cur.phase === 'reveal') setHTML(el.panel, revealHTML(cur.k, st));
        else {
          if (!finalDone) buildFinal(st);
          tweenTotal(cur.phase === 'end');
        }
      }

      // Bid buttons (event delegation, so re-rendering the panel is safe)
      el.panel.addEventListener('click', e => {
        const b = e.target.closest('button[data-amt]');
        const cur = current();
        if (!b || cur.phase !== 'bid') return;
        const k = cur.k;
        const have = resolve(bids, uids, k).gold[me];
        const mine = bids[k]?.[me] || 0;
        const amt = b.dataset.amt === 'clear' ? 0 : Math.min(have, mine + Number(b.dataset.amt));
        room.set(`bids/${k}/${me}`, amt);
        api.sfx('tick');
      });

      let lastKey = '', lastScore = null, finalDone = false, tweenStart = 0;
      let finalGold = 0, finalTotal = 0, finalRows = 0;

      const timer = setInterval(tick, 100);
      api.onStop(() => clearInterval(timer));
      tick();
    },
  });
})();