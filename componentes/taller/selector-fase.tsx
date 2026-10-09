"use client";

/**
 * Elegir la fase de la orden entre las activas de su estado actual
 * (0050_fase_orden.sql). Botones y no un desplegable: se toca con
 * guantes, igual que los accesos del hub. Si el estado no tiene fases
 * configuradas no se dibuja nada -- la orden funciona igual sin ellas.
 *
 * Solo ofrece fases del estado actual: para una de otro estado hay que
 * cambiar el estado primero, y eso sigue pasando por la transición.
 */
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import type { Estado } from "@/lib/estados";
import { fasesActivasDe, type FaseOrden } from "@/lib/fases";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Aviso } from "@/componentes/ui/campo";

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
    <Tarjeta>
      <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <Layers size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
        Fase
      </h2>
      <div className="fila" style={{ gap: 8 }}>
        {opciones.map((f) => (
          <Boton
            key={f.id}
            variante={f.id === faseId ? "primario" : "contorno"}
            onClick={() => elegir(f.id)}
            disabled={cambiando}
            aria-pressed={f.id === faseId}
          >
            {f.nombre}
          </Boton>
        ))}
      </div>
      {error && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
