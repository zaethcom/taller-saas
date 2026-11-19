"use client";

/**
 * Con internet, le pide al service worker (public/sw.js, "precargar")
 * que baje de antemano las pantallas operativas y su código. Sin esto,
 * una pantalla a la que solo se llegó por el menú lateral nunca quedaba
 * guardada (el menú no hace una navegación del navegador) y sin
 * internet salía "Sin conexión".
 *
 * Una vez por carga de la app y como mucho cada 15 minutos: cada
 * pantalla bajada la arma el servidor.
 */
import { useEffect } from "react";

const CLAVE = "taller360:precarga";
const CADA_MS = 15 * 60 * 1000;

function tocaPrecargar(paginas: string[]): boolean {
  try {
    const previa = JSON.parse(localStorage.getItem(CLAVE) ?? "null") as { en: number; paginas: string } | null;
    if (previa && previa.paginas === paginas.join(",") && Date.now() - previa.en < CADA_MS) return false;
    localStorage.setItem(CLAVE, JSON.stringify({ en: Date.now(), paginas: paginas.join(",") }));
  } catch {
    // Sin localStorage se precarga igual.
  }
  return true;
}

export function PrecargarPantallas({ paginas, lectorCodigos = true }: { paginas: string[]; lectorCodigos?: boolean }) {
  const clave = paginas.join(",");

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    const lista = clave.split(",");
    let cancelado = false;

    const id = window.setTimeout(async () => {
      if (cancelado || !tocaPrecargar(lista)) return;
      try {
        const registro = await navigator.serviceWorker.ready;
        registro.active?.postMessage({ tipo: "precargar", paginas: lista });
      } catch {
        // Sin service worker: la app sigue igual, solo sin pantallas guardadas.
      }
      // El lector de códigos con cámara se carga aparte (import dinámico):
      // pedirlo una vez lo deja guardado para usarlo sin internet.
      if (lectorCodigos) {
        import("@zxing/browser").catch(() => {});
        import("@zxing/library").catch(() => {});
      }
    }, 4000);

    return () => {
      cancelado = true;
      window.clearTimeout(id);
    };
  }, [clave, lectorCodigos]);

  return null;
}
