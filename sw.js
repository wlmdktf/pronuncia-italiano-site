// 离线缓存: 核心文件安装时缓存, 音频首次播放后缓存 + 后台全量预取 (尽力而为)
const VERSION = 'v3';
const CACHE = 'sillabe-' + VERSION;
const CORE = [
  '.', 'index.html', 'css/style.css',
  'js/main.js', 'js/audio.js', 'js/views.js', 'js/progress.js', 'js/parent.js',
  'data/curriculum.json', 'data/manifest.json',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE);
    self.skipWaiting();
    // 后台预取全部音频 (失败不影响安装)
    try {
      const list = await (await fetch('data/audio-list.json')).json();
      for (const path of list) {
        try { if (!(await c.match(path))) await c.add(path); } catch {}
      }
    } catch {}
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    const hit = await c.match(e.request);
    if (hit) return hit;
    try {
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  })());
});
