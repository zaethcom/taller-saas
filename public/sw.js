/**
 * Service Worker escrito a mano (sin Workbox/next-pwa).
 *
 * 1. Shell estático: JS/CSS bajo /_next/static/ lleva el hash del
 *    contenido en el nombre, así que va cache-first sin riesgo.
 * 2. Pantallas sin internet (plan sin internet, fase 1): las pantallas
 *    de mostrador y taller (PAGINAS_SIN_CONEXION, igual a
 *    lib/sin-conexion/paginas.ts) van SIEMPRE primero a la red, como
 *    antes; la copia guardada solo se usa cuando no hay red. Así nunca
 *    se muestra un precio viejo teniendo internet.
 * 3. Cualquier otra pantalla sin red ni copia: /sin-conexion.html.
 *
 * /api/* nunca se intercepta: un dato de la API cacheado por error
 * podría mostrar stock o un precio que ya cambió. La copia de datos
 * para trabajar sin internet llega en la fase 2, en IndexedDB.
 *
 * Al cerrar sesión la app borra CACHE_PAGINAS (componentes/ui/
 * menu-usuario.tsx): ahí hay nombres y teléfonos de clientes.
 */
const CACHE = "taller-shell-v1";
const CACHE_PAGINAS = "taller-paginas-v1"; // igual a lib/sin-conexion/borrar-copia.ts
const PAGINA_SIN_CONEXION = "/sin-conexion.html";
const PAGINAS_SIN_CONEXION = ["/vender", "/recibir", "/entregar", "/abonos", "/turno", "/recibos", "/orden", "/escanear", "/sincronizacion"];
const CACHES_VIGENTES = [CACHE, CACHE_PAGINAS];

function debeGuardarPagina(ruta) {
  return PAGINAS_SIN_CONEXION.some((p) => ruta === p || ruta.startsWith(p + "/"));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(PAGINA_SIN_CONEXION, { cache: "reload" })))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => !CACHES_VIGENTES.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function navegar(request, url) {
  const guardable = debeGuardarPagina(url.pathname);
  try {
    const respuesta = await fetch(request);
    // Solo se guarda una pantalla de verdad: no una redirección al login
    // (sesión vencida) ni un error.
    if (guardable && respuesta.ok && !respuesta.redirected && respuesta.type === "basic") {
      const cache = await caches.open(CACHE_PAGINAS);
      // La clave es la ruta sin la búsqueda: /vender?x=1 y /vender son
      // la misma pantalla para abrir sin internet.
      await cache.put(url.origin + url.pathname, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    if (guardable) {
      const cache = await caches.open(CACHE_PAGINAS);
      const guardada = await cache.match(url.origin + url.pathname);
      if (guardada) return guardada;
    }
    const sinConexion = await caches.match(PAGINA_SIN_CONEXION);
    if (sinConexion) return sinConexion;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (event.request.mode === "navigate" && !url.pathname.startsWith("/api/")) {
    event.respondWith(navegar(event.request, url));
    return;
  }

  const esShellEstatico = url.pathname.startsWith("/_next/static/") || url.pathname === "/icon.svg";
  if (!esShellEstatico) return;

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
