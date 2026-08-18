// 离线缓存 + 版本化更新
// VERSION 由 deploy.sh 在发布时替换成构建时间戳 (本地开发保持占位符不变)
const VERSION = '2026-08-18_185358';
const CACHE = 'sillabe-' + VERSION;
const CORE = [
  '.', 'index.html', 'css/style.css',
  'js/main.js', 'js/audio.js', 'js/views.js', 'js/progress.js', 'js/parent.js',
  'data/curriculum.json', 'data/manifest.json',
  'assets/phonics-fvl-atlas.png',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  // 只预缓存核心文件, 快速进入 installed/waiting 状态 (更新提示不被音频下载拖慢)
  // cache:'reload' 绕过 HTTP 缓存 — 防止把 CDN/浏览器里的旧版文件装进新版本缓存
  e.waitUntil(caches.open(CACHE).then(c =>
    c.addAll(CORE.map(u => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
  // 音频全量预取: 后台尽力而为, 不阻塞激活; 缺的由运行时缓存兜底
  (async () => {
    try {
      const c = await caches.open(CACHE);
      const list = await (await fetch('data/audio-list.json')).json();
      for (const path of list) {
        try { if (!(await c.match(path))) await c.add(path); } catch {}
      }
    } catch {}
  })();
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

