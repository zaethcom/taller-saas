"use client";

/**
 * Ajuste manual de una fila de existencia puntual (un repuesto en una
 * sede). Vive dentro de cada tarjeta del catálogo -- no hay una pantalla
 * aparte -- porque el ajuste siempre es sobre algo que ya se está
 * mirando: "esto no cuadra, corrijo aquí mismo". El motivo es
 * obligatorio (punto 2 del documento de requerimientos); sirve tanto
 * para un conteo físico como para revertir una recepción mal cargada
 * (punto 3, "retroceso") -- no hay un botón de deshacer separado, es el
 * mismo ajuste con el motivo correcto.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Campo, Aviso } from "@/componentes/ui/campo";

export function AjusteExistencia({
  repuestoId,
  sedeId,
  cantidadActual,
}: {
  repuestoId: string;
  sedeId: string | null;
  cantidadActual: number;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cantidadNueva, setCantidadNueva] = useState(String(cantidadActual));
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!sedeId) return null;

  async function ajustar(e: React.FormEvent) {
    e.preventDefault();
    const nueva = Number(cantidadNueva);
    if (Number.isNaN(nueva) || nueva < 0) {
      setError("La cantidad debe ser un número mayor o igual a cero");
      return;
    }
    if (nueva === cantidadActual) {
      setError("Esa ya es la cantidad actual");
      return;
    }
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/inventario/ajuste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repuestoId, sedeId, cantidadNueva: nueva, motivo: motivo.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setAbierto(false);
      setMotivo("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo ajustar la existencia");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Ajustar cantidad"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          border: "1px solid var(--rule)",
          background: "var(--surface-2)",
          borderRadius: 999,
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--ink-2)",
        }}
      >
        <Pencil size={13} strokeWidth={2} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--surface)",
        borderRadius: "var(--r-md)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Ajustar cantidad</span>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      <form onSubmit={ajustar} className="pila" style={{ gap: 8, flex: 1 }}>
        <Campo etiqueta={`Actual: ${cantidadActual}`}>
          <input
            type="number"
            value={cantidadNueva}
            onChange={(e) => setCantidadNueva(e.target.value)}
            className="cifra"
            autoFocus
          />
        </Campo>
        <Campo etiqueta="Motivo">
          <input
            placeholder="Conteo físico, merma, corrección…"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Campo>
        {error && (
          <Aviso tono="peligro">
            <span style={{ fontSize: 12 }}>{error}</span>
          </Aviso>
        )}
        <Boton type="submit" variante="primario" tamano="sm" disabled={enviando}>
          {enviando ? "Guardando…" : "Confirmar ajuste"}
        </Boton>
      </form>
    </div>
  );
}
