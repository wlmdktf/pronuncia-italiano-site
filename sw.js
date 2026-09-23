// ç¦»çº¿ç¼“å­˜ + ç‰ˆæœ¬åŒ–æ›´æ–°
// VERSION ç”± deploy.sh åœ¨å‘å¸ƒæ—¶æ›¿æ¢æˆæž„å»ºæ—¶é—´æˆ³ (æœ¬åœ°å¼€å‘ä¿æŒå ä½ç¬¦ä¸å˜)
const VERSION = '2026-09-23_064856';
const CACHE = 'sillabe-' + VERSION;
const CORE = [
  '.', 'index.html', 'css/style.css',
  'js/main.js', 'js/audio.js', 'js/views.js', 'js/progress.js', 'js/parent.js', 'js/flags.js', 'js/collega.js',
  'data/curriculum.json', 'data/manifest.json',
  'manifest.webmanifest', 'icons/icon-180.png', 'icons/icon-512.png',
];
// è¯¾ç¨‹ç”¨åˆ°çš„å›¾ç‰‡ (deploy ç”Ÿæˆ picture-list.json) ä¸Žå…¨éƒ¨éŸ³é¢‘: æ¿€æ´»åŽåœ¨åŽå°é¢„å–, å…ˆå›¾åŽéŸ³
const PREFETCH_LISTS = ['data/picture-list.json', 'data/audio-list.json'];

self.addEventListener('install', (e) => {
  // åªé¢„ç¼“å­˜æ ¸å¿ƒæ–‡ä»¶, å¿«é€Ÿè¿›å…¥ installed/waiting çŠ¶æ€ (æ›´æ–°æç¤ºä¸è¢«éŸ³é¢‘ä¸‹è½½æ‹–æ…¢)
  // cache:'reload' ç»•è¿‡ HTTP ç¼“å­˜ â€” é˜²æ­¢æŠŠ CDN/æµè§ˆå™¨é‡Œçš„æ—§ç‰ˆæ–‡ä»¶è£…è¿›æ–°ç‰ˆæœ¬ç¼“å­˜
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
  // å›¾ç‰‡ + éŸ³é¢‘å…¨é‡é¢„å–: åŽå°å°½åŠ›è€Œä¸º, ä¸é˜»å¡žæ¿€æ´»; ç¼ºçš„ç”±è¿è¡Œæ—¶ç¼“å­˜å…œåº•
  (async () => {
    try {
      const c = await caches.open(CACHE);
      for (const listUrl of PREFETCH_LISTS) {
        let list = [];
        try { list = await (await fetch(listUrl)).json(); } catch {}
        for (const path of list) {
          try { if (!(await c.match(path))) await c.add(path); } catch {}
        }
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
