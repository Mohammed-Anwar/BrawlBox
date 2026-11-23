/* Word lookups through the Datamuse API (free, no key needed).
   Words.isWord(w)              -> Promise<boolean>, exact dictionary match
   Words.category(rel, letter)  -> Promise<Set>, words in a category that start with a letter
                                   e.g. Words.category('rel_spc=fruit', 'b')
   Results are cached per tab. Network errors reject and are not cached. */
const Words = (() => {
  const BASE = 'https://api.datamuse.com/words';
  const cache = new Map();

  const query = q => fetch(`${BASE}?${q}`).then(r => {
    if (!r.ok) throw new Error('dictionary unavailable');
    return r.json();
  });

  const remember = (key, makeP) => {
    if (!cache.has(key)) {
      const p = makeP();
      p.catch(() => cache.delete(key));
      cache.set(key, p);
    }
    return cache.get(key);
  };

  const clean = w => String(w || '').trim().toLowerCase();

  return {
    clean,
    isWord(w) {
      w = clean(w);
      if (!/^[a-z]{2,}$/.test(w)) return Promise.resolve(false);
      // md=d adds a definitions field. Names, abbreviations and fragments have none or marked definitions.
      return remember(`def:${w}`, () =>
        query(`sp=${w}&md=d&max=1`).then(list =>
          list.some(x => {
            if (x.word !== w || !Array.isArray(x.defs) || x.defs.length === 0) return false;
            return x.defs.every(def =>
              !/(?:\b(?:initialism|acronym|abbreviation)\b|\b(?:given name|surname|proper name|personal name)\b)/i.test(def));
          })));
    },
    category(rel, letter) {
      const l = clean(letter);
      return remember(`${rel}|${l}`, () =>
        query(`${rel}&sp=${l}*&max=1000`).then(list => new Set(list.map(x => x.word))));
    },
  };
})();
