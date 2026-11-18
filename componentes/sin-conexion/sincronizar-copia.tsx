"use client";

/**
 * Mantiene al día la copia de datos de la sede en el equipo (plan sin
 * internet, fase 2): la baja al abrir cualquier pantalla de mostrador o
 * taller y luego cada INTERVALO_MS mientras la pestaña está a la vista.
 * Si falla (sin internet), se queda con la copia anterior y reintenta en
 * el siguiente turno. No muestra nada.
 *
 * La clave empresa:sede:usuario viene del layout: si cambia (otra sede,
 * otro usuario) la copia anterior no sirve y se baja de una vez.
 */
import { useEffect } from "react";
import { guardarCopia, leerCopia } from "@/lib/sin-conexion/copia-local";
import type { CopiaLocal } from "@/lib/sin-conexion/tipos";

const INTERVALO_MS = 5 * 60 * 1000;

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function bajarCopia(): Promise<void> {
  const [base, categorias, metodosPago, turno] = await Promise.all([
    json<CopiaLocal>("/api/app/copia-local"),
    json<CopiaLocal["categorias"]>("/api/categorias"),
    json<CopiaLocal["metodosPago"]>("/api/metodos-pago"),
    json<CopiaLocal["turno"]>("/api/turno/actual"),
  ]);
  if (!base) return;
  await guardarCopia({
    ...base,
    categorias: Array.isArray(categorias) ? categorias : [],
    metodosPago: Array.isArray(metodosPago) ? metodosPago : [],
    turno: turno ?? null,
  });
}

export function SincronizarCopia({ empresaId, sedeId, usuarioId }: { empresaId: string; sedeId: string | null; usuarioId: string }) {
  useEffect(() => {
    if (!sedeId) return;
    let cancelado = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    async function turno() {
      clearTimeout(reloj);
      if (document.visibilityState === "visible") {
        const actual = await leerCopia();
        const vieja =
          !actual ||
          actual.empresaId !== empresaId ||
          actual.sedeId !== sedeId ||
          actual.usuarioId !== usuarioId ||
          Date.now() - Date.parse(actual.generadaEn) >= INTERVALO_MS;
        if (vieja && !cancelado) await bajarCopia();
      }
      if (!cancelado) reloj = setTimeout(turno, INTERVALO_MS);
    }

    const alVolver = () => document.visibilityState === "visible" && void turno();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    void turno();
    return () => {
      cancelado = true;
      clearTimeout(reloj);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("online", alVolver);
    };
  }, [empresaId, sedeId, usuarioId]);

  return null;
}
