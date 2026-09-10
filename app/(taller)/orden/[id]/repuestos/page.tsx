"use client";

/**
 * Consumir un repuesto contra el inventario de la sede, o marcarlo
 * como faltante si no hay -- lo que crea la fila en repuesto_solicitud
 * que aparece en /compras. Fase 6 del plano de construcción.
 */
import { useState } from "react";
import { useParams } from "next/navigation";

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  existenciaAqui: number;
}

export default function PaginaRepuestos() {
  const { id } = useParams<{ id: string }>();

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<Repuesto[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [faltanteDescripcion, setFaltanteDescripcion] = useState("");
  const [faltanteCantidad, setFaltanteCantidad] = useState("1");
  const [prioridad, setPrioridad] = useState("normal");

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function buscarRepuestos() {
    setBuscando(true);
    const res = await fetch(`/api/repuestos?buscar=${encodeURIComponent(buscar)}`);
    setResultados(await res.json());
    setBuscando(false);
  }

  async function consumir(repuestoId: string) {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "consumir", repuestoId, cantidad: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Repuesto consumido y descontado del inventario.");
      buscarRepuestos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consumir el repuesto");
    } finally {
      setProcesando(false);
    }
  }

  async function marcarFaltante() {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "faltante",
          descripcion: faltanteDescripcion.trim(),
          cantidad: Number(faltanteCantidad) || 1,
          prioridad,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Faltante registrado. Ya aparece en la lista de compras.");
      setFaltanteDescripcion("");
      setFaltanteCantidad("1");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar el faltante");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <h1>Repuestos</h1>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>Consumir del inventario</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Buscar por código o descripción"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarRepuestos} disabled={buscando}>
            Buscar
          </button>
        </div>

        {resultados.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid #223038",
            }}
          >
            <div>
              <strong>{r.descripcion}</strong>
              <div style={{ fontSize: 12, opacity: 0.6 }}>
                {r.codigo} · {r.existenciaAqui} en esta sede
              </div>
            </div>
            <button onClick={() => consumir(r.id)} disabled={procesando || r.existenciaAqui <= 0}>
              Consumir 1
            </button>
          </div>
        ))}
        {resultados.length === 0 && buscar && !buscando && (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Sin resultados. Márcalo como faltante abajo.</p>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Marcar faltante</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Descripción del repuesto que hace falta"
            value={faltanteDescripcion}
            onChange={(e) => setFaltanteDescripcion(e.target.value)}
            style={{ padding: 8 }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type="number"
              min={1}
              value={faltanteCantidad}
              onChange={(e) => setFaltanteCantidad(e.target.value)}
              style={{ padding: 8, width: 80 }}
            />
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} style={{ padding: 8 }}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
            <button onClick={marcarFaltante} disabled={procesando || !faltanteDescripcion.trim()}>
              Marcar faltante
            </button>
          </div>
        </div>
      </section>

      {mensaje && <p style={{ color: "#4ade80", marginTop: 16 }}>{mensaje}</p>}
      {error && <p style={{ color: "#ff8080", marginTop: 16 }}>{error}</p>}
    </div>
  );
}
