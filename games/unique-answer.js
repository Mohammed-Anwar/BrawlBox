/* Unique Answer (shared). Everyone gets the same category and letter.
   An answer counts only if it really is in the category. Answers that nobody else wrote score a point. */
(() => {
  // ---- Tuning (change these) ----
  // rel = Datamuse category. Easy categories have many common words.
  const PROMPTS = [
    { text: 'a fruit', rel: 'rel_spc=fruit' },
    { text: 'an animal', rel: 'rel_spc=animal' },
    { text: 'a color', rel: 'rel_spc=color' },
    { text: 'a vegetable', rel: 'rel_spc=vegetable' },
    { text: 'a flower', rel: 'rel_spc=flower' },
    { text: 'a country', rel: 'rel_spc=country' },
    { text: 'a city', rel: 'rel_spc=city' },
    { text: 'a bird', rel: 'rel_spc=bird' },
    { text: 'a tree', rel: 'rel_spc=tree' },
    { text: 'a sport', rel: 'rel_spc=sport' },
  ];
  // Common starting letters. Hard ones (j, k, q, v, w, x, y, z) are left out.
  const LETTERS = 'abcdfghlmprst';
  const MAX_ANSWER_LENGTH = 20;
  const POINTS_PER_UNIQUE = 1;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BrawlBox.registerGame('unique-answer', {
    start(stage, api) {
      const room = api.room;
      const me = room.uid;
      const seed = Math.floor(room.epoch);
      const prompt = PROMPTS[seed % PROMPTS.length];
      const letter = LETTERS[Math.floor(seed / PROMPTS.length) % LETTERS.length];

      let busy = false, stopped = false;
      let mine = [];                 // my accepted answers, in order
      let others = new Set();        // answers other players wrote

      stage.innerHTML = `
        <style>
          .ua-form { display: flex; gap: 10px; width: min(92vw, 520px); }
          .ua-input { flex: 1; min-width: 0; font: inherit; font-size: 1.3rem; padding: 14px; border-radius: 16px;
            border: 3px solid #22d3ee; background: #fff; color: #241b4b; text-align: center; }
          .ua-go { font: inherit; font-weight: 900; min-width: 96px; min-height: 60px; border: 0; border-radius: 16px;
            background: #ff4d8d; color: #fff; box-shadow: 0 5px 0 #9d174d; cursor: pointer; touch-action: manipulation; }
          .ua-go:active { transform: translateY(3px); box-shadow: 0 2px 0 #9d174d; }
          .ua-msg { min-height: 1.4em; font-weight: 800; margin: 0; }
          .ua-list { list-style: none; padding: 0; margin: 0; width: min(92vw, 520px); display: flex; flex-direction: column; gap: 6px; }
          .ua-list li { display: flex; justify-content: space-between; gap: 10px; padding: 10px 14px; border-radius: 14px;
            background: rgba(255,255,255,.1); font-weight: 800; animation: ua-in .3s ease-out; }
          .ua-list li.unique { background: rgba(74,222,128,.22); }
          .ua-list li.shared { opacity: .6; }
          .ua-letter { color: var(--yellow); }
          .ua-score { font-size: 2rem; font-weight: 900; color: var(--yellow); margin: 0; }
          @keyframes ua-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        </style>
        <p class="g-rule">Name ${esc(prompt.text)} that starts with <span class="ua-letter">${letter.toUpperCase()}</span></p>
        <p class="ua-score" id="ua-score">0</p>
        <p class="g-sub">Only answers in the category count. Unique ones score.</p>
        <div class="ua-form">
          <input class="ua-input" id="ua-in" maxlength="${MAX_ANSWER_LENGTH}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="your answer">
          <button class="ua-go" id="ua-go">Add</button>
        </div>
        <p class="ua-msg" id="ua-msg"></p>
        <ul class="ua-list" id="ua-list"></ul>`;

      const $ = id => stage.querySelector(`#${id}`);
      const inp = $('ua-in');
      const say = (text, ok = false) => {
        const m = $('ua-msg');
        m.textContent = text;
        m.style.color = ok ? '#4ade80' : '#fca5a5';
      };

      const render = () => {
        const unique = mine.filter(w => !others.has(w)).length;
        api.setScore(unique * POINTS_PER_UNIQUE);
        $('ua-score').textContent = unique * POINTS_PER_UNIQUE;
        $('ua-list').innerHTML = mine.map(w => {
          const shared = others.has(w);
          return `<li class="${shared ? 'shared' : 'unique'}"><span>${esc(w)}</span><span>${shared ? '👥 shared' : '✨ unique'}</span></li>`;
        }).join('');
      };

      const applyAnswers = value => {
        others = new Set();
        Object.keys(value || {}).forEach(pid => {
          if (pid === me) return;
          Object.values(value[pid] || {}).forEach(w => {
            if (typeof w === 'string') others.add(w);
          });
        });
        render();
      };

      const submit = async () => {
        if (busy || stopped) return;
        const w = Words.clean(inp.value);
        if (!new RegExp(`^[a-z]{2,${MAX_ANSWER_LENGTH}}$`).test(w)) return say('One word, letters only');
        if (w[0] !== letter) return say(`It must start with ${letter.toUpperCase()}`);
        if (mine.includes(w)) return say('You already said that');

        busy = true;
        say('Checking…', true);

        let valid;
        try {
          valid = await Words.inCategory(prompt.rel, w);
        } catch (e) {
          busy = false;
          return say('Check failed, try again');
        }
        if (stopped) return;

        if (!valid) {
          busy = false;
          return say(`"${w}" isn't ${prompt.text}`);
        }

        try {
          await room.set(`answers/${me}/${mine.length}`, w);
        } catch (e) {
          busy = false;
          return say('Could not save, try again');
        }
        busy = false;
        if (stopped) return;

        mine.push(w);
        inp.value = '';
        api.sfx('good');
        say('Added!', true);
        render();
      };

      const onKey = e => { if (e.key === 'Enter') submit(); };
      const btn = $('ua-go');
      btn.addEventListener('click', submit);
      inp.addEventListener('keydown', onKey);

      api.onStop(() => {
        stopped = true;
        inp.removeEventListener('keydown', onKey);
        btn.removeEventListener('click', submit);
      });
      api.onStop(room.on('answers', applyAnswers));
      render();
    },
  });
})();
