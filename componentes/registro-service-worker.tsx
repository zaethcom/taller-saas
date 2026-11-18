"use client";

/**
 * Registra public/sw.js -- el service worker que cachea solo el shell
 * estático (JS/CSS con hash) para que la app cargue casi instantánea en
 * visitas repetidas. Si falla (navegador viejo, contexto sin HTTPS en
 * desarrollo, etc.) la app sigue funcionando igual, solo sin este
 * acelerador -- por eso no hace nada con el error.
 *
 * También escucha, desde el primer momento, el aviso del navegador de
 * que la app se puede instalar (lib/sin-conexion/instalar.ts): ese
 * evento llega una sola vez y temprano, antes de que nadie abra el menú.
 */
import { useEffect } from "react";
import { guardarEventoInstalar, marcarInstalada, type EventoInstalar } from "@/lib/sin-conexion/instalar";

export function RegistroServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    const alPoderInstalar = (e: Event) => {
      // Sin preventDefault Chrome muestra su propia barrita; así el
      // ofrecimiento queda en el menú del usuario, donde se espera.
      e.preventDefault();
      guardarEventoInstalar(e as EventoInstalar);
    };
    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", marcarInstalada);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", marcarInstalada);
    };
  }, []);

  return null;
}
