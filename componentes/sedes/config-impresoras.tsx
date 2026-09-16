"use client";

/**
 * Configurar a qué impresora de tickets y de etiquetas manda sus
 * trabajos la estación de una sede -- antes solo se podía cambiar
 * editando config.json a mano en el dispositivo. "Red por IP" es una
 * impresora de verdad en la red (protocolo "crudo" en
 * estacion/destino.ts); "Local por USB" es una impresora conectada por
 * USB al mismo aparato, servida por el puente Android que ya existe
 * (protocolo "puente_android") -- no son dos conceptos nuevos, son los
 * dos que ya modela el código de la estación, solo que ahora se eligen
 * aquí en vez de en un archivo.
 */
import { useEffect, useState } from "react";
import { Printer, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";

type Protocolo = "crudo" | "puente_android";

interface Destino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

interface Impresoras {
  tickets: Destino;
  etiquetas: Destino;
}

const DESTINO_VACIO: Destino = { host: "", puerto: 9100, protocolo: "crudo" };

function CampoDestino({
  titulo,
  valor,
  onCambiar,
}: {
  titulo: string;
  valor: Destino;
  onCambiar: (d: Destino) => void;
}) {
  return (
    <div className="pila" style={{ gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>
      <Campo etiqueta="Tipo de conexión">
        <select
          value={valor.protocolo}
          onChange={(e) => onCambiar({ ...valor, protocolo: e.target.value as Protocolo })}
        >
          <option value="crudo">Red por IP</option>
          <option value="puente_android">Local por USB (puente Android)</option>
        </select>
      </Campo>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
        <Campo etiqueta="Host / IP">
          <input
            placeholder="192.168.1.50"
            value={valor.host}
            onChange={(e) => onCambiar({ ...valor, host: e.target.value })}
            className="cifra"
          />
        </Campo>
        <Campo etiqueta="Puerto">
          <input
            type="number"
            value={valor.puerto}
            onChange={(e) => onCambiar({ ...valor, puerto: Number(e.target.value) || 9100 })}
            className="cifra"
          />
        </Campo>
      </div>
    </div>
  );
}

export function ConfigImpresoras({ sedeId }: { sedeId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [tickets, setTickets] = useState<Destino>(DESTINO_VACIO);
  const [etiquetas, setEtiquetas] = useState<Destino>(DESTINO_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    fetch(`/api/sedes/${sedeId}/impresoras`)
      .then((r) => r.json())
      .then((data: Impresoras | null) => {
        if (data) {
          setTickets(data.tickets);
          setEtiquetas(data.etiquetas);
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [abierto, sedeId]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/impresoras`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickets, etiquetas }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Guardado. La estación de esta sede la usará en su próximo arranque.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<Printer size={14} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginTop: 10 }}
      >
        Configurar impresoras
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Printer size={16} strokeWidth={2} />
          Impresoras de esta sede
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={() => setAbierto(false)}
        />
      </div>

      {cargando ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          <CampoDestino titulo="Tickets (recibos, comprobantes)" valor={tickets} onCambiar={setTickets} />
          <CampoDestino titulo="Etiquetas (QR, artículos, repuestos)" valor={etiquetas} onCambiar={setEtiquetas} />
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Check size={15} strokeWidth={2.2} />}
          onClick={guardar}
          disabled={guardando || cargando || !tickets.host.trim() || !etiquetas.host.trim()}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
      </div>

      {mensaje && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="ok">{mensaje}</Aviso>
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
