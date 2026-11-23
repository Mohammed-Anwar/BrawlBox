/* Unique Answer: everyone gets a prompt and letter. Answers that no one else wrote score points. */
(() => {
    const PROMPTS = [{
            text: 'a fruit',
            rel: 'rel_spc=fruit'
        }, {
            text: 'an animal',
            rel: 'rel_spc=animal'
        }, {
            text: 'a color',
            rel: 'rel_spc=color'
        }, {
            text: 'a vegetable',
            rel: 'rel_spc=vegetable'
        }, {
            text: 'a flower',
            rel: 'rel_spc=flower'
        }, {
            text: 'a country',
            rel: 'rel_spc=country'
        }],
        LETTERS = 'bcdfgmprst';
    const esc = s => String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    } [c]));
    BrawlBox.registerGame('unique-answer', {
        start(stage, api) {
            const room = api.room,
                me = room.uid,
                seed = Math.floor(room.epoch),
                prompt = PROMPTS[seed % PROMPTS.length],
                letter = LETTERS[Math.floor(seed / PROMPTS.length) % LETTERS.length];
            let pool = null,
                offline = false,
                stopped = false,
                busy = false,
                mine = [],
                others = new Set();
            stage.innerHTML = `<style>.ua-form{display:flex;gap:10px;width:min(92vw,520px)}.ua-input{flex:1;min-width:0;font:inherit;font-size:1.3rem;padding:14px;border-radius:16px;border:3px solid #22d3ee;background:#fff;color:#241b4b;text-align:center}.ua-go{font:inherit;font-weight:900;min-width:96px;min-height:60px;border:0;border-radius:16px;background:#ff4d8d;color:#fff;box-shadow:0 5px 0 #9d174d;cursor:pointer}.ua-msg{min-height:1.4em;font-weight:800;margin:0}.ua-list{list-style:none;padding:0;margin:0;width:min(92vw,520px);display:flex;flex-direction:column;gap:6px}.ua-list li{display:flex;justify-content:space-between;gap:10px;padding:10px 14px;border-radius:14px;background:rgba(255,255,255,.1);font-weight:800}.ua-list li.unique{background:rgba(74,222,128,.22)}.ua-list li.shared{opacity:.6}.ua-letter{color:var(--yellow)}</style>
      <p class="g-rule">Name ${esc(prompt.text)} that starts with <span class="ua-letter">${letter.toUpperCase()}</span></p><p class="g-sub" id="ua-status">Loading word list…</p><div class="ua-form"><input class="ua-input" id="ua-in" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="your answer"><button class="ua-go" id="ua-go">Add</button></div><p class="ua-msg" id="ua-msg"></p><ul class="ua-list" id="ua-list"></ul>`;
            const $ = id => stage.querySelector(`#${id}`),
                inp = $('ua-in'),
                say = (text, ok = false) => {
                    const m = $('ua-msg');
                    m.textContent = text;
                    m.style.color = ok ? '#4ade80' : '#fca5a5'
                };
            const render = () => {
                api.setScore(mine.filter(w => !others.has(w)).length);
                $('ua-list').innerHTML = mine.map(w => {
                    const dup = others.has(w);
                    return `<li class="${dup?'shared':'unique'}"><span>${esc(w)}</span><span>${dup?'👥 shared':'✨ unique'}</span></li>`
                }).join('')
            };
            const applyAnswers = v => {
                others = new Set();
                Object.keys(v || {}).forEach(pid => {
                    if (pid === me) return;
                    Object.values(v[pid] || {}).forEach(w => {
                        if (typeof w === 'string') others.add(w)
                    })
                });
                render()
            };
            Words.category(prompt.rel, letter).then(set => {
                if (stopped) return;
                pool = set;
                $('ua-status').textContent = `${set.size} possible answers. Only listed words count.`
            }).catch(() => {
                if (stopped) return;
                offline = true;
                $('ua-status').textContent = 'Word list offline. Any dictionary word that fits will count.'
            });
            const submit = async () => {
                if (busy || stopped) return;
                const w = Words.clean(inp.value);
                if (!/^[a-z]{2,20}$/.test(w)) return say('One word, letters only');
                if (w[0] !== letter) return say(`It must start with ${letter.toUpperCase()}`);
                if (mine.includes(w)) return say('You already said that');
                if (!pool && !offline) return say('Still loading the list…');
                busy = true;
                let valid;
                if (pool) valid = pool.has(w);
                else {
                    try {
                        valid = await Words.isWord(w)
                    } catch (e) {
                        busy = false;
                        return say('Dictionary offline, try again')
                    }
                }
                if (stopped) return;
                if (!valid) {
                    busy = false;
                    return say(`"${w}" doesn't fit: name ${prompt.text}`)
                }
                try {
                    await room.set(`answers/${me}/${mine.length}`, w)
                } catch (e) {
                    busy = false;
                    return say('Could not save, try again')
                }
                busy = false;
                if (stopped) return;
                mine.push(w);
                inp.value = '';
                api.sfx('good');
                say('Added!', true);
                render()
            };
            const onKey = e => {
                    if (e.key === 'Enter') submit()
                },
                btn = $('ua-go');
            btn.addEventListener('click', submit);
            inp.addEventListener('keydown', onKey);
            api.onStop(() => {
                stopped = true;
                inp.removeEventListener('keydown', onKey)
            });
            api.onStop(room.on('answers', applyAnswers));
            render();
        }
    });
})();