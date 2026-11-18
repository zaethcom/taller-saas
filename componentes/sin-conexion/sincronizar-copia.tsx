"use client";

/**
 * Mantiene al día la copia de datos de la sede en el equipo (plan sin
 * internet, fase 2): la baja al abrir cualquier pantalla de mostrador o
 * taller y luego cada INTERVALO_MS mientras la pestaña está a la vista.
 * Si falla (sin internet), se queda con la copia anterior y reintenta en
 * el siguiente turno. No muestra nada.
 *
 * Con cada copia nueva renueva también los números de orden apartados
 * para recibir sin conexión (fase 4).
 *
 * Antes de bajar la copia sube lo que se hizo sin conexión (fase 3,
 * lib/sin-conexion/cola.ts), cada REINTENTO_COLA_MS mientras quede algo.
 * Mientras quede algo pendiente no se baja copia nueva: la del servidor
 * no tendría esas ventas descontadas y volvería a ofrecer lo vendido.
 *
 * La clave empresa:sede:usuario viene del layout: si cambia (otra sede,
 * otro usuario) la copia anterior no sirve y se baja de una vez.
 */
import { useEffect } from "react";
import { guardarCopia, leerCopia } from "@/lib/sin-conexion/copia-local";
import { enviarCola, listarCola, numerosEnCola } from "@/lib/sin-conexion/cola";
import { actualizarBloque, idEquipo } from "@/lib/sin-conexion/bloque-numeros";
import type { CopiaLocal } from "@/lib/sin-conexion/tipos";

const INTERVALO_MS = 5 * 60 * 1000;
const REINTENTO_COLA_MS = 30 * 1000;

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

async function bajarCopia(): Promise<void> {
  const [base, categorias, metodosPago, turno, configuracion] = await Promise.all([
    json<CopiaLocal>("/api/app/copia-local"),
    json<CopiaLocal["categorias"]>("/api/categorias"),
    json<CopiaLocal["metodosPago"]>("/api/metodos-pago"),
    json<CopiaLocal["turno"]>("/api/turno/actual"),
    json<Record<string, unknown>>("/api/configuracion"),
  ]);
  if (!base) return;
  await guardarCopia({
    ...base,
    categorias: Array.isArray(categorias) ? categorias : [],
    metodosPago: Array.isArray(metodosPago) ? metodosPago : [],
    turno: turno ?? null,
    configuracion: configuracion ?? null,
  });
}

/**
 * Pide los números de orden libres de este equipo para recibir sin
 * conexión (fase 4, lib/sin-conexion/bloque-numeros.ts). Lo que ya se
 * usó en recepciones que siguen en la cola no se vuelve a ofrecer.
 */
async function renovarNumeros(empresaId: string): Promise<void> {
  const equipo = await idEquipo();
  if (!equipo) return;
  try {
    const r = await fetch("/api/app/bloque-numeros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ equipo }),
    });
    if (!r.ok) return;
    const datos = (await r.json()) as { libres?: unknown };
    if (!Array.isArray(datos.libres)) return;
    await actualizarBloque(empresaId, datos.libres as number[], numerosEnCola(await listarCola()));
  } catch {
    // Sin red: se queda con los números que ya tenía.
  }
}

export function SincronizarCopia({ empresaId, sedeId, usuarioId }: { empresaId: string; sedeId: string | null; usuarioId: string }) {
  useEffect(() => {
    if (!sedeId) return;
    let cancelado = false;
    let reloj: ReturnType<typeof setTimeout> | undefined;

    async function turno() {
      clearTimeout(reloj);
      let quedanPendientes = false;
      if (document.visibilityState === "visible") {
        const subidos = await enviarCola(usuarioId);
        quedanPendientes = (await listarCola()).some((e) => e.estado === "pendiente" && e.usuarioId === usuarioId);
        const actual = await leerCopia();
        const vieja =
          !actual ||
          actual.empresaId !== empresaId ||
          actual.sedeId !== sedeId ||
          actual.usuarioId !== usuarioId ||
          subidos > 0 ||
          Date.now() - Date.parse(actual.generadaEn) >= INTERVALO_MS;
        if (vieja && !quedanPendientes && !cancelado) {
          await bajarCopia();
          await renovarNumeros(empresaId);
        }
      }
      if (!cancelado) reloj = setTimeout(turno, quedanPendientes ? REINTENTO_COLA_MS : INTERVALO_MS);
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
