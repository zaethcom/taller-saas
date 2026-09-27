"use client";

/**
 * Abrir y cerrar el turno de caja. Cerrar compara lo contado contra
 * lib/caja.ts (vía /api/turno/cerrar) e imprime el comprobante con la
 * diferencia -- Fase 7 del plano de construcción.
 *
 * El efectivo esperado se muestra en grande y aparte del resto de las
 * cifras: es el único número contra el que se cuenta la caja.
 */
import { useEffect, useState } from "react";
import { Clock, LockOpen, Lock, Check } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

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

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 14 }}>
      <span style={{ color: "var(--ink-2)" }}>{etiqueta}</span>
      <span className="cifra" style={{ fontWeight: 700 }}>
        {fmt(valor)}
      </span>
    </div>
  );
}

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

  if (!turno) {
    return (
      <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>
    );
  }

  if (!turno.abierto) {
    return (
      <div>
        <TituloPantalla
          icono={<Clock size={24} strokeWidth={2} />}
          titulo="Abrir turno"
          descripcion="Cuenta la base con la que arranca la caja de esta sede."
        />
        <div className="pila">
          {mensaje && (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              {mensaje}
            </Aviso>
          )}
          <Tarjeta>
            <Campo etiqueta="Base inicial en caja" ayuda="El efectivo que ya está en el cajón antes de la primera venta.">
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={baseInicial}
                onChange={(e) => setBaseInicial(e.target.value)}
                className="cifra"
              />
            </Campo>
            <div style={{ marginTop: 16 }}>
              <Boton
                variante="primario"
                tamano="lg"
                icono={<LockOpen size={19} strokeWidth={2} />}
                onClick={abrir}
                disabled={enviando}
              >
                {enviando ? "Abriendo…" : "Abrir turno"}
              </Boton>
            </div>
          </Tarjeta>
          {error && <Aviso tono="peligro">{error}</Aviso>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <TituloPantalla
        icono={<Clock size={24} strokeWidth={2} />}
        titulo="Turno abierto"
        descripcion={`Desde ${new Date(turno.abiertoEn!).toLocaleString("es-CO")}`}
        acciones={<Etiqueta tono="ok" punto>Caja abierta</Etiqueta>}
      />

      <div className="pila">
        <Tarjeta>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Renglon etiqueta="Base inicial" valor={turno.baseInicial!} />
            <Renglon etiqueta="Ventas en efectivo" valor={turno.ventasEfectivo!} />
            <Renglon etiqueta="Ventas totales (todos los medios)" valor={turno.totalVentas!} />
            <div style={{ height: 1, background: "var(--rule)", margin: "4px 0" }} />
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 800 }}>Efectivo esperado</span>
              <span className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {fmt(turno.efectivoEsperado!)}
              </span>
            </div>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Cerrar turno</h2>
          <Campo etiqueta="Efectivo contado" ayuda="Lo que hay de verdad en el cajón, contado a mano.">
            <input
              type="number"
              inputMode="numeric"
              placeholder="0"
              value={efectivoContado}
              onChange={(e) => setEfectivoContado(e.target.value)}
              className="cifra"
            />
          </Campo>
          <div style={{ marginTop: 16 }}>
            <Boton
              variante="primario"
              tamano="lg"
              icono={<Lock size={19} strokeWidth={2} />}
              onClick={cerrar}
              disabled={enviando}
            >
              {enviando ? "Cerrando…" : "Cerrar turno e imprimir"}
            </Boton>
          </div>
        </Tarjeta>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
