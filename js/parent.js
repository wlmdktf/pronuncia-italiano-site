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

  ov().replaceChildren(h('div', { class: 'modal parent' },
    h('button', { class: 'close-x', onclick: () => ov().replaceChildren() }, '✖️'),
    h('h2', {}, '家长区'),
    h('div', {}, `⭐ ${P.stars()} 颗星 · 🧸 ${P.stickers().length} 张贴纸 · 音频 ${ids.length} 条 (待人工 ${pending.length})`),
    h('div', { style: 'font-size:12px;opacity:.6;margin-top:2px' },
      version ? `版本 ${version.build} · 音频包 ${version.audio} 条 (打开 app 自动检查更新, 游戏中出现 🎁 即有新版)` : ''),
    h('h3', {}, '🎧 音频验收 (逐条听, 不满意点 👎, 结果导出发给 Claude 换真人录音)'),
    h('div', {},
      h('button', { class: 'pbtn ghost', onclick: () => { filter = 'pending'; renderList(); } }, '只看待验收'),
      h('button', { class: 'pbtn ghost', onclick: () => { filter = 'all'; renderList(); } }, '全部'),
      h('button', { class: 'pbtn', onclick: doExport }, '📤 导出验收结果 (自动复制)')),
    exportArea,
    listWrap,
    h('h3', {}, '⚙️ 设置'),
    h('div', {}, nick, h('button', { class: 'pbtn', onclick: () => { P.setNickname(nick.value); A.sfx('ok'); } }, '保存昵称')),
    h('div', {}, h('button', { class: 'pbtn ghost', onclick: () => { if (confirm('确定清空星星和贴纸?')) { P.resetAll(); A.sfx('no'); } } }, '🗑️ 重置进度')),
    h('h3', {}, 'ℹ️ 说明'),
    h('div', { style: 'font-size:13px;opacity:.8' },
      '发音示范: Azure 神经网络语音 (Elsa, 意大利语母语级)。每条音频先经机器识别回读质检, 标"待人工"的是机器无法自动验证的孤立音素和慢速版本, 麻烦逐条听一遍。孩子跟读用"回声对比"(先示范后回放), 二期上逐音素评分。')));
  exportArea.style.display = 'none';
}
