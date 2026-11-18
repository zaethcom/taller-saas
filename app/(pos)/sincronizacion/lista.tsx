"use client";

/**
 * La lista de lo guardado sin conexión (lib/sin-conexion/cola.ts):
 * - Pendiente: se sube solo; se puede forzar con «Subir ahora».
 * - Para revisar (error): el servidor la rechazó (turno cerrado,
 *   artículo ya vendido en otra caja…). «Reintentar» después de
 *   arreglar la causa, o «Descartar» si no debe quedar.
 * - Subida con aviso: ya está registrada, pero algo no cuadró (p. ej.
 *   no había existencia para descontar). «Entendido» la quita.
 */
import { useEffect, useState } from "react";
import { CloudUpload, RotateCcw, Trash2, Check } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { enviarCola, listarCola, quitarDeCola, reintentarElemento, suscribirCola, type ElementoCola } from "@/lib/sin-conexion/cola";
import { leerCopia } from "@/lib/sin-conexion/copia-local";

const hora = (iso: string) =>
  new Date(iso).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

export function ListaSincronizacion() {
  const [elementos, setElementos] = useState<ElementoCola[] | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  useEffect(() => {
    let vivo = true;
    const cargar = () => void listarCola().then((l) => vivo && setElementos(l));
    cargar();
    const quitar = suscribirCola(cargar);
    return () => {
      vivo = false;
      quitar();
    };
  }, []);

  async function subirAhora() {
    setSubiendo(true);
    try {
      const copia = await leerCopia();
      if (copia) await enviarCola(copia.usuarioId);
    } finally {
      setSubiendo(false);
    }
  }

  async function descartar(e: ElementoCola) {
    if (!window.confirm(`¿Descartar «${e.descripcion}»? No quedará registrada en el sistema.`)) return;
    await quitarDeCola(e.id);
  }

  if (elementos === null) return null;
  if (elementos.length === 0) {
    return (
      <Tarjeta>
        <p style={{ margin: 0, color: "var(--ink-2)" }}>No hay nada pendiente. Todo lo de este equipo ya está en el sistema.</p>
      </Tarjeta>
    );
  }

  const hayPendientes = elementos.some((e) => e.estado === "pendiente");

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {hayPendientes && (
        <div>
          <Boton variante="primario" icono={<CloudUpload size={16} strokeWidth={2} />} onClick={subirAhora} disabled={subiendo}>
            {subiendo ? "Subiendo…" : "Subir ahora"}
          </Boton>
        </div>
      )}
      {elementos.map((e) => (
        <Tarjeta key={e.id}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 700 }}>{e.descripcion}</div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>
                Hecha {hora(e.creadoEn)}
                {e.numero ? ` · registrada como #${e.numero}` : ""}
              </div>
              {e.estado === "error" && e.mensaje && (
                <div style={{ fontSize: 13, color: "var(--peligro)", marginTop: 6 }}>{e.mensaje}</div>
              )}
              {e.estado === "aviso" &&
                e.avisos?.map((a) => (
                  <div key={a} style={{ fontSize: 13, color: "var(--aviso)", marginTop: 6 }}>
                    {a}
                  </div>
                ))}
            </div>
            <Etiqueta tono={e.estado === "pendiente" ? "info" : e.estado === "error" ? "peligro" : "aviso"}>
              {e.estado === "pendiente" ? "Pendiente" : e.estado === "error" ? "Para revisar" : "Subida con aviso"}
            </Etiqueta>
          </div>
          {e.estado !== "pendiente" && (
            <div className="fila" style={{ gap: 8, marginTop: 12 }}>
              {e.estado === "error" ? (
                <>
                  <Boton tamano="sm" icono={<RotateCcw size={15} strokeWidth={2} />} onClick={() => void reintentarElemento(e.id).then(subirAhora)}>
                    Reintentar
                  </Boton>
                  <Boton tamano="sm" variante="peligro" icono={<Trash2 size={15} strokeWidth={2} />} onClick={() => void descartar(e)}>
                    Descartar
                  </Boton>
                </>
              ) : (
                <Boton tamano="sm" icono={<Check size={15} strokeWidth={2} />} onClick={() => void quitarDeCola(e.id)}>
                  Entendido
                </Boton>
              )}
            </div>
          )}
        </Tarjeta>
      ))}
    </div>
  );
}
