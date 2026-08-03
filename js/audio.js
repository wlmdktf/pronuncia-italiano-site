// 播放 / 音效 / 录音 (回声对比) — iOS Safari 优先
let ctx = null;
const cache = new Map();
let current = null;
let currentResolve = null;   // 播放被打断时也要让等待方放行 (否则快速连点会卡死游戏逻辑)

export function unlock() {
  // 必须在用户手势内调用一次: 解锁 WebAudio + HTMLAudio
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

export function stopAll() {
  if (current) { current.pause(); current.currentTime = 0; current = null; }
  if (currentResolve) { const r = currentResolve; currentResolve = null; r(); }
}

export function play(id) {
  return new Promise((resolve) => {
    stopAll();
    let a = cache.get(id);
    if (!a) { a = new Audio(`audio/${id}.mp3`); cache.set(id, a); }
    current = a;
    currentResolve = resolve;
    a.currentTime = 0;
    const done = () => {
      a.removeEventListener('ended', done); a.removeEventListener('error', done);
      if (currentResolve === resolve) currentResolve = null;
      resolve();
    };
    a.addEventListener('ended', done);
    a.addEventListener('error', done);
    a.play().catch(done);
  });
}

export async function playSeq(ids, gapMs = 350) {
  for (const id of ids) {
    await play(id);
    if (gapMs) await sleep(gapMs);
  }
}

export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ---------- 合成音效 (零文件) ----------
function tone(freq, t0, dur, type = 'sine', gain = 0.25) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(gain, ctx.currentTime + t0);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t0 + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
}
export function sfx(kind) {
  if (!ctx) return;
  if (kind === 'ok') { tone(523, 0, .18); tone(659, .12, .18); tone(784, .24, .3); }
  else if (kind === 'no') { tone(330, 0, .2, 'triangle', .15); tone(262, .18, .3, 'triangle', .15); }
  else if (kind === 'beep') { tone(880, 0, .22, 'sine', .3); }
  else if (kind === 'star') { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * .09, .22)); }
  else if (kind === 'tap') { tone(700, 0, .08, 'sine', .12); }
}

// ---------- 录音 (回声对比) ----------
let stream = null;
export function micSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}
export async function micReady() {
  if (!micSupported()) return false;
  if (stream && stream.active) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch { return false; }
}
export function recordFor(ms) {
  // 返回 blob URL (录音失败返回 null)
  return new Promise((resolve) => {
    if (!stream || !stream.active) return resolve(null);
    let rec;
    try { rec = new MediaRecorder(stream); } catch { return resolve(null); }
    const chunks = [];
    rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      if (!chunks.length) return resolve(null);
      resolve(URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/mp4' })));
    };
    rec.onerror = () => resolve(null);
    rec.start();
    setTimeout(() => { try { rec.stop(); } catch { resolve(null); } }, ms);
  });
}
export function playUrl(url) {
  return new Promise((resolve) => {
    stopAll();
    const a = new Audio(url);
    current = a;
    currentResolve = resolve;
    const done = () => { if (currentResolve === resolve) currentResolve = null; resolve(); };
    a.onended = done; a.onerror = done;
    a.play().catch(done);
  });
}
