/* Word Chain (solo). Everyone starts from the same word, but builds their own chain.
   Each new word must start with the last letter of the word before it. Score = words in your chain. */
(() => {
  // ---- Tuning (change these) ----
  const START_WORDS = ['banana', 'table', 'river', 'planet', 'garden', 'pencil', 'window', 'orange', 'school', 'castle'];
  const MIN_LENGTH = 3;            // shortest word allowed
  const MAX_LENGTH = 20;           // longest word allowed
  const POINTS_PER_WORD = 1;       // score for each word in your chain

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BrawlBox.registerGame('word-chain', {
    start(stage, api) {
      // Same start word for everyone in the room (seeded by the round start time).
      const seed = api.room ? Math.floor(api.room.epoch) : 0;
      const first = START_WORDS[seed % START_WORDS.length];
      const wordPattern = new RegExp(`^[a-z]{${MIN_LENGTH},${MAX_LENGTH}}$`);

      let chain = [first];         // my own chain only; nobody else sees it
      let busy = false, stopped = false;

      stage.innerHTML = `
        <style>
          .wc-last { font-size: clamp(2.4rem, 9vw, 3.6rem); font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
          .wc-pop { animation: wc-pop .35s ease-out; }
          @keyframes wc-pop { 0% { transform: scale(.7); opacity: .3; } 60% { transform: scale(1.08); opacity: 1; } 100% { transform: scale(1); } }
          .wc-need { font-size: 1.3rem; font-weight: 800; color: var(--yellow); margin: 0; }
          .wc-form { display: flex; gap: 10px; width: min(92vw, 520px); }
          .wc-input { flex: 1; min-width: 0; font: inherit; font-size: 1.3rem; padding: 14px; border-radius: 16px;
            border: 3px solid #22d3ee; background: #fff; color: #241b4b; text-align: center; }
          .wc-go { font: inherit; font-weight: 900; min-width: 96px; min-height: 60px; border: 0; border-radius: 16px;
            background: #ff4d8d; color: #fff; box-shadow: 0 5px 0 #9d174d; cursor: pointer; touch-action: manipulation; }
          .wc-go:active { transform: translateY(3px); box-shadow: 0 2px 0 #9d174d; }
          .wc-msg { min-height: 1.4em; font-weight: 800; margin: 0; }
          .wc-trail { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 640px; }
          .wc-chip { padding: 6px 12px; border-radius: 999px; font-weight: 800; color: #241b4b; background: #fff;
            animation: wc-in .3s ease-out; }
          @keyframes wc-in { from { opacity: 0; transform: translateY(6px) scale(.9); } to { opacity: 1; transform: none; } }
        </style>
        <p class="g-sub" id="wc-count"></p>
        <div class="wc-last" id="wc-last"></div>
        <p class="wc-need" id="wc-need"></p>
        <div class="wc-form">
          <input class="wc-input" id="wc-in" maxlength="${MAX_LENGTH}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type a word">
          <button class="wc-go" id="wc-go">Add</button>
        </div>
        <p class="wc-msg" id="wc-msg"></p>
        <div class="wc-trail" id="wc-trail"></div>`;

      const $ = id => stage.querySelector(`#${id}`);
      const inp = $('wc-in');
      const btn = $('wc-go');
      const say = (text, ok = false) => {
        const m = $('wc-msg');
        m.textContent = text;
        m.style.color = ok ? '#4ade80' : '#fca5a5';
      };

      const lastWord = () => chain[chain.length - 1];
      const needLetter = () => lastWord().slice(-1);

      const render = (popLast = false) => {
        const word = lastWord();
        const lastEl = $('wc-last');
        lastEl.textContent = word;
        if (popLast) {
          lastEl.classList.remove('wc-pop');
          void lastEl.offsetWidth;
          lastEl.classList.add('wc-pop');
        }
        $('wc-need').textContent = `Next word starts with "${needLetter().toUpperCase()}"`;
        const count = chain.length - 1;
        $('wc-count').textContent = `${count} word${count === 1 ? '' : 's'} in your chain`;
        $('wc-trail').innerHTML = chain.slice(1).map((w, i) =>
          `<span class="wc-chip" style="background:hsl(${(i * 47) % 360} 85% 75%)">${esc(w)}</span>`).join('');
        api.setScore(count * POINTS_PER_WORD);
      };

      const submit = async () => {
        if (busy || stopped) return;
        const w = Words.clean(inp.value);
        if (!wordPattern.test(w)) return say(`Use ${MIN_LENGTH}-${MAX_LENGTH} letters, no spaces`);
        if (w[0] !== needLetter()) return say(`It must start with "${needLetter().toUpperCase()}"`);
        if (chain.includes(w)) return say('Already in your chain!');

        busy = true;
        say('Checking…', true);
        let real;
        try {
          real = await Words.isWord(w);
        } catch (e) {
          busy = false;
          return say('Dictionary offline, try again');
        }
        busy = false;
        if (stopped) return;
        if (!real) return say(`"${w}" is not in the dictionary`);

        chain.push(w);
        inp.value = '';
        api.sfx('good');
        say('Nice!', true);
        render(true);

        const r = $('wc-last').getBoundingClientRect();
        api.burst(r.left + r.width / 2, r.top + r.height / 2, 20);
        inp.focus();
      };

      const onKey = e => { if (e.key === 'Enter') submit(); };
      const onGo = () => submit();
      inp.addEventListener('keydown', onKey);
      btn.addEventListener('click', onGo);

      api.onStop(() => {
        stopped = true;
        inp.removeEventListener('keydown', onKey);
        btn.removeEventListener('click', onGo);
      });

      render();
      inp.focus();
    },
  });
})();
