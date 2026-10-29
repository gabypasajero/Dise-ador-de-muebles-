// Trabajador de la app sin conexión (se genera al compilar: VERSION y ARCHIVOS los pone el build).
// Guarda en la tablet todo lo necesario para abrir y usar el diseñador sin internet.
const VERSION = '__VERSION__';
const ARCHIVOS = __ARCHIVOS__;
const CACHE = `dto-${VERSION}`;
const CACHE_IMAGENES = 'dto-imagenes';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(['/', ...ARCHIVOS]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('dto-') && k !== CACHE && k !== CACHE_IMAGENES) await caches.delete(k);
      await self.clients.claim();
      // Fotos de los productos del catálogo, para verlas sin internet (en segundo plano).
      try {
        const r = await fetch('/datos/productos-respaldo.json');
        const productos = await r.json();
        const c = await caches.open(CACHE_IMAGENES);
        for (const p of productos) {
          if (!p.imagen_url) continue;
          if (await c.match(p.imagen_url)) continue;
          try {
            await c.put(p.imagen_url, await fetch(p.imagen_url, { mode: 'no-cors' }));
          } catch {
            /* sin esa foto */
          }
        }
      } catch {
        /* sin catálogo de respaldo */
      }
    })(),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // La base de datos y el asistente van siempre a internet (la app sabe qué hacer sin conexión).
  if (url.pathname.startsWith('/api/') || /supabase\.co$/.test(url.hostname)) return;
  if (req.mode === 'navigate') {
    // La página: la versión nueva si hay internet; si no responde en 3 s (sin wifi o wifi débil), la guardada.
    e.respondWith(
      (async () => {
        const guardada = caches.match('/', { ignoreSearch: true, ignoreVary: true });
        const red = fetch(req).then((r) => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE).then((c) => c.put('/', copia));
          }
          return r;
        });
        const espera = new Promise((ok) => setTimeout(ok, 3000, null));
        try {
          const r = await Promise.race([red, espera]);
          if (r) return r;
        } catch {
          /* sin red */
        }
        return (await guardada) || red;
      })(),
    );
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true, ignoreVary: true }).then(
        (g) =>
          g ||
          fetch(req).then((r) => {
            if (r.ok) {
              const copia = r.clone();
              caches.open(CACHE).then((c) => c.put(req, copia));
            }
            return r;
          }),
      ),
    );
    return;
  }
  // Imágenes de otros sitios (fotos de la tienda, fuentes): las guardadas primero.
  if (req.destination === 'image' || req.destination === 'font' || req.destination === 'style') {
    e.respondWith(
      caches.open(CACHE_IMAGENES).then((c) =>
        c.match(req, { ignoreVary: true }).then(
          (g) =>
            g ||
            fetch(req).then((r) => {
              c.put(req, r.clone());
              return r;
            }),
        ),
      ),
    );
  }
});
