"use client";

/**
 * Abrir y cerrar el turno de caja. Cerrar compara lo contado contra
 * lib/caja.ts (vía /api/turno/cerrar) e imprime el comprobante con la
 * diferencia -- Fase 7 del plano de construcción.
 *
 * El efectivo esperado se muestra en grande y aparte del resto de las
 * cifras: es el único número contra el que se cuenta la caja.
 *
 * Gestión de dinero: con el turno abierto se puede meter o sacar
 * efectivo con un motivo obligatorio (/api/turno/movimiento); cada
 * movimiento abre el cajón y entra al efectivo esperado.
 */
import { useEffect, useState } from "react";
import { Clock, LockOpen, Lock, Check, Wallet, Plus, Minus } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface TurnoActual {
  abierto: boolean;
  turnoId?: string;
  baseInicial?: number;
  abiertoEn?: string;
  ventasEfectivo?: number;
  totalVentas?: number;
  ingresos?: number;
  salidas?: number;
  movimientos?: Movimiento[];
  efectivoEsperado?: number;
}

interface Movimiento {
  id: string;
  tipo: "ingreso" | "salida";
  monto: number;
  motivo: string;
  autor: string | null;
  creadoEn: string;
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
  const [tipoMovimiento, setTipoMovimiento] = useState<"ingreso" | "salida" | null>(null);
  const [montoMovimiento, setMontoMovimiento] = useState("");
  const [motivoMovimiento, setMotivoMovimiento] = useState("");
  const [errorMovimiento, setErrorMovimiento] = useState<string | null>(null);
  const [avisoMovimiento, setAvisoMovimiento] = useState<string | null>(null);

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

  function elegirMovimiento(tipo: "ingreso" | "salida") {
    setTipoMovimiento(tipo);
    setErrorMovimiento(null);
    setAvisoMovimiento(null);
  }

  async function registrarMovimiento() {
    const monto = Number(montoMovimiento);
    if (!monto || monto <= 0) {
      setErrorMovimiento("Escribe el monto.");
      return;
    }
    if (!motivoMovimiento.trim()) {
      setErrorMovimiento(
        tipoMovimiento === "ingreso" ? "Escribe por qué entra el dinero." : "Escribe para qué sale el dinero.",
      );
      return;
    }
    setEnviando(true);
    setErrorMovimiento(null);
    try {
      const res = await fetch("/api/turno/movimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: tipoMovimiento, monto, motivo: motivoMovimiento }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setAvisoMovimiento(
        `${tipoMovimiento === "ingreso" ? "Ingreso" : "Salida"} de ${fmt(monto)} registrado. Se abrió el cajón.`,
      );
      setTipoMovimiento(null);
      setMontoMovimiento("");
      setMotivoMovimiento("");
      await cargar();
    } catch (e) {
      setErrorMovimiento(e instanceof Error ? e.message : "No se pudo registrar el movimiento");
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
          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
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
            {!!turno.ingresos && <Renglon etiqueta="Ingresos de caja" valor={turno.ingresos} />}
            {!!turno.salidas && <Renglon etiqueta="Salidas de caja" valor={-turno.salidas} />}
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
          <h2 style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Wallet size={20} strokeWidth={2} /> Gestión de dinero
          </h2>
          <p style={{ color: "var(--ink-3)", fontSize: 14, marginBottom: 12 }}>
            Meter o sacar efectivo de la caja sin una venta. Queda registrado con su motivo y abre el cajón.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Boton
              variante={tipoMovimiento === "ingreso" ? "oscuro" : "contorno"}
              icono={<Plus size={18} strokeWidth={2.2} />}
              onClick={() => elegirMovimiento("ingreso")}
              disabled={enviando}
            >
              Ingresar dinero
            </Boton>
            <Boton
              variante={tipoMovimiento === "salida" ? "oscuro" : "contorno"}
              icono={<Minus size={18} strokeWidth={2.2} />}
              onClick={() => elegirMovimiento("salida")}
              disabled={enviando}
            >
              Sacar dinero
            </Boton>
          </div>

          {tipoMovimiento && (
            <div className="pila" style={{ marginTop: 16 }}>
              <Campo etiqueta={tipoMovimiento === "ingreso" ? "Monto que entra" : "Monto que sale"}>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="0"
                  value={montoMovimiento}
                  onChange={(e) => setMontoMovimiento(e.target.value)}
                  className="cifra"
                  autoFocus
                />
              </Campo>
              <Campo
                etiqueta="Motivo"
                ayuda={
                  tipoMovimiento === "ingreso"
                    ? "Por qué entra: cambio para la caja, aporte del dueño…"
                    : "Para qué sale: pago a proveedor, domicilio, retiro…"
                }
              >
                <input
                  type="text"
                  value={motivoMovimiento}
                  onChange={(e) => setMotivoMovimiento(e.target.value)}
                  maxLength={200}
                />
              </Campo>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Boton
                  variante="secundario"
                  icono={<LockOpen size={18} strokeWidth={2} />}
                  onClick={registrarMovimiento}
                  disabled={enviando}
                >
                  {enviando ? "Registrando…" : "Registrar y abrir cajón"}
                </Boton>
                <Boton variante="fantasma" onClick={() => setTipoMovimiento(null)} disabled={enviando}>
                  Cancelar
                </Boton>
              </div>
            </div>
          )}

          {errorMovimiento && (
            <div style={{ marginTop: 12 }}>
              <Aviso tono="peligro">{errorMovimiento}</Aviso>
            </div>
          )}
          {avisoMovimiento && (
            <div style={{ marginTop: 12 }}>
              <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
                {avisoMovimiento}
              </Aviso>
            </div>
          )}

          {!!turno.movimientos?.length && (
            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              {turno.movimientos.map((m) => (
                <div
                  key={m.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    fontSize: 14,
                    paddingTop: 8,
                    borderTop: "1px solid var(--rule)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{m.motivo}</div>
                    <div style={{ color: "var(--ink-3)", fontSize: 12 }}>
                      {new Date(m.creadoEn).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })}
                      {m.autor ? ` · ${m.autor}` : ""}
                    </div>
                  </div>
                  <span
                    className="cifra"
                    style={{ fontWeight: 700, whiteSpace: "nowrap", color: m.tipo === "salida" ? "var(--peligro)" : undefined }}
                  >
                    {m.tipo === "salida" ? "−" : "+"}
                    {fmt(m.monto)}
                  </span>
                </div>
              ))}
            </div>
          )}
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

        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
