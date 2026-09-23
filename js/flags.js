// 内容纠错标记: 家长陪练时随手记下读音 / 图 / 词的问题, 只存本机, 家长区导出交给 Claude。
// 与进度分开保存: 重置、导入进度都不影响标记。导出格式与处理流程见 docs/content-flags.md。
const KEY = 'sillabe-flags-v1';
const MODE_KEY = 'sillabe-flag-mode-v1';
export const FORMAT = 'sillabe-content-flags';
export const KINDS = ['audio', 'picture', 'word', 'other'];
const MAX_FLAGS = 500;
const MAX_NOTE = 500;

function load() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function list() { return load(); }

export function add(entry) {
  if (!KINDS.includes(entry?.kind)) throw new Error('请先选择问题类型。');
  const flags = load();
  if (flags.length >= MAX_FLAGS) throw new Error(`已存 ${MAX_FLAGS} 条，请先在家长区导出再清空。`);
  const text = (v) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 200) : null);
  const flag = {
    id: 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    at: new Date().toISOString(),
    word: text(entry.word),
    kind: entry.kind,
    note: String(entry.note ?? '').trim().slice(0, MAX_NOTE),
    screen: text(entry.screen),
    unit: text(entry.unit),
    place: text(entry.place),
    item: text(entry.item),
    audio: text(entry.audio),
    wordAudio: text(entry.wordAudio),
    recentAudio: (Array.isArray(entry.recentAudio) ? entry.recentAudio : []).filter(id => typeof id === 'string').slice(0, 5),
    picture: text(entry.picture),
    build: text(entry.build),
    curriculumVersion: Number.isInteger(entry.curriculumVersion) ? entry.curriculumVersion : null,
  };
  // 先写入成功再返回; 存储已满时抛错, 界面提示且不丢已有标记。
  localStorage.setItem(KEY, JSON.stringify([...flags, flag]));
  return flag;
}

export function remove(id) {
  localStorage.setItem(KEY, JSON.stringify(load().filter(f => f.id !== id)));
}

export function clear() { localStorage.removeItem(KEY); }

export function exportText(meta = {}) {
  const flags = load();
  return JSON.stringify({
    format: FORMAT, version: 1, exportedAt: new Date().toISOString(),
    build: meta.build ?? null, curriculumVersion: meta.curriculumVersion ?? null,
    count: flags.length, flags,
  }, null, 2);
}

// 陪练纠错模式: 开启后练习页顶栏出现 🚩; 关闭只隐藏入口, 已记下的标记保留。
export function modeOn() {
  try { return localStorage.getItem(MODE_KEY) === '1'; } catch { return false; }
}

export function setMode(on) {
  if (on) localStorage.setItem(MODE_KEY, '1');
  else localStorage.removeItem(MODE_KEY);
}
