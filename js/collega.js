// Collega le parole: 词库与组卷 (纯函数, tests/collega.test.mjs 覆盖)。
// 只收有正式图片的词; 抽象/符号类 emoji、任一出现处标了 collega:false 的词都不进连线。
// 同一“概念组”的词不同轮出现: 课程 conceptGroups 的近义/同类词, 加上共用同一张图的词。

// 连线关排除抽象/符号类配图 (scripts/audit_vocabulary.py 按同一规则统计)。
export const COLLEGA_EXCLUDE = new Set(['1️⃣', '2️⃣', '9️⃣', '🔢', '⚫', '🤫', '👍', '🌑', '🕳️', '💰', '😴', '📛', '☸️']);

function courseWords(cur) {
  const out = [];
  for (const u of cur.units) {
    if (u.type === 'vocali') {
      for (const L of u.letters) out.push(L.anchor, ...(L.extra || []));
    }
    if (u.type === 'consonante') {
      u.sillabe.forEach(s => out.push(s.anchor));
      (u.casa || []).forEach(r => out.push(...r.correct, ...r.wrong));
    }
    if (u.type === 'speciale') u.groups.forEach(g => out.push(...(g.words || [])));
    out.push(...(u.parole || []));
  }
  return out.filter(Boolean);
}

export function collegaBank(cur) {
  const words = courseWords(cur);
  const optedOut = new Set(words.filter(w => w.collega === false).map(w => w.word));
  const seen = new Map();
  for (const w of words) {
    if (seen.has(w.word) || optedOut.has(w.word) || COLLEGA_EXCLUDE.has(w.emoji) || !cur.pictures?.[w.word]) continue;
    seen.set(w.word, { word: w.word, emoji: w.emoji });
  }
  return [...seen.values()];
}

export function conceptKeyFn(cur) {
  const parent = new Map();
  const find = (w) => { while (parent.has(w)) w = parent.get(w); return w; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
  for (const group of cur.conceptGroups || []) group.slice(1).forEach(w => union(group[0], w));
  const bySource = new Map();
  for (const [word, pic] of Object.entries(cur.pictures || {})) {
    const source = pic.src || `${pic.atlas}:${pic.col}:${pic.row}`;
    if (bySource.has(source)) union(bySource.get(source), word);
    else bySource.set(source, word);
  }
  return find;
}

// easy: 4 词首字母全不同 | medium: 含一对同首字母异元音 | hard: 含一对同首音节
export function buildRound(pool, tier, conceptOf) {
  const out = [], usedW = new Set(), usedC = new Set();
  const free = (e) => !usedW.has(e.word) && !usedC.has(conceptOf(e.word));
  const take = (e) => { out.push(e); usedW.add(e.word); usedC.add(conceptOf(e.word)); };
  if (tier !== 'easy') {
    const n = tier === 'hard' ? 2 : 1;
    outer:
    for (let i = 0; i < pool.length; i++) {
      for (let j = i + 1; j < pool.length; j++) {
        const a = pool[i], b = pool[j];
        if (conceptOf(a.word) === conceptOf(b.word)) continue;
        if (a.word.slice(0, n) === b.word.slice(0, n) && a.word[n] !== b.word[n]) {
          take(a); take(b); break outer;
        }
      }
    }
  }
  for (const e of pool) {
    if (out.length >= 4) break;
    if (!free(e)) continue;
    if (out.some(x => x.word[0] === e.word[0])) continue;  // 填充词与已选词首字母互异
    take(e);
  }
  for (const e of pool) {  // 兜底 (词库极端情况下放宽首字母约束)
    if (out.length >= 4) break;
    if (free(e)) take(e);
  }
  return out;
}
