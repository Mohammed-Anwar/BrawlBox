(() => {
  const $ = id => document.getElementById(id);
  let token = 0, run = null, current = null;
  VFX.init();

  BrawlBox.catalog.forEach(g => {
    const b = document.createElement('button');
    b.className = 'menu-card';
    b.innerHTML = `<div class="mc-icon">${g.icon}</div><div class="mc-name">${g.name}</div>
      <div class="mc-rule">${g.rule}</div><small>${g.time}s · games/${g.id}.js</small>`;
    b.onclick = () => play(g);
    $('menu-grid').appendChild(b);
  });

  const show = name => document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + name));

  async function play(entry) {
    const t = ++token;
    current = entry;
    if (run) { const r = run; run = null; r.finish(); }
    show('play');
    $('over').classList.add('hidden');
    $('hud-name').textContent = `${entry.icon} ${entry.name}`;
    $('hud-score').textContent = '0';
    $('hud-time').textContent = `${entry.time}s`;
    $('play-stage').innerHTML = '<p class="g-sub">Loading…</p>';
    try {
      const r = await runGame(entry, $('play-stage'), {
        onTick: s => { if (t === token) $('hud-time').textContent = `${s}s`; },
        onScore: n => { if (t === token) $('hud-score').textContent = n; },
        onFinish: score => { if (t === token) { $('over-score').textContent = score; $('over').classList.remove('hidden'); } },
      });
      if (t !== token) r.finish(); else run = r;
    } catch (e) {
      $('play-stage').innerHTML = `<p class="g-rule">Failed to load</p><p class="g-sub">${e.message}</p>`;
    }
  }

  $('btn-back').onclick = () => { token++; if (run) { const r = run; run = null; r.finish(); } show('menu'); };
  $('btn-other').onclick = () => { token++; if (run) { const r = run; run = null; r.finish(); } show('menu'); };
  $('btn-again').onclick = () => { if (current) play(current); };
})();
