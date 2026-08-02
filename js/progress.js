// 进度: 星星(每关首次完成) + 贴纸(每单元完成) — localStorage
const KEY = 'sillabe-progress-v1';
const STICKER_POOL = ['🦄', '🌟', '🍭', '🧸', '🎈', '🐬', '🦋', '🌈', '🍦', '🐣', '💎', '🎀', '🚀', '🐳', '🌸', '🍓'];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

const p = Object.assign({ done: {}, stickers: [], nickname: '' }, load());

export function stars() { return Object.keys(p.done).length; }
export function stickers() { return p.stickers; }
export function nickname() { return p.nickname; }
export function setNickname(n) { p.nickname = n.trim(); save(p); }

export function isDone(key) { return !!p.done[key]; }

export function markDone(key) {
  // 返回 {newStar, newSticker}
  if (p.done[key]) return { newStar: false, newSticker: null };
  p.done[key] = 1;
  let newSticker = null;
  if (stars() % 4 === 0) { // 每 4 颗星解锁一张贴纸
    newSticker = STICKER_POOL[p.stickers.length % STICKER_POOL.length];
    p.stickers.push(newSticker);
  }
  save(p);
  return { newStar: true, newSticker };
}

export function unitDoneCount(unitId, total) {
  const n = Object.keys(p.done).filter(k => k.startsWith(unitId + ':')).length;
  return `${n}/${total}`;
}

export function resetAll() { p.done = {}; p.stickers = []; save(p); }

export const stickerPool = STICKER_POOL;
