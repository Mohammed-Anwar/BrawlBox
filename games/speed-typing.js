/* Speed Typing: type the sentence shown. Each finished sentence scores its
   word count. Score = total words typed. Case doesn't matter. */
(() => {
  const SENTENCES = [
    'The sun is bright today',
    'Dogs love to run in the park',
    'We bake bread every Friday',
    'Can you help me carry this box',
    'Water keeps the plants alive',
    'The train leaves at seven',
    'My favorite color is blue',
    'Reading a book before sleep is calm',
    'Let us build a tall sandcastle',
    'Birds sing in the morning light',
  ];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  BrawlBox.registerGame('speed-typing', {
    start(stage, api) {
      const { rnd } = BrawlBox.util;
      let score = 0, target = '';

      stage.innerHTML = `
        <style>
          .st-target { font-size: 1.6rem; font-weight: 800; line-height: 1.5; max-width: 720px; text-align: center; }
          .st-ok { color: #4ade80; }
          .st-input { font: inherit; font-size: 1.3rem; width: min(90vw, 620px); padding: 14px 16px; border-radius: 16px;
            border: 3px solid #22d3ee; background: #fff; color: #241b4b; outline: none; text-align: center; }
        </style>
        <p class="g-rule">Type the sentence as fast as you can!</p>
        <p class="st-target" id="st-target"></p>
        <input class="st-input" id="st-input" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Start typing…">`;

      const targetEl = stage.querySelector('#st-target');
      const input = stage.querySelector('#st-input');

      function newSentence() {
        target = rnd(SENTENCES);
        input.value = '';
        paint();
      }

      function paint() {
        const typed = input.value;
        let ok = 0;
        while (ok < typed.length && ok < target.length && typed[ok].toLowerCase() === target[ok].toLowerCase()) ok++;
        targetEl.innerHTML = `<span class="st-ok">${esc(target.slice(0, ok))}</span>${esc(target.slice(ok))}`;
      }

      input.addEventListener('input', () => {
        paint();
        if (input.value.trim().toLowerCase() === target.toLowerCase()) {
          score += target.split(' ').length;
          api.setScore(score);
          api.sfx('good');
          const r = input.getBoundingClientRect();
          api.burst(r.left + r.width / 2, r.top, 20);
          newSentence();
        }
      });

      api.onStop(() => input.blur());
      newSentence();
      input.focus();
    },
  });
})();
