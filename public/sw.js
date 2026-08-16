/*
 * PASSAGE Service Worker
 * 13章: JOURNEY 中の電波不良でも旅程画面が開けることを目標にする。
 * 旅のデータ自体は localStorage にあるので、ここではアプリシェルと地図タイルを面倒みる。
 */

const VERSION = 'passage-v1'
const SHELL_CACHE = `${VERSION}-shell`
const TILE_CACHE = `${VERSION}-tiles`
const SCOPE_PATH = new URL(self.registration.scope).pathname

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([SCOPE_PATH, `${SCOPE_PATH}index.html`]))
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // 画面遷移: ネットワーク優先、落ちたらキャッシュした index.html を返す（SPA なので全経路が復元できる）
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone()
          caches.open(SHELL_CACHE).then((c) => c.put(`${SCOPE_PATH}index.html`, copy))
          return res
        })
        .catch(async () => {
          const cached = await caches.match(`${SCOPE_PATH}index.html`)
          return cached ?? Response.error()
        }),
    )
    return
  }

  // 地図タイル: 一度見た範囲はオフラインでも出す
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          return hit ?? Response.error()
        }
      }),
    )
    return
  }

  // 同一オリジンの静的アセット: キャッシュ優先
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        try {
          const res = await fetch(request)
          if (res.ok) cache.put(request, res.clone())
          return res
        } catch {
          return Response.error()
        }
      }),
    )
  }
})
