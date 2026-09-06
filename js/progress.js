// 进度保存在本机；每 4 颗星解锁一张贴纸。家长可备份/迁移或补回遗失的奖励。
const KEY = 'sillabe-progress-v1';
const UNDO_KEY = 'sillabe-progress-before-restore-v1';
const BACKUP_FORMAT = 'sillabe-progress';
const STICKER_POOL = ['🦄', '🌟', '🍭', '🧸', '🎈', '🐬', '🦋', '🌈', '🍦', '🐣', '💎', '🎀', '🚀', '🐳', '🌸', '🍓'];

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; }
}
function save(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

let p = Object.assign({ done: {}, stickers: [], nickname: '', recoveredStars: 0 }, load());

export function stars() { return Object.keys(p.done).length + p.recoveredStars; }
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

export function resetAll() {
  replaceWithUndo({ done: {}, stickers: [], nickname: p.nickname, recoveredStars: 0 });
}

function snapshot() { return JSON.parse(JSON.stringify(p)); }

// 先写成功，再替换内存；空间不足时仍保留当前进度。
function replaceWithUndo(next) {
  localStorage.setItem(UNDO_KEY, JSON.stringify(p));
  save(next);
  p = next;
}

export function hasUndo() { return !!localStorage.getItem(UNDO_KEY); }

export function undoRestore() {
  const raw = localStorage.getItem(UNDO_KEY);
  if (!raw) throw new Error('没有可撤销的恢复操作。');
  const next = validateProgress(JSON.parse(raw));
  // 交换两份记录，撤销后也可找回撤销前的状态。
  replaceWithUndo(next);
}

export function restoreFourteenStickers() {
  if (p.stickers.length >= 14) return false;
  const next = snapshot();
  // 不虚构已完成关卡；补回奖励对应的历史星星，现有学习记录保留。
  next.recoveredStars += Math.max(0, 56 - stars());
  next.stickers = STICKER_POOL.slice(0, 14);
  replaceWithUndo(next);
  return true;
}

export function exportBackup() {
  return JSON.stringify({ format: BACKUP_FORMAT, version: 1,
    exportedAt: new Date().toISOString(), progress: snapshot() }, null, 2);
}

function validateProgress(value) {
  const invalid = () => { throw new Error('备份中的进度无效，请使用“导出进度备份”生成的文件或文字。'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
  const { done, stickers, nickname, recoveredStars = 0 } = value;
  if (!done || typeof done !== 'object' || Array.isArray(done) ||
      !Array.isArray(stickers) || typeof nickname !== 'string' || nickname.length > 200 ||
      !Number.isSafeInteger(recoveredStars) || recoveredStars < 0) invalid();
  const entries = Object.entries(done);
  if (entries.length > 10000 || entries.some(([key, v]) =>
    !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,199}$/.test(key) ||
    ['__proto__', 'constructor', 'prototype'].includes(key) || v !== 1)) invalid();
  const total = entries.length + recoveredStars;
  if (total > 10000 || stickers.length !== Math.floor(total / 4) ||
      stickers.some((s, i) => s !== STICKER_POOL[i % STICKER_POOL.length])) invalid();
  return { done: Object.fromEntries(entries), stickers: [...stickers], nickname, recoveredStars };
}

function parseBackup(text) {
  if (typeof text !== 'string' || text.length > 1000000) throw new Error('备份内容过大或格式不正确。');
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('无法读取备份，请粘贴完整备份文字或选择 JSON 备份文件。'); }
  if (!payload || payload.format !== BACKUP_FORMAT || payload.version !== 1) {
    throw new Error('这不是支持的进度备份；音频验收结果不能用来恢复贴纸。');
  }
  return validateProgress(payload.progress);
}

export function previewBackup(text) {
  const next = parseBackup(text);
  return { stars: Object.keys(next.done).length + next.recoveredStars,
    stickers: next.stickers.length, nickname: next.nickname };
}

export function importBackup(text) {
  replaceWithUndo(parseBackup(text));
}

export const stickerPool = STICKER_POOL;
