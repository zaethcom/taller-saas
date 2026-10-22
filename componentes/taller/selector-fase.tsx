"use client";

/**
 * Elegir la fase de la orden entre las activas de su estado actual
 * (0050_fase_orden.sql), como pastillas dentro del encabezado de la
 * orden. Botones y no un desplegable: se toca con
 * guantes, igual que los accesos del hub. Si el estado no tiene fases
 * configuradas no se dibuja nada -- la orden funciona igual sin ellas.
 *
 * Solo ofrece fases del estado actual: para una de otro estado hay que
 * cambiar el estado primero, y eso sigue pasando por la transición.
 */
import { useEffect, useState } from "react";
import type { Estado } from "@/lib/estados";
import { fasesActivasDe, type FaseOrden } from "@/lib/fases";
import { VentanaError } from "@/componentes/ui/ventana-error";

export function SelectorFase({
  ordenId,
  estado,
  faseId,
  onCambio,
}: {
  ordenId: string;
  estado: Estado;
  faseId: string | null;
  onCambio: (fase: { id: string; nombre: string } | null) => void;
}) {
  const [fases, setFases] = useState<FaseOrden[]>([]);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fases")
      .then((r) => r.json())
      .then((data) => setFases(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const opciones = fasesActivasDe(fases, estado);

  async function elegir(id: string) {
    if (id === faseId) return;
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/fase`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faseId: id }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo cambiar la fase");
      onCambio(datos.faseId ? { id: datos.faseId, nombre: datos.faseNombre } : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar la fase");
    } finally {
      setCambiando(false);
    }
  }

  if (opciones.length === 0) return null;

  return (
    <div className="fila" style={{ gap: 6, marginTop: 12, alignItems: "center" }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)", marginRight: 4 }}>Fase</span>
      {opciones.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`pastilla${f.id === faseId ? " pastilla-activa" : ""}`}
          onClick={() => elegir(f.id)}
          disabled={cambiando}
          aria-pressed={f.id === faseId}
        >
          {f.nombre}
        </button>
      ))}
      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </div>
  );
}
