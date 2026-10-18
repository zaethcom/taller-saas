/**
 * Service Worker mínimo, escrito a mano (sin Workbox/next-pwa): solo
 * cachea el shell estático de Next.js -- JS/CSS bajo /_next/static/,
 * que ya lleva el hash del contenido en el nombre del archivo, así que
 * cachearlo agresivo (cache-first) es siempre seguro, nunca sirve una
 * versión vieja por error. Todo lo demás (HTML, /api/*, el manifest)
 * NO se intercepta -- va siempre a la red, sin excepción: esto es un
 * POS con inventario y precios reales, y una respuesta vieja de la API
 * cacheada por error podría mostrar stock o un precio que ya cambió.
 */
const CACHE = "taller-shell-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const esShellEstatico = url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg";

  if (event.request.method !== "GET" || !esShellEstatico) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cacheada = await cache.match(event.request);
      if (cacheada) return cacheada;

      const respuesta = await fetch(event.request);
      if (respuesta.ok) cache.put(event.request, respuesta.clone());
      return respuesta;
    }),
  );
});

/*
 * Avisos del cliente (0061_avisos_cliente.sql): el servidor manda por
 * push { titulo, cuerpo, url, tag } (lib/avisos.ts, notificacionDeAviso)
 * cuando el cliente escribe o decide una cotización desde el enlace.
 */
self.addEventListener("push", (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { cuerpo: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(datos.titulo || "Aviso de un cliente", {
      body: datos.cuerpo || "",
      tag: datos.tag,
      renotify: Boolean(datos.tag),
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: datos.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((ventanas) => {
      // Si la app ya está abierta, se usa esa pestaña en vez de abrir otra.
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin && "focus" in v) {
          return v.focus().then(() => v.navigate(url));
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
