"use client";

/**
 * Registra public/sw.js -- el service worker que cachea solo el shell
 * estático (JS/CSS con hash) para que la app cargue casi instantánea en
 * visitas repetidas. Si falla (navegador viejo, contexto sin HTTPS en
 * desarrollo, etc.) la app sigue funcionando igual, solo sin este
 * acelerador -- por eso no hace nada con el error.
 */
import { useEffect } from "react";

export function RegistroServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
