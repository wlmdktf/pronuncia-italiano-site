// 启动 + 路由
import * as A from './audio.js';
import * as V from './views.js';

let state = { screen: 'splash' };

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
  A.unlock();
  navigate({ screen: 'home' });
  A.play('ui-welcome');
}

async function boot() {
  const cur = await (await fetch('data/curriculum.json')).json();
  V.init(cur, navigate);
  render();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
