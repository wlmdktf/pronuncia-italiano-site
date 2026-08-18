// 所有屏幕渲染 + 关卡玩法
import * as A from './audio.js';
import * as P from './progress.js';
import { openParentGate } from './parent.js';

let CUR = null;      // curriculum
let go = null;       // (state) => render
let state = null;

export function init(curriculum, navigate) { CUR = curriculum; go = navigate; }

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids) if (kid != null) el.append(kid);
  return el;
}

const app = () => document.getElementById('app');
const praise = () => 'ui-brava' + (1 + Math.floor(Math.random() * 4));
// 与音频管线一致的 id 转写: 去重音、只留 a-z0-9 (PAPÀ -> word-papa)
const slug = (w) => w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const pickN = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

// 词图优先走课程里的原创插画图集；尚未覆盖的旧词继续用 emoji，便于逐批统一风格。
function pictureFor(w, cls) {
  const pic = w?.word ? CUR?.pictures?.[w.word] : null;
  const atlas = pic ? CUR?.pictureAtlases?.[pic.atlas] : null;
  if (!pic || !atlas) {
    return h('span', { class: `${cls} emoji-visual`, role: 'img', 'aria-label': w?.word || '' }, w?.emoji || '');
  }
  const x = atlas.cols > 1 ? (pic.col / (atlas.cols - 1)) * 100 : 0;
  const y = atlas.rows > 1 ? (pic.row / (atlas.rows - 1)) * 100 : 0;
  const style = `background-image:url('${atlas.src}');background-size:${atlas.cols * 100}% ${atlas.rows * 100}%;background-position:${x}% ${y}%`;
  return h('span', { class: `${cls} picture-visual`, role: 'img', 'aria-label': w.word, style });
}

function confetti() {
  const em = ['🎉', '⭐', '🌟', '🦄', '💜', '🎈'];
  for (let i = 0; i < 14; i++) {
    const s = h('span', { class: 'confetti' }, em[i % em.length]);
    s.style.left = Math.random() * 96 + 'vw';
    s.style.top = '-6vh';
    s.style.animationDelay = (Math.random() * .4) + 's';
    document.body.append(s);
    setTimeout(() => s.remove(), 2200);
  }
}

function topbar(title, backState) {
  return h('div', { class: 'topbar' },
    h('button', { class: 'back', onclick: () => { A.stopAll(); go(backState); } }, '⬅️'),
    h('div', { class: 'title' }, title),
    h('div', { class: 'stars' }, `⭐ ${P.stars()}`));
}

async function celebrate(key, backState) {
  const { newStar, newSticker } = P.markDone(key);
  confetti();
  A.sfx('star');
  await A.play(praise());
  if (newStar) await A.play('ui-star');
  if (newSticker) {
    await A.play('ui-sticker_new');
    await modalSticker(newSticker);
  }
  go(backState);
}

function modalSticker(sticker) {
  return new Promise((resolve) => {
    const ov = document.getElementById('overlay');
    ov.replaceChildren(h('div', { class: 'modal' },
      h('div', { class: 'huge' }, sticker),
      h('h2', {}, 'Un adesivo per te!'),
      h('button', { class: 'round-btn primary', onclick: () => { ov.replaceChildren(); resolve(); } }, '✓')));
  });
}

// ---------- 回声对比 (跟读) ----------
export async function openEcho(modelIds) {
  const ov = document.getElementById('overlay');
  let closed = false;
  const status = h('div', { class: 'echo-status' }, '');
  const icon = h('div', { class: 'huge' }, '👂');
  const btnRow = h('div', { class: 'nav-row' });
  const close = () => { closed = true; A.stopAll(); ov.replaceChildren(); };
  ov.replaceChildren(h('div', { class: 'modal' },
    h('button', { class: 'close-x', onclick: close }, '✖️'), icon, status, btnRow));

  const hasMic = await A.micReady();
  async function round() {
    btnRow.replaceChildren();
    icon.textContent = '👂'; status.textContent = 'Ascolta...';
    await A.playSeq(modelIds, 250);
    if (closed) return;
    let url = null;
    if (hasMic) {
      icon.textContent = '🎙️'; status.textContent = 'Parla dopo il bip!';
      A.sfx('beep'); await A.sleep(350);
      status.textContent = 'Parla!';
      url = await A.recordFor(2600);
      if (closed) return;
      icon.textContent = '👂'; status.textContent = 'Prima io...';
      await A.playSeq(modelIds, 250);
      if (closed) return;
      if (url) { status.textContent = '...poi tu!'; icon.textContent = '🗣️'; await A.playUrl(url); }
    } else {
      icon.textContent = '🗣️'; status.textContent = 'Ripeti ad alta voce!';
      await A.sleep(2400);
      if (closed) return;
      icon.textContent = '👂'; status.textContent = 'Ancora una volta...';
      await A.playSeq(modelIds, 250);
    }
    if (closed) return;
    icon.textContent = '🌟'; status.textContent = 'Che brava!';
    btnRow.replaceChildren(
      h('button', { class: 'round-btn', onclick: round }, '🔁'),
      h('button', { class: 'round-btn primary', onclick: () => { A.sfx('ok'); close(); } }, '✓'));
  }
  round();
}

const micBtn = (modelIds) => h('button', { class: 'round-btn mic', onclick: () => openEcho(modelIds) }, '🎙️');
const soundBtn = (ids, cls = 'round-btn primary') => h('button', { class: cls, onclick: () => A.playSeq(ids, 250) }, '🔊');

function wordCard(w, { slow = false, hlDoppia = false } = {}) {
  const id = 'word-' + slug(w.word);
  let text = w.word;
  if (hlDoppia) {
    const m = w.word.match(/(.)\1/);
    if (m) text = w.word.slice(0, m.index) + `<span class="hl">${m[0]}</span>` + w.word.slice(m.index + 2);
  }
  return h('button', {
    class: 'word-card',
    onclick: () => A.playSeq(slow ? [id + '-slow', id] : [id], 300)
  }, pictureFor(w, 'w-visual'), h('span', { class: 'w-text', html: text }));
}

// ---------- home ----------
export function renderHome() {
  const name = P.nickname();
  const grid = h('div', { class: 'unit-grid' });
  for (const u of CUR.units) {
    const solo = ['mix', 'dettato', 'collega'].includes(u.type);   // 单关板块, 无子菜单
    const total = u.type === 'vocali' ? u.letters.length + (u.casa ? 1 : 0) : (solo ? 1 : 4);
    const dest = solo ? { screen: u.type, idx: 0 } : { screen: 'unit', unitId: u.id };
    const firstAnchor = u.type === 'consonante' ? u.sillabe?.[0]?.anchor : null;
    const unitVisual = firstAnchor && CUR.pictures?.[firstAnchor.word]
      ? firstAnchor : { word: u.title, emoji: u.emoji };
    grid.append(h('button', {
      class: 'unit-card', onclick: () => { A.sfx('tap'); go(dest); }
    },
      pictureFor(unitVisual, 'unit-visual'),
      h('span', { class: 'name' }, u.title),
      h('span', { class: 'done' }, `⭐ ${P.unitDoneCount(u.id, total)}`)));
  }
  app().replaceChildren(
    h('div', { class: 'home-title' }, 'Sillabe Magiche 🦄'),
    h('div', { class: 'home-sub' }, name ? `Ciao, ${name}!` : 'Impara a leggere giocando'),
    grid,
    h('div', { class: 'home-foot' },
      h('button', { class: 'sticker-btn', onclick: openStickers }, `🧸 Adesivi (${P.stickers().length})`),
      gearBtn()));
}

function gearBtn() {
  let timer = null;
  const b = h('button', { class: 'gear-btn' }, '⚙️');
  const start = () => { timer = setTimeout(() => openParentGate(), 1200); };
  const cancel = () => clearTimeout(timer);
  b.addEventListener('pointerdown', start);
  b.addEventListener('pointerup', cancel);
  b.addEventListener('pointerleave', cancel);
  return b;
}

function openStickers() {
  const ov = document.getElementById('overlay');
  const grid = h('div', { class: 'sticker-grid' });
  const owned = P.stickers();
  P.stickerPool.forEach((s, i) => {
    grid.append(h('div', { class: 'sticker-cell' + (i < owned.length ? '' : ' empty') }, i < owned.length ? owned[i] : s));
  });
  ov.replaceChildren(h('div', { class: 'modal' },
    h('button', { class: 'close-x', onclick: () => ov.replaceChildren() }, '✖️'),
    h('h2', {}, 'I miei adesivi'), grid));
}

// ---------- unit menu ----------
export function renderUnit(unitId) {
  const u = CUR.units.find(x => x.id === unitId);
  if (u.type === 'vocali') return renderVocaliGrid(u);
  const acts = [
    ['conosci', '🔍', `Conosci la ${u.letter.grapheme}`],
    ['sillabe', '🧩', 'Le sillabe'],
    ['casa', '🏠', 'La casa dei suoni'],
    ['parole', '📖', 'Le prime parole'],
  ];
  const list = h('div', { class: 'activity-list' });
  for (const [key, emoji, label] of acts) {
    list.append(h('button', {
      class: 'activity-btn', onclick: () => { A.sfx('tap'); go({ screen: key, unitId, idx: 0 }); }
    }, h('span', { class: 'a-emoji' }, emoji), label,
      h('span', { class: 'a-star' }, P.isDone(`${unitId}:${key}`) ? '⭐' : '')));
  }
  app().replaceChildren(topbar(u.title, { screen: 'home' }), list);
}

// ---------- vocali ----------
function renderVocaliGrid(u) {
  const grid = h('div', { class: 'unit-grid' });
  u.letters.forEach((L, i) => {
    grid.append(h('button', {
      class: 'unit-card', onclick: () => { A.sfx('tap'); go({ screen: 'vocale', unitId: u.id, idx: i }); }
    },
      h('span', { class: 'emoji' }, L.anchor.emoji),
      h('span', { class: 'name' }, L.grapheme),
      h('span', { class: 'done' }, P.isDone(`vocali:${L.grapheme}`) ? '⭐' : '')));
  });
  if (u.casa) {
    grid.append(h('button', {
      class: 'unit-card', onclick: () => { A.sfx('tap'); go({ screen: 'casa', unitId: u.id, idx: 0 }); }
    },
      h('span', { class: 'emoji' }, '🏠'),
      h('span', { class: 'name' }, 'La casa dei suoni'),
      h('span', { class: 'done' }, P.isDone(`${u.id}:casa`) ? '⭐' : '')));
  }
  app().replaceChildren(topbar(u.title, { screen: 'home' }), grid);
}

export function renderVocale(unitId, idx) {
  const u = CUR.units.find(x => x.id === unitId);
  const L = u.letters[idx];
  const g = L.grapheme.toLowerCase();
  const key = `vocali:${L.grapheme}`;
  app().replaceChildren(
    topbar(`La vocale ${L.grapheme}`, { screen: 'unit', unitId }),
    h('div', { class: 'stage' },
      h('button', { class: 'big-letter', onclick: () => A.playSeq([`letter-${g}-sound`, `letter-${g}-name`], 300) }, L.grapheme),
      h('div', { class: 'hint-row' },
        h('button', { class: 'chip big', onclick: () => A.play(`letter-${g}-mouth`) }, '🗣️ Come si dice?'),
        micBtn([`letter-${g}-sound`, `letter-${g}-name`])),
      h('div', { class: 'word-row' },
        wordCard({ ...L.anchor }, { slow: true }),
        ...L.extra.map(e => wordCard(e))),
      h('div', { class: 'nav-row' },
        h('button', {
          class: 'round-btn primary',
          onclick: () => celebrate(key, { screen: 'unit', unitId })
        }, P.isDone(key) ? '⭐' : '✓'))));
}

// ---------- conosci (辅音认识) ----------
export function renderConosci(unitId) {
  const u = CUR.units.find(x => x.id === unitId);
  const L = u.letter;
  const g = L.grapheme.toLowerCase();
  app().replaceChildren(
    topbar(`Conosci la ${L.grapheme}`, { screen: 'unit', unitId }),
    h('div', { class: 'stage' },
      h('button', { class: 'big-letter', onclick: () => A.playSeq([`letter-${g}-sound`, `letter-${g}-name`], 300) }, L.grapheme),
      h('div', { class: 'hint-row' },
        h('button', { class: 'chip big', onclick: () => A.play(`letter-${g}-shape`) }, `${u.emoji} La forma`),
        h('button', { class: 'chip big', onclick: () => A.play(`letter-${g}-mouth`) }, '🗣️ Come si dice?'),
        micBtn([`letter-${g}-sound`])),
      h('div', { class: 'nav-row' },
        h('button', {
          class: 'round-btn primary',
          onclick: () => celebrate(`${unitId}:conosci`, { screen: 'unit', unitId })
        }, P.isDone(`${unitId}:conosci`) ? '⭐' : '✓'))));
}

// ---------- sillabe ----------
export function renderSillabe(unitId, idx) {
  const u = CUR.units.find(x => x.id === unitId);
  const S = u.sillabe[idx];
  const cons = u.letter.grapheme;
  const voc = S.s.slice(cons.length);
  const low = S.s.toLowerCase();
  let revealed = false;

  const silTile = h('button', { class: 'tile sil', onclick: reveal }, '❓');
  const nextBtn = h('button', { class: 'round-btn', disabled: '', onclick: next }, '➡️');
  const micB = micBtn([`sil-${low}`, `sil-${low}`]);
  micB.style.visibility = 'hidden';

  async function reveal() {
    silTile.textContent = S.s;
    await A.playSeq([`sil-${low}-slow`, `sil-${low}`], 350);
    if (!revealed) {
      revealed = true;
      nextBtn.removeAttribute('disabled');
      micB.style.visibility = 'visible';
      anchorWrap.style.visibility = 'visible';
      A.sfx('ok');
    }
  }
  function next() {
    A.stopAll();
    if (idx + 1 < u.sillabe.length) go({ screen: 'sillabe', unitId, idx: idx + 1 });
    else celebrate(`${unitId}:sillabe`, { screen: 'unit', unitId });
  }

  const anchorWrap = h('div', { class: 'word-row' }, wordCard(S.anchor, { slow: true }));
  anchorWrap.style.visibility = 'hidden';

  const dots = h('div', { class: 'dots' },
    ...u.sillabe.map((_, i) => h('i', { class: i === idx ? 'on' : '' })));

  app().replaceChildren(
    topbar('Le sillabe', { screen: 'unit', unitId }),
    h('div', { class: 'stage' },
      dots,
      h('div', { class: 'merge-row' },
        h('button', { class: 'tile c', onclick: () => A.play(`letter-${cons.toLowerCase()}-sound`) }, cons),
        h('span', { class: 'merge-eq' }, '+'),
        h('button', { class: 'tile v', onclick: () => A.play(`letter-${voc.toLowerCase()}-sound`) }, voc),
        h('span', { class: 'merge-eq' }, '='),
        silTile),
      h('div', { class: 'hint-row' }, soundBtn([`sil-${low}-slow`, `sil-${low}`]), micB),
      anchorWrap,
      h('div', { class: 'nav-row' }, nextBtn)));
}

// ---------- casa dei suoni ----------
export function renderCasa(unitId, idx) {
  const u = CUR.units.find(x => x.id === unitId);
  const row = u.casa[idx];
  const low = row.s.toLowerCase();
  // 元音房 (单字母) 播字母音, 辅音房播音节
  const houseSound = row.s.length === 1 ? `letter-${low}-sound` : `sil-${low}`;
  let found = 0;

  // 题库抽卡: 每轮从池子里随机抽 2 正确 + 2 干扰, 重复玩不重样
  const chosen = [...pickN(row.correct, 2).map(w => ({ ...w, ok: true })),
                  ...pickN(row.wrong, 2).map(w => ({ ...w, ok: false }))]
    .sort(() => Math.random() - 0.5);
  const target = chosen.filter(c => c.ok).length;

  const grid = h('div', { class: 'pick-grid' });
  for (const c of chosen) {
    const id = 'word-' + slug(c.word);
    const btn = h('button', { class: 'pick-card' }, pictureFor(c, 'pick-visual'));
    btn.addEventListener('click', async () => {
      await A.play(id);
      if (c.ok) {
        A.sfx('ok');
        btn.classList.add('gone');
        found++;
        if (found === target) {
          await A.play(praise());
          if (idx + 1 < u.casa.length) go({ screen: 'casa', unitId, idx: idx + 1 });
          else celebrate(`${unitId}:casa`, { screen: 'unit', unitId });
        }
      } else {
        A.sfx('no');
        btn.classList.remove('no'); void btn.offsetWidth; btn.classList.add('no');
      }
    });
    grid.append(btn);
  }

  app().replaceChildren(
    topbar('La casa dei suoni', { screen: 'unit', unitId }),
    h('div', { class: 'stage' },
      h('div', { class: 'dots' }, ...u.casa.map((_, i) => h('i', { class: i === idx ? 'on' : '' }))),
      h('button', { class: 'house', onclick: () => A.playSeq(['ui-which_house', houseSound], 300) },
        h('span', { class: 'h-emoji' }, '🏠'), row.s),
      grid));
  A.playSeq(['ui-which_house', houseSound], 300);
}

// ---------- 拼词引擎 (prime parole 与 mescola 共用) ----------
function renderWordBuilder({ title, W, dotsTotal, dotsIdx, sylPool, nDistract, backState, onNext }) {
  const wid = 'word-' + slug(W.word);
  let filled = 0;

  const slots = W.sillabe.map(() => h('div', { class: 'slot' }, '·'));
  const needed = [...W.sillabe];
  const distract = pickN(sylPool.filter(s => !needed.includes(s)), nDistract);
  const options = pickN([...new Set([...needed, ...distract])], 99);

  const result = h('div', { class: 'word-row' });
  const tiles = h('div', { class: 'merge-row' });
  for (const s of options) {
    const t = h('button', { class: 'tile sil', onclick: async () => {
      const expect = W.sillabe[filled];
      const partId = s.length === 1 ? `letter-${s.toLowerCase()}-sound` : `sil-${s.toLowerCase()}`;
      await A.play(partId);
      if (s === expect) {
        slots[filled].textContent = s;
        slots[filled].classList.add('filled');
        filled++;
        A.sfx('ok');
        if (filled === W.sillabe.length) complete();
      } else {
        A.sfx('no');
        t.classList.remove('no'); void t.offsetWidth; t.classList.add('no');
      }
    } }, s);
    tiles.append(t);
  }

  async function complete() {
    tiles.style.visibility = 'hidden';
    goal.style.display = 'none';
    result.replaceChildren(wordCard(W, { slow: true, hlDoppia: W.doppia }), micBtn([wid]));
    await A.playSeq([wid + '-slow', wid], 350);
    await A.play(praise());
    nextBtn.removeAttribute('disabled');
  }
  const nextBtn = h('button', { class: 'round-btn', disabled: '', onclick: () => {
    A.stopAll();
    onNext();
  } }, '➡️');

  // 目标图卡: 先听要拼的词, 随时可点重听 (文字拼完才揭晓)
  const goal = h('button', { class: 'word-card goal', onclick: () => A.play(wid) },
    pictureFor(W, 'w-visual'),
    h('span', { class: 'goal-hint' }, '🔊'));

  app().replaceChildren(
    topbar(title, backState),
    h('div', { class: 'stage' },
      h('div', { class: 'dots' }, ...Array.from({ length: dotsTotal }, (_, i) => h('i', { class: i === dotsIdx ? 'on' : '' }))),
      goal,
      h('div', { class: 'slot-row' }, ...slots),
      tiles, result,
      h('div', { class: 'nav-row' }, nextBtn)));
  A.playSeq(['ui-make_word', wid], 350);
}

// ---------- prime parole (单元内, 1 个干扰项) ----------
export function renderParole(unitId, idx) {
  const u = CUR.units.find(x => x.id === unitId);
  renderWordBuilder({
    title: 'Le prime parole',
    W: u.parole[idx],
    dotsTotal: u.parole.length,
    dotsIdx: idx,
    sylPool: u.sillabe.map(s => s.s),
    nDistract: 1,
    backState: { screen: 'unit', unitId },
    onNext: () => {
      if (idx + 1 < u.parole.length) go({ screen: 'parole', unitId, idx: idx + 1 });
      else celebrate(`${unitId}:parole`, { screen: 'unit', unitId });
    },
  });
}

// ---------- mescola le sillabe (全部音节混合, 2 个干扰项, 每轮随机 8 词) ----------
const MIX_ROUND = 8;
export function renderMix(state) {
  if (!state.words) {
    const pool = CUR.units.flatMap(u => u.parole || []);
    state.words = pickN(pool, MIX_ROUND);
  }
  const allSyl = CUR.units.filter(u => u.type === 'consonante').flatMap(u => u.sillabe.map(s => s.s));
  const idx = state.idx || 0;
  renderWordBuilder({
    title: 'Mescola le sillabe',
    W: state.words[idx],
    dotsTotal: state.words.length,
    dotsIdx: idx,
    sylPool: allSyl,
    nDistract: 2,
    backState: { screen: 'home' },
    onNext: () => {
      if (idx + 1 < state.words.length) go({ screen: 'mix', idx: idx + 1, words: state.words });
      else celebrate('mix:parole', { screen: 'home' });
    },
  });
}

// ---------- Ascolta e scrivi (听音节 → 填字母, 干扰项取自 curriculum.confusable) ----------
const DETTATO_ROUND = 8;

function optionsFor(letter, pool, n) {
  const near = pickN((CUR.confusable?.[letter] || []).filter(x => x !== letter && pool.includes(x)), n - 1);
  const picked = [letter, ...near];
  if (picked.length < n) picked.push(...pickN(pool.filter(x => !picked.includes(x)), n - picked.length));
  return picked;
}

export function renderDettato(state) {
  const consUnits = CUR.units.filter(u => u.type === 'consonante');
  const consLetters = consUnits.map(u => u.letter.grapheme);
  const vocLetters = CUR.units.find(u => u.type === 'vocali').letters.map(l => l.grapheme);
  if (!state.items) state.items = pickN(consUnits.flatMap(u => u.sillabe.map(s => s.s)), DETTATO_ROUND);

  const idx = state.idx || 0;
  const syl = state.items[idx];
  const low = syl.toLowerCase();
  const target = [syl[0], syl[1]];   // 音节固定为 辅音+元音
  let filled = 0;

  const slots = [h('div', { class: 'slot c' }, '·'), h('div', { class: 'slot v' }, '·')];
  const pad = h('div', { class: 'letter-pad' });
  const letters = pickN([...optionsFor(target[0], consLetters, 3),
                         ...optionsFor(target[1], vocLetters, 3)], 99);
  for (const L of letters) {
    const isVoc = vocLetters.includes(L);
    const b = h('button', { class: 'tile lett ' + (isVoc ? 'v' : 'c') }, L);
    b.addEventListener('click', async () => {
      if (filled >= 2) return;
      await A.play(`letter-${L.toLowerCase()}-sound`);
      if (filled >= 2) return;                    // 音频期间可能已被别的点击填满
      if (L === target[filled]) {
        slots[filled].textContent = L;
        slots[filled].classList.add('filled');
        filled++;
        A.sfx('ok');
        if (filled === 2) complete();
      } else {
        A.sfx('no');
        b.classList.remove('no'); void b.offsetWidth; b.classList.add('no');
      }
    });
    pad.append(b);
  }

  async function complete() {
    pad.style.visibility = 'hidden';
    await A.playSeq([`sil-${low}-slow`, `sil-${low}`], 300);
    await A.play(praise());
    nextBtn.removeAttribute('disabled');
  }

  const nextBtn = h('button', { class: 'round-btn', disabled: '', onclick: () => {
    A.stopAll();
    if (idx + 1 < state.items.length) go({ screen: 'dettato', idx: idx + 1, items: state.items });
    else celebrate('dettato:round', { screen: 'home' });
  } }, '➡️');

  app().replaceChildren(
    topbar('Ascolta e scrivi', { screen: 'home' }),
    h('div', { class: 'stage' },
      h('div', { class: 'dots' }, ...state.items.map((_, i) => h('i', { class: i === idx ? 'on' : '' }))),
      h('button', { class: 'round-btn primary big-ear', onclick: () => A.play(`sil-${low}`) }, '🔊'),
      h('div', { class: 'slot-row' }, ...slots),
      pad,
      h('div', { class: 'nav-row' }, nextBtn)));
  A.playSeq(['ui-listen_write', `sil-${low}`], 350);
}

// ---------- Collega le parole (图词连线: 读首字母/首音节找图) ----------
const COLLEGA_ROUNDS = 3;
const PAIR_COLORS = ['#8f6ae0', '#3bbf8f', '#ff9a76', '#5c7de0'];

// 连线关排除抽象/符号类配图 (数字、色块、手势、抽象概念) — 图必须一眼看出是什么东西
const COLLEGA_EXCLUDE = new Set(['1️⃣', '2️⃣', '9️⃣', '🔢', '⚫', '🤫', '👍', '🌑', '🕳️', '💰', '😴', '📛', '☸️']);

function collegaBank() {
  // 全词库: 去重 (同词取首个 emoji), 剔除抽象配图
  const seen = new Map();
  const put = (w) => {
    if (w && !seen.has(w.word) && !COLLEGA_EXCLUDE.has(w.emoji)) {
      seen.set(w.word, { word: w.word, emoji: w.emoji });
    }
  };
  for (const u of CUR.units) {
    if (u.type === 'vocali') {
      for (const L of u.letters) { put(L.anchor); (L.extra || []).forEach(put); }
    }
    if (u.type === 'consonante') {
      u.sillabe.forEach(s => put(s.anchor));
      (u.casa || []).forEach(r => { r.correct.forEach(put); r.wrong.forEach(put); });
    }
    (u.parole || []).forEach(put);
  }
  return [...seen.values()];
}

function buildCollegaRound(tier) {
  // easy: 4 词首字母全不同 | medium: 含一对同首字母异元音 | hard: 含一对同首音节
  const bank = pickN(collegaBank(), 9999);
  const out = [], usedW = new Set(), usedE = new Set();
  const take = (e) => { out.push(e); usedW.add(e.word); usedE.add(e.emoji); };
  if (tier !== 'easy') {
    const n = tier === 'hard' ? 2 : 1;
    outer:
    for (let i = 0; i < bank.length; i++) {
      for (let j = i + 1; j < bank.length; j++) {
        const a = bank[i], b = bank[j];
        if (a.emoji === b.emoji) continue;
        if (a.word.slice(0, n) === b.word.slice(0, n) && a.word[n] !== b.word[n]) {
          take(a); take(b); break outer;
        }
      }
    }
  }
  for (const e of bank) {
    if (out.length >= 4) break;
    if (usedW.has(e.word) || usedE.has(e.emoji)) continue;
    if (out.some(x => x.word[0] === e.word[0])) continue;  // 填充词与已选词首字母互异
    take(e);
  }
  for (const e of bank) {  // 兜底 (词库极端情况下放宽首字母约束)
    if (out.length >= 4) break;
    if (!usedW.has(e.word) && !usedE.has(e.emoji)) take(e);
  }
  return out;
}

export function renderCollega(state) {
  if (!state.rounds) state.rounds = ['easy', 'medium', 'hard'].slice(0, COLLEGA_ROUNDS).map(buildCollegaRound);
  const r = state.r || 0;
  const entries = state.rounds[r];
  const wordOrder = pickN(entries, entries.length);
  let matchedCount = 0;
  let selected = null;          // 点选模式当前选中的图卡
  const matches = [];           // {picEl, wrdEl, color}

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'collega-svg');
  const board = h('div', { class: 'collega-board' });
  const colL = h('div', { class: 'collega-col' });
  const colR = h('div', { class: 'collega-col' });
  board.append(colL, colR, svg);

  const mkLine = (color) => {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    l.setAttribute('stroke', color);
    svg.append(l);
    return l;
  };
  const dotPos = (card, side) => {
    const b = board.getBoundingClientRect(), c = card.getBoundingClientRect();
    return [side === 'r' ? c.right - b.left + 8 : c.left - b.left - 8, c.top - b.top + c.height / 2];
  };
  const setLine = (l, x1, y1, x2, y2) => {
    l.setAttribute('x1', x1); l.setAttribute('y1', y1);
    l.setAttribute('x2', x2); l.setAttribute('y2', y2);
  };
  const redraw = () => {
    for (const m of matches) {
      const [x1, y1] = dotPos(m.picEl, 'r'), [x2, y2] = dotPos(m.wrdEl, 'l');
      setLine(m.lineEl, x1, y1, x2, y2);
    }
  };
  new ResizeObserver(redraw).observe(board);

  function judge(picEl, wrdEl) {
    if (wrdEl.classList.contains('done')) return;
    if (picEl.dataset.word === wrdEl.dataset.word) {
      const color = PAIR_COLORS[matchedCount % PAIR_COLORS.length];
      const lineEl = mkLine(color);
      matches.push({ picEl, wrdEl, lineEl });
      redraw();
      picEl.classList.add('done'); wrdEl.classList.add('done');
      picEl.classList.remove('sel');
      selected = null;
      matchedCount++;
      A.sfx('ok');
      A.play('word-' + slug(picEl.dataset.word)).then(async () => {
        if (matchedCount === entries.length) {
          await A.play(praise());
          if (r + 1 < state.rounds.length) go({ screen: 'collega', r: r + 1, rounds: state.rounds });
          else celebrate('collega:round', { screen: 'home' });
        }
      });
    } else {
      A.sfx('no');
      wrdEl.classList.remove('no'); void wrdEl.offsetWidth; wrdEl.classList.add('no');
      if (selected) { selected.classList.remove('sel'); selected = null; }
    }
  }

  for (const e of entries) {
    const pic = h('div', { class: 'ccard pic', 'data-word': e.word }, pictureFor(e, 'collega-visual'), h('span', { class: 'dot' }));
    pic.addEventListener('pointerdown', (ev) => {
      if (pic.classList.contains('done')) return;
      ev.preventDefault();
      A.sfx('tap');
      if (selected) selected.classList.remove('sel');
      selected = pic;
      pic.classList.add('sel');
      // 拖线模式: 跟手画临时线, 抬手时命中词卡则判定
      const temp = mkLine('#b9a8e6');
      const [x1, y1] = dotPos(pic, 'r');
      setLine(temp, x1, y1, x1, y1);
      const bb = board.getBoundingClientRect();
      const move = (mv) => setLine(temp, x1, y1, mv.clientX - bb.left, mv.clientY - bb.top);
      const up = (uv) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        temp.remove();
        const hit = document.elementFromPoint(uv.clientX, uv.clientY)?.closest('.ccard.wrd');
        if (hit) judge(pic, hit);
        // 未命中词卡 = 点选模式, 保持选中等待点词
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
    });
    colL.append(pic);
  }
  for (const e of wordOrder) {
    const wrd = h('div', { class: 'ccard wrd', 'data-word': e.word }, e.word, h('span', { class: 'dot' }));
    wrd.addEventListener('click', () => { if (selected) judge(selected, wrd); });
    colR.append(wrd);
  }

  app().replaceChildren(
    topbar('Collega le parole', { screen: 'home' }),
    h('div', { class: 'stage' },
      h('div', { class: 'dots' }, ...state.rounds.map((_, i) => h('i', { class: i === r ? 'on' : '' }))),
      board));
  if (r === 0) A.play('ui-collega');
}

// ---------- splash ----------
export function renderSplash(onStart) {
  app().replaceChildren(
    h('div', { class: 'stage' },
      h('div', { class: 'home-title' }, 'Sillabe Magiche'),
      h('div', { style: 'font-size:clamp(80px,18vw,150px)' }, '🦄'),
      h('button', {
        class: 'chip big', style: 'font-size:clamp(26px,5vw,38px);padding:20px 44px;background:linear-gradient(135deg,#8f6ae0,#6a8ae0);color:#fff;box-shadow:0 6px 0 #5443a8',
        onclick: onStart
      }, '▶️ GIOCA')));
}
