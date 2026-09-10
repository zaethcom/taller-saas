"use client";

/**
 * La pantalla de la orden desde la app del técnico: la fase actual y
 * nada más. Muestra el historial completo del equipo -- esta pantalla,
 * llegada por el QR, es donde se cumple la primera de las dos promesas
 * del proyecto.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ETIQUETA_ESTADO, siguientesEstados, type Estado } from "@/lib/estados";

interface OrdenTecnico {
  id: string;
  numero: number;
  estado: Estado;
  motivo: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  cliente_nombre: string;
}

export default function PaginaOrdenTecnico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenTecnico | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ordenes/${id}`)
      .then((r) => r.json())
      .then(setOrden)
      .catch(() => setError("No se pudo cargar la orden"));
  }, [id]);

  async function avanzar(aEstado: Estado) {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
      setOrden((prev) => (prev ? { ...prev, estado: aEstado } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setCambiando(false);
    }
  }

  if (!orden) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Orden #{orden.numero}</h1>
      <p>
        {orden.marca} {orden.modelo} ({orden.tipo}) · {orden.serial}
      </p>
      <p>Cliente: {orden.cliente_nombre}</p>
      <p>Motivo: {orden.motivo}</p>

      <div
        style={{
          margin: "16px 0",
          padding: 16,
          background: "#132029",
          borderRadius: 8,
        }}
      >
        <strong>Estado: {ETIQUETA_ESTADO[orden.estado]}</strong>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <a href={`/orden/${id}/evidencia`}>📷 Evidencia</a>
        <a href={`/orden/${id}/diagnostico`}>🔧 Diagnóstico y cotización</a>
        <a href={`/orden/${id}/repuestos`}>🧰 Repuestos</a>
      </nav>

      {siguientesEstados(orden.estado).length > 0 && (
        <div style={{ marginTop: 20 }}>
          <p style={{ opacity: 0.7, fontSize: 14 }}>Avanzar a:</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {siguientesEstados(orden.estado).map((e) => (
              <button key={e} disabled={cambiando} onClick={() => avanzar(e)}>
                {ETIQUETA_ESTADO[e]}
              </button>
            ))}
          </div>
        </div>
      )}
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
