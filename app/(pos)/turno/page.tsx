"use client";

/**
 * Abrir y cerrar el turno de caja. Cerrar compara lo contado contra
 * lib/caja.ts (vía /api/turno/cerrar) e imprime el comprobante con la
 * diferencia -- Fase 7 del plano de construcción.
 */
import { useEffect, useState } from "react";

interface TurnoActual {
  abierto: boolean;
  turnoId?: string;
  baseInicial?: number;
  abiertoEn?: string;
  ventasEfectivo?: number;
  totalVentas?: number;
  efectivoEsperado?: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaTurno() {
  const [turno, setTurno] = useState<TurnoActual | null>(null);
  const [baseInicial, setBaseInicial] = useState("");
  const [efectivoContado, setEfectivoContado] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/turno/actual");
    setTurno(await res.json());
  }

  useEffect(() => {
    cargar();
  }, []);

  async function abrir() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/turno/abrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseInicial: Number(baseInicial) || 0 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setBaseInicial("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir el turno");
    } finally {
      setEnviando(false);
    }
  }

  async function cerrar() {
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/turno/cerrar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ efectivoContado: Number(efectivoContado) || 0 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setMensaje(
        data.diferencia === 0
          ? "Turno cerrado. Cuadra exacto."
          : `Turno cerrado. ${data.diferencia > 0 ? "Sobran" : "Faltan"} ${fmt(Math.abs(data.diferencia))}.`,
      );
      setEfectivoContado("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cerrar el turno");
    } finally {
      setEnviando(false);
    }
  }

  if (!turno) return <p>Cargando…</p>;

  if (!turno.abierto) {
    return (
      <div>
        <h1>Abrir turno</h1>
        {mensaje && <p style={{ color: "#2e7d32" }}>{mensaje}</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="Base inicial en caja"
            value={baseInicial}
            onChange={(e) => setBaseInicial(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={abrir} disabled={enviando}>
            Abrir turno
          </button>
        </div>
        {error && <p style={{ color: "#c0392b" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1>Turno abierto</h1>
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        Desde {new Date(turno.abiertoEn!).toLocaleString("es-CO")}
      </p>

      <table style={{ marginBottom: 20 }}>
        <tbody>
          <tr>
            <td>Base inicial</td>
            <td>{fmt(turno.baseInicial!)}</td>
          </tr>
          <tr>
            <td>Ventas en efectivo</td>
            <td>{fmt(turno.ventasEfectivo!)}</td>
          </tr>
          <tr>
            <td>Ventas totales (todos los medios)</td>
            <td>{fmt(turno.totalVentas!)}</td>
          </tr>
          <tr style={{ fontWeight: 700 }}>
            <td>Efectivo esperado</td>
            <td>{fmt(turno.efectivoEsperado!)}</td>
          </tr>
        </tbody>
      </table>

      <h2 style={{ fontSize: 16 }}>Cerrar turno</h2>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          type="number"
          placeholder="Efectivo contado"
          value={efectivoContado}
          onChange={(e) => setEfectivoContado(e.target.value)}
          style={{ padding: 8, flex: 1 }}
        />
        <button onClick={cerrar} disabled={enviando}>
          Cerrar turno
        </button>
      </div>
      {error && <p style={{ color: "#c0392b" }}>{error}</p>}
    </div>
  );
}
