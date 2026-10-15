"use client";

/**
 * Abonos: el cliente vuelve con el número de su orden (o el QR del
 * comprobante), se busca la orden y se ve su cuenta -- valor, abonos y
 * saldo -- para recibirle otro abono. Si la orden está esperando
 * aprobación, desde aquí mismo se deja autorizada la cotización (el
 * cliente autoriza en el mostrador en vez de hacerlo por el enlace).
 *
 * El abono lo registra POST /api/ordenes/[id]/abonos (lib/abono.ts):
 * entra al turno de caja y descuenta el saldo que se cobra al entregar.
 */
import { useEffect, useState } from "react";
import { Wallet, Search, QrCode, Check, ThumbsUp } from "lucide-react";
import { LectorCodigoBarras } from "@/componentes/lector-codigos/lector-codigo-barras";
import { PanelCobro, formatearMoneda as fmt } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { extraerTokenDeSeguimiento } from "@/lib/token-seguimiento";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface OrdenCuenta {
  id: string;
  numero: number;
  estado: string;
  motivo: string | null;
  token_publico: string;
  valor: number;
  pagado: number;
  saldoPendiente: number;
  pagos: { numero: number; tipo: string; monto: number; medio: string | null; fecha: string }[];
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
  producto: {
    marca: string | null;
    modelo: string | null;
    tipo: string;
    serial: string;
    cliente: { nombre: string; telefono: string | null } | null;
  };
}

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

export default function PaginaAbonos() {
  const [numero, setNumero] = useState("");
  const [escaneando, setEscaneando] = useState(false);
  const [orden, setOrden] = useState<OrdenCuenta | null>(null);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [monto, setMonto] = useState(0);
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [imprimir, setImprimir] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const turnoAbierto = useTurnoAbierto();
  const metodo = metodos.find((m) => m.id === metodoPagoId);

  useEffect(() => {
    fetch("/api/metodos-pago")
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setMetodos(data);
        if (data[0]) setMetodoPagoId(data[0].id);
      })
      .catch(() => {});
  }, []);

  async function buscar(query?: { numero?: string; token?: string }) {
    setError(null);
    setAviso(null);
    const parametro = query?.token
      ? `token=${encodeURIComponent(query.token)}`
      : `numero=${encodeURIComponent((query?.numero ?? numero).trim())}`;
    try {
      const res = await fetch(`/api/ordenes/buscar?${parametro}`);
      if (!res.ok) throw new Error((await res.json()).error);
      setOrden(await res.json());
      setMonto(0);
      setMontoRecibido(0);
    } catch (e) {
      setOrden(null);
      setError(e instanceof Error ? e.message : "No se pudo buscar la orden");
    }
  }

  async function recargar(id: string) {
    const res = await fetch(`/api/ordenes/buscar?numero=${orden?.numero ?? ""}`);
    if (res.ok) {
      const data = (await res.json()) as OrdenCuenta;
      if (data.id === id) setOrden(data);
    }
  }

  function procesarQr(valor: string) {
    setEscaneando(false);
    const token = extraerTokenDeSeguimiento(valor);
    if (token) {
      buscar({ token });
    } else {
      setNumero(valor.trim());
      buscar({ numero: valor.trim() });
    }
  }

  async function abonar() {
    if (!orden) return;
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/abonos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          monto,
          metodoPagoId,
          montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined,
          imprimir,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = (await res.json()) as { saldo: number };
      setAviso(`Abono de ${fmt(monto)} registrado. Saldo: ${fmt(data.saldo)}.`);
      setMonto(0);
      setMontoRecibido(0);
      await recargar(orden.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el abono");
    } finally {
      setProcesando(false);
    }
  }

  async function autorizar() {
    if (!orden) return;
    setProcesando(true);
    setError(null);
    setAviso(null);
    try {
      const res = await fetch("/api/aprobacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: orden.token_publico, decision: "aprobada" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAviso(
        data.estado === "esperando_repuesto"
          ? "Servicio autorizado: la orden queda esperando repuesto."
          : "Servicio autorizado: la orden pasó a reparación.",
      );
      await recargar(orden.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo autorizar el servicio");
    } finally {
      setProcesando(false);
    }
  }

  const estado = orden?.estado as Estado | undefined;
  const entregada = estado === "entregada";
  const cambio = montoRecibido - monto;
  const faltaAbono =
    !orden || monto <= 0
      ? "Escribe el valor del abono."
      : monto > orden.saldoPendiente
        ? "El abono no puede ser mayor al saldo."
        : metodo?.es_efectivo && cambio < 0
          ? "El efectivo recibido no alcanza el abono."
          : null;

  return (
    <div>
      <TituloPantalla
        icono={<Wallet size={24} strokeWidth={2} />}
        titulo="Abonos"
        descripcion="Busca la orden del equipo, mira su cuenta y recibe un abono del cliente."
      />

      <div className="pila">
        <Tarjeta>
          <form
            className="fila"
            style={{ gap: 8, flexWrap: "wrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              buscar();
            }}
          >
            <input
              placeholder="Número o código de orden"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              aria-label="Número o código de orden"
              className="cifra"
              style={{ flex: "1 1 160px", minWidth: 0 }}
            />
            <Boton type="submit" variante="primario" icono={<Search size={17} strokeWidth={2} />} disabled={!numero.trim()}>
              Buscar
            </Boton>
            <Boton
              type="button"
              variante="contorno"
              icono={<QrCode size={17} strokeWidth={2} />}
              onClick={() => setEscaneando(true)}
            >
              Escanear QR
            </Boton>
          </form>

          {escaneando && (
            <div style={{ marginTop: 14 }}>
              <LectorCodigoBarras
                formats={["qr_code"]}
                etiqueta="Ubica el QR del comprobante o la etiqueta"
                onDetectado={procesarQr}
                onCerrar={() => setEscaneando(false)}
              />
            </div>
          )}
        </Tarjeta>

        {orden && (
          <Tarjeta>
            <div className="fila" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <h2>
                  {orden.producto.marca} {orden.producto.modelo}
                </h2>
                <p className="cifra" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
                  {orden.producto.tipo} · {orden.producto.serial} · orden #{orden.numero}
                </p>
                {orden.producto.cliente && (
                  <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
                    {orden.producto.cliente.nombre}
                    {orden.producto.cliente.telefono ? ` · ${orden.producto.cliente.telefono}` : ""}
                  </p>
                )}
                {orden.motivo && <p style={{ margin: "8px 0 0", fontSize: 13 }}>{orden.motivo}</p>}
              </div>
              {estado && estado in ETIQUETA_ESTADO ? <EstadoOrden estado={estado} /> : <Etiqueta tono="neutro">{orden.estado}</Etiqueta>}
            </div>

            {orden.items.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
                <div className="campo-etiqueta">Servicio y repuestos</div>
                {orden.items.map((it, i) => (
                  <div key={i} className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                    <span>
                      {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                      {it.descripcion}
                    </span>
                    <span className="cifra">{fmt(it.cantidad * it.precioUnit)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
              <div className="campo-etiqueta">Cuenta del equipo</div>
              <div className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                <span>Valor de la orden</span>
                <span className="cifra">{fmt(orden.valor)}</span>
              </div>
              {orden.pagos.map((p) => (
                <div
                  key={p.numero}
                  className="fila"
                  style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "var(--ink-2)" }}
                >
                  <span>
                    {p.tipo === "anticipo" ? "Abono" : "Pago"} · {new Date(p.fecha).toLocaleDateString("es-CO")}
                    {p.medio ? ` · ${p.medio}` : ""}
                  </span>
                  <span className="cifra">−{fmt(p.monto)}</span>
                </div>
              ))}
              <div className="fila" style={{ justifyContent: "space-between", fontSize: 15, fontWeight: 800, padding: "6px 0 0" }}>
                <span>Saldo</span>
                <span className="cifra">{fmt(orden.saldoPendiente)}</span>
              </div>
            </div>

            {estado === "esperando_aprobacion" && (
              <div style={{ marginTop: 16 }}>
                <Aviso tono="aviso">
                  La cotización está esperando que el cliente la autorice.{" "}
                  <Boton
                    tamano="sm"
                    variante="primario"
                    icono={<ThumbsUp size={15} strokeWidth={2} />}
                    onClick={autorizar}
                    disabled={procesando}
                  >
                    El cliente autoriza el servicio
                  </Boton>
                </Aviso>
              </div>
            )}
          </Tarjeta>
        )}

        {orden && !entregada && orden.saldoPendiente > 0 && (
          <Tarjeta>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <Wallet size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Nuevo abono
            </h2>
            {turnoAbierto === false && (
              <div style={{ marginBottom: 12 }}>
                <AvisoTurnoCerrado />
              </div>
            )}
            <div className="fila" style={{ gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
              <Campo etiqueta="Valor del abono">
                <input
                  type="number"
                  min={0}
                  max={orden.saldoPendiente}
                  inputMode="numeric"
                  className="cifra"
                  value={monto || ""}
                  onChange={(e) => setMonto(Math.max(0, Number(e.target.value) || 0))}
                  placeholder="0"
                  style={{ maxWidth: 200 }}
                />
              </Campo>
              <Boton variante="contorno" tamano="sm" onClick={() => setMonto(orden.saldoPendiente)}>
                Todo el saldo
              </Boton>
              <div className="cifra" style={{ paddingBottom: 8 }}>
                Queda: <strong>{fmt(Math.max(0, orden.saldoPendiente - monto))}</strong>
              </div>
            </div>
            {monto > 0 && metodos.length > 0 && (
              <PanelCobro
                total={monto}
                metodos={metodos}
                metodoPagoId={metodoPagoId}
                onCambiarMetodo={setMetodoPagoId}
                montoRecibido={montoRecibido}
                onCambiarMontoRecibido={setMontoRecibido}
                imprimir={imprimir}
                onCambiarImprimir={setImprimir}
              />
            )}
            <div className="fila" style={{ marginTop: 16 }}>
              <Boton
                variante="primario"
                tamano="lg"
                icono={<Check size={18} strokeWidth={2.4} />}
                onClick={abonar}
                disabled={procesando || turnoAbierto === false || Boolean(faltaAbono)}
              >
                <span className="cifra">{procesando ? "Registrando…" : `Registrar abono ${monto > 0 ? fmt(monto) : ""}`}</span>
              </Boton>
              {faltaAbono && monto > 0 && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>{faltaAbono}</span>}
            </div>
          </Tarjeta>
        )}

        {orden && orden.valor <= 0 && !entregada && (
          <Aviso tono="aviso">
            Esta orden todavía no tiene valor. Pon el valor del servicio al recibir o envía la cotización para poder abonar.
          </Aviso>
        )}
        {orden && orden.valor > 0 && orden.saldoPendiente === 0 && <Aviso tono="ok">Esta orden ya está pagada.</Aviso>}

        {aviso && <Aviso tono="ok">{aviso}</Aviso>}
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
