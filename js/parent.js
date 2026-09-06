// 家长角: 长按齿轮 → 算术门 → 面板 (音频验收 / 设置) — 家长界面用中文
import { h } from './views.js';
import * as A from './audio.js';
import * as P from './progress.js';

const REVIEW_KEY = 'sillabe-review-v1';
const ov = () => document.getElementById('overlay');

function loadReview() {
  try { return JSON.parse(localStorage.getItem(REVIEW_KEY)) || {}; } catch { return {}; }
}
function saveReview(r) { localStorage.setItem(REVIEW_KEY, JSON.stringify(r)); }

function progressTools(onChange) {
  const status = h('div', { role: 'status', 'aria-live': 'polite', class: 'progress-status' });
  const backupText = h('textarea', { 'aria-label': '进度备份文字', placeholder: '在这里粘贴从另一台设备导出的完整进度备份', spellcheck: 'false' });
  const confirmation = h('div', { class: 'progress-confirm', 'aria-live': 'polite' });
  function ask(message, action) {
    status.textContent = '';
    confirmation.replaceChildren(h('p', {}, message),
      h('button', { class: 'pbtn', onclick: () => { confirmation.replaceChildren(); run(action); } }, '确认恢复'),
      h('button', { class: 'pbtn ghost', onclick: () => { confirmation.replaceChildren(); status.textContent = '已取消，进度未更改。'; } }, '取消'));
    confirmation.scrollIntoView({ block: 'nearest' });
  }
  const undo = h('button', { class: 'pbtn ghost', onclick: () => {
    ask('恢复为上次导入、补回或重置之前的进度？此后的新进度会暂时移开，可再次点此按钮找回。',
      () => { P.undoRestore(); return '已撤销。星星和贴纸已更新。'; });
  } }, '↩ 撤销上次恢复 / 重置');
  undo.disabled = !P.hasUndo();
  function run(action) {
    try {
      status.textContent = action();
      undo.disabled = !P.hasUndo();
      onChange();
      window.dispatchEvent(new Event('progresschange'));
    } catch (err) {
      status.textContent = `操作未完成：${err.message}`;
    }
  }
  const exportProgress = () => {
    backupText.value = P.exportBackup();
    const url = URL.createObjectURL(new Blob([backupText.value], { type: 'application/json' }));
    const link = h('a', { href: url, download: `sillabe-progress-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    status.textContent = '已生成备份。请将下载的文件保存到 iCloud 云盘等位置；也可复制下方完整文字，自行发送到另一台设备。';
  };
  const importProgress = () => {
    try {
      const text = backupText.value;
      const preview = P.previewBackup(text);
      ask(`备份：${preview.stars} 颗星、${preview.stickers} 张贴纸${preview.nickname ? `，昵称 ${preview.nickname}` : ''}。将替换本机现有的 ${P.stars()} 颗星、${P.stickers().length} 张贴纸和关卡记录，不会合并。确认导入？可撤销。`,
        () => { P.importBackup(text); return '导入成功，星星、贴纸和关卡记录已恢复。'; });
    } catch (err) { status.textContent = err.message; }
  };
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', 'aria-label': '选择进度备份文件', onchange: async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('备份文件过大，请选择进度备份 JSON 文件。');
      backupText.value = await file.text();
      const preview = P.previewBackup(backupText.value);
      status.textContent = `已读取备份：${preview.stars} 颗星、${preview.stickers} 张贴纸。点击“导入进度备份”完成恢复。`;
    } catch (err) { backupText.value = ''; status.textContent = err.message; }
    fileInput.value = '';
  } });
  return h('section', { class: 'progress-tools' },
    h('h3', {}, '🧸 换设备 / 恢复贴纸'),
    h('p', {}, '进度只保存在当前设备，不会自动同步。换设备前请导出备份，再在新设备平时使用的 App 入口导入。'),
    h('button', { class: 'pbtn', onclick: () => {
      if (P.stickers().length >= 14) { status.textContent = '本机已有至少 14 张贴纸，无需补回。'; return; }
      ask('补回前 14 张贴纸，最后的 🌸 和 🍓 继续通过练习获得。按 56 颗星恢复奖励，保留本机已有的关卡记录；无法找回旧设备具体完成过的关卡。确认恢复？',
        () => { P.restoreFourteenStickers(); return '已恢复 14/16 张贴纸！再获得 8 颗新星星即可拿到最后两张。'; });
    } }, '恢复前 14 张贴纸（还差 2 张）'),
    h('p', {}, '旧设备已丢失进度时可用上方按钮。按 14 张贴纸对应的最低 56 颗星补回，具体关卡不作猜测。'),
    h('h3', {}, '💾 进度备份与导入'),
    h('button', { class: 'pbtn', onclick: () => { try { exportProgress(); } catch (err) { status.textContent = `下载未完成，可复制下方备份文字：${err.message}`; } } }, '导出进度备份'),
    h('button', { class: 'pbtn ghost', onclick: async () => {
      backupText.value = P.exportBackup();
      try { await navigator.clipboard.writeText(backupText.value); status.textContent = '已复制当前进度备份，请保存到备忘录或自行发送到新设备。'; }
      catch { backupText.focus(); backupText.select(); status.textContent = '请长按下方文字，选择全选并复制。'; }
    } }, '复制当前进度备份'),
    h('p', {}, '选择备份文件，或在下方粘贴完整备份文字，然后导入。导入会替换本机进度，并保留一份本机撤销记录。'),
    fileInput, backupText,
    h('button', { class: 'pbtn', onclick: importProgress }, '导入进度备份'),
    undo, confirmation, status);
}

export function openParentGate() {
  const a = 2 + Math.floor(Math.random() * 7), b = 2 + Math.floor(Math.random() * 7);
  let typed = '';
  const display = h('div', { class: 'gate-num' }, '_');
  const pad = h('div', { class: 'gate-pad' });
  for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]) {
    pad.append(h('button', { onclick: () => {
      typed += n;
      display.textContent = typed;
      if (typed.length >= String(a + b).length) {
        if (parseInt(typed) === a + b) openPanel();
        else { typed = ''; display.textContent = '_'; A.sfx('no'); }
      }
    } }, String(n)));
  }
  ov().replaceChildren(h('div', { class: 'modal' },
    h('button', { class: 'close-x', onclick: () => ov().replaceChildren() }, '✖️'),
    h('h2', {}, `家长区: ${a} + ${b} = ?`),
    display, pad));
}

async function openPanel() {
  let manifest = {}, version = null;
  try { manifest = await (await fetch('data/manifest.json')).json(); } catch {}
  try { version = await (await fetch('data/version.json')).json(); } catch {}
  const review = loadReview();
  const ids = Object.keys(manifest).sort();
  const pending = ids.filter(id => ['manual', 'check', 'mismatch'].includes(manifest[id].qa));
  let filter = 'pending';

  const listWrap = h('div', {});
  function renderList() {
    const show = filter === 'pending' ? pending : ids;
    listWrap.replaceChildren(...show.map(id => {
      const m = manifest[id];
      const st = review[id];
      const badge = m.qa === 'ok'
        ? h('span', { class: 'badge ok' }, '机检✓')
        : h('span', { class: 'badge warn' }, m.qa === 'mismatch' ? '机检✗' : '待人工');
      const okBtn = h('button', { class: st === 'ok' ? 'sel-ok' : '', onclick: () => { review[id] = 'ok'; saveReview(review); renderList(); } }, '👍');
      const badBtn = h('button', { class: st === 'bad' ? 'sel-bad' : '', onclick: () => { review[id] = 'bad'; saveReview(review); renderList(); } }, '👎');
      return h('div', { class: 'row' },
        h('button', { onclick: () => A.play(id) }, '▶'),
        h('span', { class: 'rid' }, id), badge, okBtn, badBtn);
    }));
  }
  renderList();

  const exportArea = h('textarea', { readonly: '' });
  const doExport = () => {
    const bad = Object.entries(review).filter(([, v]) => v === 'bad').map(([k]) => k);
    const payload = { date: new Date().toISOString().slice(0, 10), reviewed: Object.keys(review).length, bad };
    exportArea.value = JSON.stringify(payload, null, 1);
    exportArea.style.display = 'block';
    navigator.clipboard && navigator.clipboard.writeText(exportArea.value).catch(() => {});
  };

  const nick = h('input', { type: 'text', value: P.nickname(), placeholder: '孩子昵称 (可选)' });
  const progressSummary = h('div', {});
  function updateSummary() {
    progressSummary.textContent = `⭐ ${P.stars()} 颗星 · 🧸 ${P.stickers().length} 张贴纸 · 音频 ${ids.length} 条 (待人工 ${pending.length})`;
    nick.value = P.nickname();
  }
  updateSummary();

  ov().replaceChildren(h('div', { class: 'modal parent' },
    h('button', { class: 'close-x', onclick: () => ov().replaceChildren() }, '✖️'),
    h('h2', {}, '家长区'),
    progressSummary,
    h('div', { style: 'font-size:12px;opacity:.6;margin-top:2px' },
      version ? `版本 ${version.build} · 音频包 ${version.audio} 条 (打开 app 自动检查更新, 游戏中出现 🎁 即有新版)` : ''),
    progressTools(updateSummary),
    h('h3', {}, '⚙️ 设置'),
    h('div', {}, nick, h('button', { class: 'pbtn', onclick: () => { P.setNickname(nick.value); A.sfx('ok'); } }, '保存昵称')),
    h('div', {}, h('button', { class: 'pbtn ghost', onclick: () => {
      if (!confirm('确定清空星星和贴纸？可用“撤销上次恢复 / 重置”找回。')) return;
      try { P.resetAll(); window.dispatchEvent(new Event('progresschange')); openPanel(); }
      catch { alert('未能保存，请检查设备存储空间后重试。'); }
    } }, '🗑️ 重置进度')),
    h('h3', {}, '🎧 音频验收 (逐条听, 不满意点 👎, 结果导出发给 Claude 换真人录音)'),
    h('div', {},
      h('button', { class: 'pbtn ghost', onclick: () => { filter = 'pending'; renderList(); } }, '只看待验收'),
      h('button', { class: 'pbtn ghost', onclick: () => { filter = 'all'; renderList(); } }, '全部'),
      h('button', { class: 'pbtn', onclick: doExport }, '📤 导出验收结果 (自动复制)')),
    exportArea,
    listWrap,
    h('h3', {}, 'ℹ️ 说明'),
    h('div', { style: 'font-size:13px;opacity:.8' },
      '发音示范: Azure 神经网络语音 (Elsa, 意大利语母语级)。每条音频先经机器识别回读质检, 标"待人工"的是机器无法自动验证的孤立音素和慢速版本, 麻烦逐条听一遍。孩子跟读用"回声对比"(先示范后回放), 二期上逐音素评分。')));
  exportArea.style.display = 'none';
}
