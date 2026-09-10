"use client";

/**
 * El técnico registra los hallazgos y arma la cotización -- repuestos
 * más mano de obra -- y la envía en un solo paso. Al enviar,
 * POST /api/ordenes/[id]/cotizacion mueve la orden a
 * esperando_aprobacion y devuelve el enlace de seguimiento para
 * mandarlo por WhatsApp. Fase 5 del plano de construcción.
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Linea {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const LINEA_VACIA: Linea = { descripcion: "", cantidad: 1, precioUnit: 0 };

export default function PaginaDiagnostico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ ...LINEA_VACIA }]);
  const [manoObra, setManoObra] = useState("0");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ total: number; urlSeguimiento: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const totalItems = lineas.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);
  const total = totalItems + (Number(manoObra) || 0);

  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const items = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0);
      if (items.length === 0) throw new Error("Agrega al menos un repuesto o servicio con descripción.");

      const res = await fetch(`/api/ordenes/${id}/cotizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, manoObra: Number(manoObra) || 0, nota: nota.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      const data = await res.json();
      setResultado({ total: data.total, urlSeguimiento: data.urlSeguimiento });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la cotización");
    } finally {
      setEnviando(false);
    }
  }

  async function copiarEnlace() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.urlSeguimiento);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (resultado) {
    return (
      <div>
        <h1>Cotización enviada</h1>
        <p>Total: {fmt(resultado.total)}</p>
        <p style={{ opacity: 0.7, fontSize: 14 }}>
          Comparte este enlace con el cliente para que apruebe o rechace desde su celular:
        </p>
        <div
          style={{
            background: "#132029",
            padding: 12,
            borderRadius: 8,
            wordBreak: "break-all",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {resultado.urlSeguimiento}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={copiarEnlace}>{copiado ? "¡Copiado!" : "Copiar enlace"}</button>
          <button onClick={() => router.push(`/orden/${id}`)}>Volver a la orden</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1>Diagnóstico y cotización</h1>

      <textarea
        placeholder="Hallazgos del diagnóstico…"
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: 8, marginBottom: 16 }}
      />

      <h2 style={{ fontSize: 16 }}>Repuestos y servicios</h2>
      {lineas.map((l, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input
            placeholder="Descripción"
            value={l.descripcion}
            onChange={(e) => actualizarLinea(i, { descripcion: e.target.value })}
            style={{ padding: 8, flex: 2 }}
          />
          <input
            type="number"
            min={1}
            value={l.cantidad}
            onChange={(e) => actualizarLinea(i, { cantidad: Number(e.target.value) || 1 })}
            style={{ padding: 8, width: 60 }}
          />
          <input
            type="number"
            min={0}
            placeholder="Precio"
            value={l.precioUnit || ""}
            onChange={(e) => actualizarLinea(i, { precioUnit: Number(e.target.value) || 0 })}
            style={{ padding: 8, width: 100 }}
          />
          <button onClick={() => quitarLinea(i)} disabled={lineas.length === 1}>
            ✕
          </button>
        </div>
      ))}
      <button onClick={agregarLinea} style={{ marginBottom: 16 }}>
        + Agregar línea
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <label>Mano de obra:</label>
        <input
          type="number"
          min={0}
          value={manoObra}
          onChange={(e) => setManoObra(e.target.value)}
          style={{ padding: 8, width: 120 }}
        />
      </div>

      <p style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Total: {fmt(total)}</p>

      <button onClick={enviar} disabled={enviando} style={{ padding: "10px 20px" }}>
        {enviando ? "Enviando…" : "Enviar cotización"}
      </button>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
