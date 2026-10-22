"use client";

/**
 * «Compras» en Vender: el cliente pide algo que no hay y se le encarga.
 * Va a la misma lista de Compras que lo que piden las órdenes, pero con
 * el nombre y el teléfono de a quién hay que traérselo en vez del
 * número de orden (POST /api/repuesto-solicitud, lib/compras/encargo.ts).
 * Si el carrito ya tiene un cliente, se usa ese.
 *
 * Con valor, el cliente puede dejar abono para que se lo traigan: entra
 * a la caja e imprime su recibo. Debajo están los encargos sin entregar;
 * el que ya llegó se cobra (el saldo) y se entrega desde ahí
 * (POST /api/repuesto-solicitud/<id>/entregar).
 */
import { useCallback, useEffect, useState } from "react";
import { Check, HandCoins, ShoppingBag } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { VentanaError } from "@/componentes/ui/ventana-error";
import { AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { PanelCobro, formatearMoneda } from "./panel-cobro";
import type { ClienteVenta } from "./cliente-venta";

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

interface EncargoPendiente {
  id: string;
  descripcion: string;
  producto: string | null;
  cantidad: number;
  llego: boolean;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  valor: number;
  pagado: number;
  saldo: number;
}

export function EncargoCompras({
  cliente,
  metodos,
  turnoAbierto,
}: {
  cliente: ClienteVenta | null;
  metodos: Metodo[];
  turnoAbierto: boolean | null;
}) {
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [prioridad, setPrioridad] = useState("normal");
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [valor, setValor] = useState(0);
  const [abono, setAbono] = useState(0);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [imprimir, setImprimir] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pendientes, setPendientes] = useState<EncargoPendiente[]>([]);
  const [entregando, setEntregando] = useState<EncargoPendiente | null>(null);

  const metodo = metodos.find((m) => m.id === metodoPagoId);

  // El cliente elegido en el carrito llena los datos si están vacíos.
  useEffect(() => {
    if (!cliente) return;
    setNombre((n) => n || cliente.nombre);
    setTelefono((t) => t || cliente.telefono || "");
  }, [cliente]);

  useEffect(() => {
    if (!metodoPagoId && metodos[0]) setMetodoPagoId(metodos[0].id);
  }, [metodos, metodoPagoId]);

  const cargarPendientes = useCallback(() => {
    fetch("/api/repuesto-solicitud")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setPendientes(data);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarPendientes();
  }, [cargarPendientes]);

  // Lo que impide cobrar, dicho antes de tocar el botón.
  function faltaParaCobrar(monto: number): string | null {
    if (monto <= 0) return null;
    if (turnoAbierto === false) return "Para cobrar, abre el turno de caja.";
    if (!metodo) return "Elige la forma de pago.";
    if (metodo.es_efectivo && montoRecibido < monto) return "El efectivo recibido no alcanza.";
    return null;
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    setListo(null);
    try {
      const res = await fetch("/api/repuesto-solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          cantidad: Number(cantidad) || 1,
          prioridad,
          clienteId: cliente?.id && cliente.nombre === nombre.trim() ? cliente.id : null,
          clienteNombre: nombre,
          clienteTelefono: telefono,
          precioVenta: valor || null,
          abono:
            abono > 0
              ? { monto: abono, metodoPagoId, montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined }
              : undefined,
          imprimir,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const cuenta =
        valor > 0
          ? ` Valor ${formatearMoneda(valor)}${abono > 0 ? ` · Abono ${formatearMoneda(abono)} · Saldo ${formatearMoneda(valor - abono)}` : ""}.`
          : "";
      setListo(`${descripcion.trim()} quedó en Compras para ${nombre.trim()} (${telefono.trim()}).${cuenta}`);
      setDescripcion("");
      setCantidad("1");
      setPrioridad("normal");
      setValor(0);
      setAbono(0);
      setMontoRecibido(0);
      cargarPendientes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar a Compras");
    } finally {
      setGuardando(false);
    }
  }

  async function entregar(e: EncargoPendiente) {
    setGuardando(true);
    setError(null);
    setListo(null);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${e.id}/entregar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metodoPagoId,
          montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined,
          imprimir,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListo(
        `${e.producto ?? e.descripcion} entregado a ${e.clienteNombre ?? "el cliente"}` +
          (data.cobrado > 0 ? `, cobrado ${formatearMoneda(data.cobrado)}.` : "."),
      );
      setEntregando(null);
      setMontoRecibido(0);
      cargarPendientes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entregar el encargo");
    } finally {
      setGuardando(false);
    }
  }

  const faltaAbono = abono > valor ? "El abono no puede ser mayor al valor." : faltaParaCobrar(abono);

  return (
    <div className="pila" style={{ gap: 14 }}>
      <Tarjeta>
        <h2 style={{ fontSize: 16, marginBottom: 4 }}>Encargo para un cliente</h2>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
          Lo que el cliente pide y no hay. Va a Compras con su nombre y teléfono para saber a quién traérselo.
        </p>
        <form
          className="pila"
          style={{ gap: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            guardar();
          }}
        >
          <Campo etiqueta="Qué hay que traer">
            <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Pantalla Samsung A12" autoFocus />
          </Campo>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <Campo etiqueta="Cantidad">
              <input type="number" min={1} inputMode="numeric" className="cifra" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </Campo>
            <Campo etiqueta="Prioridad">
              <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
            </Campo>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
            <Campo etiqueta="Nombre del cliente">
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
            </Campo>
            <Campo etiqueta="Teléfono">
              <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" className="cifra" autoComplete="off" />
            </Campo>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <Campo etiqueta="Valor para el cliente">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                className="cifra"
                value={valor || ""}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0);
                  setValor(v);
                  if (!v) setAbono(0);
                }}
                placeholder="Opcional"
              />
            </Campo>
            <Campo etiqueta="Abono">
              <input
                type="number"
                min={0}
                max={valor}
                inputMode="numeric"
                className="cifra"
                value={abono || ""}
                onChange={(e) => setAbono(Math.max(0, Number(e.target.value) || 0))}
                placeholder={valor > 0 ? "Opcional" : "Pon primero el valor"}
                disabled={!(valor > 0)}
              />
            </Campo>
          </div>
          {valor > 0 && abono > 0 && (
            <div className="cifra" style={{ fontSize: 13, color: "var(--ink-2)" }}>
              Saldo al entregar: <strong>{formatearMoneda(Math.max(0, valor - abono))}</strong>
            </div>
          )}
          {abono > 0 && turnoAbierto === false && <AvisoTurnoCerrado />}
          {abono > 0 && !entregando && metodos.length > 0 && (
            <PanelCobro
              total={abono}
              metodos={metodos}
              metodoPagoId={metodoPagoId}
              onCambiarMetodo={setMetodoPagoId}
              montoRecibido={montoRecibido}
              onCambiarMontoRecibido={setMontoRecibido}
              imprimir={imprimir}
              onCambiarImprimir={setImprimir}
            />
          )}
          {abono > 0 && faltaAbono && (
            <div style={{ fontSize: 13, color: "var(--peligro, #b42318)" }}>{faltaAbono}</div>
          )}
          <div>
            <Boton
              type="submit"
              variante="primario"
              icono={<ShoppingBag size={17} strokeWidth={2} />}
              disabled={guardando || !descripcion.trim() || !nombre.trim() || !telefono.trim() || Boolean(faltaAbono)}
            >
              {guardando ? "Guardando…" : abono > 0 ? `Agregar y cobrar abono ${formatearMoneda(abono)}` : "Agregar a compras"}
            </Boton>
          </div>
          {listo && (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              {listo}
            </Aviso>
          )}
          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
        </form>
      </Tarjeta>

      {pendientes.length > 0 && (
        <Tarjeta>
          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Encargos sin entregar</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
            Cuando llega y el cliente viene por él, se cobra el saldo y queda entregado.
          </p>
          <div className="pila" style={{ gap: 10 }}>
            {pendientes.map((e) => {
              const abierto = entregando?.id === e.id;
              const falta = abierto ? faltaParaCobrar(e.saldo) : null;
              return (
                <div key={e.id} style={{ borderTop: "1px solid var(--linea, #e5e5e5)", paddingTop: 10 }}>
                  <div className="fila" style={{ justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                    <div>
                      <strong>{e.producto ?? e.descripcion}</strong>
                      {e.cantidad > 1 ? ` ×${e.cantidad}` : ""}
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 12,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: e.llego ? "var(--ok-suave, #e7f6ec)" : "var(--fondo-2, #f2f2f2)",
                        }}
                      >
                        {e.llego ? "Llegó" : "Pedido"}
                      </span>
                      <div style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        {[e.clienteNombre, e.clienteTelefono].filter(Boolean).join(" · ")}
                      </div>
                      {e.valor > 0 && (
                        <div className="cifra" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                          Valor {formatearMoneda(e.valor)} · Abonado {formatearMoneda(e.pagado)} · Saldo{" "}
                          <strong>{formatearMoneda(e.saldo)}</strong>
                        </div>
                      )}
                    </div>
                    {e.llego && !abierto && (
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        icono={<HandCoins size={16} strokeWidth={2} />}
                        onClick={() => {
                          setEntregando(e);
                          setMontoRecibido(0);
                        }}
                      >
                        {e.saldo > 0 ? "Cobrar y entregar" : "Entregar"}
                      </Boton>
                    )}
                  </div>
                  {abierto && (
                    <div className="pila" style={{ gap: 10, marginTop: 10 }}>
                      {e.saldo > 0 && turnoAbierto === false && <AvisoTurnoCerrado />}
                      {e.saldo > 0 && metodos.length > 0 && (
                        <PanelCobro
                          total={e.saldo}
                          metodos={metodos}
                          metodoPagoId={metodoPagoId}
                          onCambiarMetodo={setMetodoPagoId}
                          montoRecibido={montoRecibido}
                          onCambiarMontoRecibido={setMontoRecibido}
                          imprimir={imprimir}
                          onCambiarImprimir={setImprimir}
                        />
                      )}
                      {falta && <div style={{ fontSize: 13, color: "var(--peligro, #b42318)" }}>{falta}</div>}
                      <div className="fila" style={{ gap: 8 }}>
                        <Boton variante="primario" disabled={guardando || Boolean(falta)} onClick={() => entregar(e)}>
                          {guardando
                            ? "Guardando…"
                            : e.saldo > 0
                              ? `Cobrar ${formatearMoneda(e.saldo)} y entregar`
                              : "Marcar entregado"}
                        </Boton>
                        <Boton variante="fantasma" onClick={() => setEntregando(null)} disabled={guardando}>
                          Cancelar
                        </Boton>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
