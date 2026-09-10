"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Seguimiento {
  numero: number;
  estado: string;
  etiquetaEstado: string;
  motivo: string;
  abiertaEn: string;
  producto: { serial: string; tipo: string; marca: string | null; modelo: string | null };
  historial: { estado: string; etiqueta: string; fecha: string }[];
  cotizacion: {
    total: number;
    estado: string;
    decision: string | null;
    cotizacion_item: { descripcion: string; cantidad: number; precio_unit: number }[];
  } | null;
  evidencias: { tipo: "foto" | "video"; tomadaEn: string; url: string | null }[];
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaSeguimiento() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    fetch(`/api/seguimiento/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo cargar");
        return r.json();
      })
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, [token]);

  async function decidir(decision: "aprobada" | "rechazada") {
    setEnviando(true);
    try {
      const res = await fetch("/api/aprobacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // Recargar para reflejar el nuevo estado.
      const actualizado = await fetch(`/api/seguimiento/${token}`).then((r) => r.json());
      setDatos(actualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la decisión");
    } finally {
      setEnviando(false);
    }
  }

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <p>{error}</p>
      </main>
    );
  }

  if (!datos) {
    return (
      <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
        <p>Cargando…</p>
      </main>
    );
  }

  const puedeDecidir =
    datos.cotizacion && datos.cotizacion.estado === "enviada" && !datos.cotizacion.decision;

  return (
    <main style={{ padding: 24, maxWidth: 480, margin: "0 auto" }}>
      <h1>Orden #{datos.numero}</h1>
      <p>
        {datos.producto.marca} {datos.producto.modelo} · {datos.producto.serial}
      </p>

      <section style={{ margin: "20px 0", padding: 16, border: "1px solid #ddd", borderRadius: 8 }}>
        <strong>Estado actual: {datos.etiquetaEstado}</strong>
      </section>

      <h2>Historial</h2>
      <ul>
        {datos.historial.map((h, i) => (
          <li key={i}>
            {h.etiqueta} — {new Date(h.fecha).toLocaleString("es-CO")}
          </li>
        ))}
      </ul>

      {datos.cotizacion && (
        <section style={{ margin: "20px 0" }}>
          <h2>Cotización</h2>
          <ul>
            {datos.cotizacion.cotizacion_item.map((it, i) => (
              <li key={i}>
                {it.cantidad} x {it.descripcion} — {fmt(it.cantidad * it.precio_unit)}
              </li>
            ))}
          </ul>
          <p>
            <strong>Total: {fmt(datos.cotizacion.total)}</strong>
          </p>

          {puedeDecidir && (
            <div style={{ display: "flex", gap: 12 }}>
              <button disabled={enviando} onClick={() => decidir("aprobada")}>
                Aprobar
              </button>
              <button disabled={enviando} onClick={() => decidir("rechazada")}>
                Rechazar
              </button>
            </div>
          )}
          {datos.cotizacion.decision && <p>Decisión registrada: {datos.cotizacion.decision}</p>}
        </section>
      )}

      {datos.evidencias.length > 0 && (
        <section>
          <h2>Fotos</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {datos.evidencias.map((ev, i) =>
              ev.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={ev.url} alt="Evidencia del equipo" style={{ width: "100%", borderRadius: 8 }} />
              ) : null,
            )}
          </div>
        </section>
      )}
    </main>
  );
}
