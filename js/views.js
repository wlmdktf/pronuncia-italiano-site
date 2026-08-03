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
  }, h('span', { class: 'w-emoji' }, w.emoji), h('span', { class: 'w-text', html: text }));
}

// ---------- home ----------
export function renderHome() {
  const name = P.nickname();
  const grid = h('div', { class: 'unit-grid' });
  for (const u of CUR.units) {
    const total = u.type === 'vocali' ? u.letters.length + (u.casa ? 1 : 0) : 4;
    grid.append(h('button', {
      class: 'unit-card', onclick: () => { A.sfx('tap'); go({ screen: 'unit', unitId: u.id }); }
    },
      h('span', { class: 'emoji' }, u.emoji),
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
    const btn = h('button', { class: 'pick-card' }, c.emoji);
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

// ---------- prime parole ----------
export function renderParole(unitId, idx) {
  const u = CUR.units.find(x => x.id === unitId);
  const W = u.parole[idx];
  const wid = 'word-' + slug(W.word);
  let filled = 0;

  const slots = W.sillabe.map(() => h('div', { class: 'slot' }, '·'));
  // 音节选项: 需要的音节 + 1 个干扰项
  const needed = [...W.sillabe];
  const distractor = u.sillabe.map(s => s.s).find(s => !needed.includes(s));
  const options = [...new Set([...needed, distractor])].sort(() => Math.random() - 0.5);

  const result = h('div', { class: 'word-row' });
  const tiles = h('div', { class: 'merge-row' });
  for (const s of options) {
    const t = h('button', { class: 'tile sil', onclick: async () => {
      const expect = W.sillabe[filled];
      await A.play('sil-' + s.toLowerCase());
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
    result.replaceChildren(wordCard(W, { slow: true, hlDoppia: W.doppia }), micBtn([wid]));
    await A.playSeq([wid + '-slow', wid], 350);
    await A.play(praise());
    nextBtn.removeAttribute('disabled');
  }
  const nextBtn = h('button', { class: 'round-btn', disabled: '', onclick: () => {
    A.stopAll();
    if (idx + 1 < u.parole.length) go({ screen: 'parole', unitId, idx: idx + 1 });
    else celebrate(`${unitId}:parole`, { screen: 'unit', unitId });
  } }, '➡️');

  app().replaceChildren(
    topbar('Le prime parole', { screen: 'unit', unitId }),
    h('div', { class: 'stage' },
      h('div', { class: 'dots' }, ...u.parole.map((_, i) => h('i', { class: i === idx ? 'on' : '' }))),
      h('button', { class: 'chip', onclick: () => A.play('ui-make_word') }, '🧩 Unisci le sillabe!'),
      h('div', { class: 'slot-row' }, ...slots),
      tiles, result,
      h('div', { class: 'nav-row' }, nextBtn)));
  A.play('ui-make_word');
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
