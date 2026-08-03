// 启动 + 路由 + 更新管理
import * as A from './audio.js';
import * as V from './views.js';

let state = { screen: 'splash' };
let started = false;   // 点过 GIOCA 后为 true (决定更新是静默应用还是出提示)

function navigate(next) {
  state = next;
  render();
}

function render() {
  const s = state;
  if (s.screen === 'splash') return V.renderSplash(onStart);
  if (s.screen === 'home') return V.renderHome();
  if (s.screen === 'unit') return V.renderUnit(s.unitId);
  if (s.screen === 'vocale') return V.renderVocale(s.unitId, s.idx);
  if (s.screen === 'conosci') return V.renderConosci(s.unitId);
  if (s.screen === 'sillabe') return V.renderSillabe(s.unitId, s.idx);
  if (s.screen === 'casa') return V.renderCasa(s.unitId, s.idx);
  if (s.screen === 'parole') return V.renderParole(s.unitId, s.idx);
  return V.renderHome();
}

async function onStart() {
  started = true;
  A.unlock();
  navigate({ screen: 'home' });
  A.play('ui-welcome');
}

// ---------- PWA 更新: 封面页静默换新 / 游戏中出 🎁 提示 ----------
let reloading = false;
function applyUpdate(reg) {
  if (!reg.waiting) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
  reg.waiting.postMessage({ type: 'SKIP_WAITING' });
}

function showUpdateBanner(reg) {
  if (document.querySelector('.update-banner')) return;
  const b = document.createElement('button');
  b.className = 'update-banner';
  b.textContent = '🎁 Novità! Tocca qui!';
  b.addEventListener('click', () => { b.remove(); applyUpdate(reg); });
  document.body.append(b);
}

function onUpdateReady(reg) {
  if (!started) applyUpdate(reg);   // 还在封面页: 无感知直接换新
  else showUpdateBanner(reg);       // 玩到一半: 出小礼盒, 点了才换
}

async function setupUpdates() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.register('sw.js');
    if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) onUpdateReady(reg);
      });
    });
    reg.update().catch(() => {});
    // iPad 上 app 常驻后台: 每次切回来再查一次
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  } catch {}
}

async function boot() {
  const cur = await (await fetch('data/curriculum.json')).json();
  V.init(cur, navigate);
  render();
  setupUpdates();
}

boot();
