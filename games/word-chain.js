/* Word Chain: one shared chain. Each new word starts with the last letter of the prior word. */
(() => {
    const STARTS = ['banana', 'table', 'river', 'planet', 'garden', 'pencil', 'window', 'orange', 'school', 'castle'];
    const esc = s => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [c]));
    BrawlBox.registerGame('word-chain', {
        start(stage, api) {
            const room = api.room,
                me = room.uid,
                first = STARTS[Math.floor(room.epoch) % STARTS.length];
            let chain = [{
                    w: first,
                    by: null
                }],
                busy = false,
                stopped = false;
            stage.innerHTML = `<style>.wc-last{font-size:clamp(2.4rem,9vw,3.6rem);font-weight:900;text-transform:uppercase;letter-spacing:.05em}.wc-need{font-size:1.3rem;font-weight:800;color:var(--yellow);margin:0}.wc-form{display:flex;gap:10px;width:min(92vw,520px)}.wc-input{flex:1;min-width:0;font:inherit;font-size:1.3rem;padding:14px;border-radius:16px;border:3px solid #22d3ee;background:#fff;color:#241b4b;text-align:center}.wc-go{font:inherit;font-weight:900;min-width:96px;min-height:60px;border:0;border-radius:16px;background:#ff4d8d;color:#fff;box-shadow:0 5px 0 #9d174d;cursor:pointer}.wc-msg{min-height:1.4em;font-weight:800;margin:0}.wc-trail{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;max-width:640px}.wc-chip{padding:6px 12px;border-radius:999px;font-weight:800;color:#241b4b}</style>
      <p class="g-sub" id="wc-count"></p><div class="wc-last" id="wc-last"></div><p class="wc-need" id="wc-need"></p><div class="wc-form"><input class="wc-input" id="wc-in" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type a word"><button class="wc-go" id="wc-go">Add</button></div><p class="wc-msg" id="wc-msg"></p><div class="wc-trail" id="wc-trail"></div>`;
            const $ = id => stage.querySelector(`#${id}`),
                inp = $('wc-in'),
                say = (text, ok = false) => {
                    const m = $('wc-msg');
                    m.textContent = text;
                    m.style.color = ok ? '#4ade80' : '#fca5a5'
                };
            const lastWord = () => chain[chain.length - 1].w,
                needLetter = () => lastWord().slice(-1),
                colorOf = id => (id && room.players[id]?.color) || '#ffffff';
            const render = () => {
                $('wc-last').textContent = lastWord();
                $('wc-need').textContent = `Next word starts with "${needLetter().toUpperCase()}"`;
                const count = chain.length - 1;
                $('wc-count').textContent = `${count} word${count===1?'':'s'} in the chain`;
                $('wc-trail').innerHTML = chain.slice(1).map(c => `<span class="wc-chip" style="background:${colorOf(c.by)}">${esc(c.w)}</span>`).join('');
                api.setScore(chain.slice(1).filter(c => c.by === me).length)
            };
            const applyWords = v => {
                const obj = v || {};
                const entries = Object.keys(obj).map(Number).filter(k => obj[k]).sort((a, b) => a - b).map(k => obj[k]);
                chain = [{
                    w: first,
                    by: null
                }, ...entries];
                render()
            };
            const submit = async () => {
                if (busy || stopped) return;
                const w = Words.clean(inp.value);
                if (!/^[a-z]{3,20}$/.test(w)) return say('Use 3 or more letters, no spaces');
                if (w[0] !== needLetter()) return say(`It must start with "${needLetter().toUpperCase()}"`);
                if (chain.some(c => c.w === w)) return say('Already in the chain!');
                busy = true;
                say('Checking…', true);
                let real;
                try {
                    real = await Words.isWord(w)
                } catch (e) {
                    busy = false;
                    return say('Dictionary offline, try again')
                }
                busy = false;
                if (stopped) return;
                if (!real) return say(`"${w}" is not in the dictionary`);
                if (w[0] !== needLetter()) return say('Too slow! The chain moved on');
                const slot = chain.length - 1;
                busy = true;
                let saved = true;
                try {
                    await room.set(`words/${slot}`, {
                        w,
                        by: me
                    })
                } catch (e) {
                    saved = false
                }
                busy = false;
                if (stopped) return;
                if (!saved) return say('Too slow! Someone took that spot');
                inp.value = '';
                api.sfx('good');
                say('Nice!', true)
            };
            const onKey = e => {
                    if (e.key === 'Enter') submit()
                },
                onGo = () => submit();
            inp.addEventListener('keydown', onKey);
            $('wc-go').addEventListener('click', onGo);
            api.onStop(() => {
                stopped = true;
                inp.removeEventListener('keydown', onKey)
            });
            api.onStop(room.on('words', applyWords));
            render();
            inp.focus();
        }
    });
})();