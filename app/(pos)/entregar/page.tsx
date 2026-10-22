"use client";

/**
 * Cobrar y entregar: buscar la orden (número o QR), ver su cuenta y
 * elegir qué se hace con el cliente en el mostrador -- recibirle un
 * abono o entregarle el equipo. Antes eran dos pantallas (Abonos y
 * Entregar) que buscaban la orden y mostraban la misma cuenta.
 *
 * Entregar: cobra el saldo, captura firma y foto de salida y cierra la
 * orden -- Fase 8 del plano de construcción. La transición a
 * "entregada" la valida el servidor (/api/ordenes/[id]/transicion)
 * contra saldo_en_cero, tiene_firma y tiene_foto_salida reales; esta
 * pantalla no duplica esa lógica, solo intenta la transición y muestra
 * el error si algo falta.
 *
 * Abonar: POST /api/ordenes/[id]/abonos (lib/abono.ts) entra al turno de
 * caja y descuenta el saldo que se cobra al entregar. Si la orden está
 * esperando aprobación, desde aquí se deja autorizada la cotización.
 *
 * /abonos redirige aquí con ?modo=abonar.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Eraser, Lock, Printer, QrCode, ThumbsUp } from "lucide-react";
import { FirmaCanvas, type FirmaCanvasHandle } from "@/componentes/evidencia/firma-canvas";
import { VisorEscaner } from "@/componentes/lector-codigos/visor-escaner";
import { PanelCobro } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { subirEvidencia } from "@/lib/subir-evidencia";
import { extraerTokenDeSeguimiento } from "@/lib/token-seguimiento";
import { ETIQUETA_ESTADO, puedeTransicionar, type Estado } from "@/lib/estados";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface ItemOrden {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  repuestoId: string | null;
}

interface OrdenEncontrada {
  id: string;
  numero: number;
  estado: string;
  motivo: string | null;
  token_publico: string;
  saldoPendiente: number;
  /** Valor de la orden y lo ya pagado en abonos o cobros (lib/cuenta-orden.ts). */
  valor: number;
  pagado: number;
  pagos: { numero: number; tipo: string; monto: number; medio: string | null; fecha: string }[];
  items: ItemOrden[];
  producto: {
    marca: string | null;
    modelo: string | null;
    tipo: string;
    serial: string;
    cliente?: { nombre: string; telefono: string | null } | null;
  };
}

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

type Modo = "abonar" | "entregar";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Lo que se ofrece primero al abrir una orden: entregar si ya está lista. */
function modoInicial(estado: string): Modo {
  return estado === "listo_entrega" || estado === "rechazada" ? "entregar" : "abonar";
}

export default function PaginaCobrarEntregar() {
  const router = useRouter();
  const firmaRef = useRef<FirmaCanvasHandle>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  // Lo que ya quedó hecho en un intento anterior de esta misma entrega,
  // para que reintentar no cobre, imprima ni suba evidencia dos veces.
  const cobradaRef = useRef(false);
  const evidenciaSubidaRef = useRef(false);
  // ?modo=abonar (lo que llega desde /abonos) manda sobre el modo inicial.
  const modoPedido = useRef<Modo | null>(null);

  const [numero, setNumero] = useState("");
  const [orden, setOrden] = useState<OrdenEncontrada | null>(null);
  const [modo, setModo] = useState<Modo>("entregar");
  const [escaneando, setEscaneando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  // La cámara se apaga al leer un código: si la búsqueda falla, se
  // vuelve a montar el visor para leer otro.
  const [intentoCamara, setIntentoCamara] = useState(0);
  const [foto, setFoto] = useState<File | null>(null);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [monto, setMonto] = useState(0);
  const [imprimir, setImprimir] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [perfil, setPerfil] = useState<{ empresaId: string } | null>(null);
  const turnoAbierto = useTurnoAbierto();
  const metodo = metodos.find((m) => m.id === metodoPagoId);
  const cambio = montoRecibido - (orden?.saldoPendiente ?? 0);

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
    setOrden(null);
    cobradaRef.current = false;
    evidenciaSubidaRef.current = false;
    const parametro = query?.token
      ? `token=${encodeURIComponent(query.token)}`
      : `numero=${encodeURIComponent((query?.numero ?? numero).trim())}`;
    setBuscando(true);
    try {
      const [resOrden, resPerfil] = await Promise.all([
        fetch(`/api/ordenes/buscar?${parametro}`),
        fetch("/api/perfil"),
      ]);
      if (!resOrden.ok) throw new Error((await resOrden.json()).error);
      const encontrada = (await resOrden.json()) as OrdenEncontrada;
      setOrden(encontrada);
      setModo(modoPedido.current ?? modoInicial(encontrada.estado));
      modoPedido.current = null;
      setMonto(0);
      setMontoRecibido(0);
      setEscaneando(false);
      if (resPerfil.ok) {
        const p = await resPerfil.json();
        setPerfil({ empresaId: p.empresaId });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo buscar la orden");
      setIntentoCamara((n) => n + 1);
    } finally {
      setBuscando(false);
    }
  }

  async function recargar() {
    if (!orden) return;
    const res = await fetch(`/api/ordenes/buscar?numero=${orden.numero}`);
    if (res.ok) {
      const data = (await res.json()) as OrdenEncontrada;
      if (data.id === orden.id) setOrden(data);
    }
  }

  // Desde la ficha de la orden ("Entregar") llega con ?numero=N; si no,
  // la cámara abre de una para escanear el QR de la etiqueta.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("modo") === "abonar") modoPedido.current = "abonar";
    const n = params.get("numero");
    if (n) {
      setNumero(n);
      buscar({ numero: n });
    } else {
      setEscaneando(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function procesarQr(valor: string) {
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
      await recargar();
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
      await recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo autorizar el servicio");
    } finally {
      setProcesando(false);
    }
  }

  async function entregar() {
    if (!orden || !perfil) return;
    if (firmaRef.current?.estaVacio()) {
      setError("Falta la firma de quien recibe.");
      return;
    }
    if (!foto) {
      setError("Falta la foto de salida.");
      return;
    }

    // Antes de cobrar nada: si la orden no se puede entregar desde su
    // estado, cobrar primero deja una venta hecha y la orden abierta.
    const estado = orden.estado as Estado;
    if (!(estado in ETIQUETA_ESTADO) || !puedeTransicionar(estado, "entregada")) {
      setError(`Esta orden está "${ETIQUETA_ESTADO[estado] ?? orden.estado}" y no se puede entregar.`);
      return;
    }

    setProcesando(true);
    setError(null);
    const cobraAhora = orden.saldoPendiente > 0;
    try {
      // 1. Cobrar el saldo pendiente, si lo hay -- un venta_item por
      // cada orden_item real (Fase 7 del Plan 1), no un único cargo
      // "Saldo orden #N": el cliente ve y el cajero cobra exactamente
      // lo que se usó. /api/ventas no vuelve a descontar inventario
      // para estos items porque manda ordenId -- ya se descontó al
      // consumirlos durante la reparación.
      if (cobraAhora) {
        // Se cobra ítem por ítem solo si los ítems suman justo el saldo.
        // Con abonos antes (o una cotización mayor que lo registrado), se
        // cobra una sola línea por el saldo: /api/ventas no deja cobrar
        // más de lo que falta.
        const totalItems = orden.items.reduce((s, it) => s + it.cantidad * it.precioUnit, 0);
        const itemsCobro =
          totalItems === orden.saldoPendiente
            ? orden.items.map((it) => ({
                descripcion: it.descripcion,
                cantidad: it.cantidad,
                precioUnit: it.precioUnit,
                repuestoId: it.repuestoId ?? undefined,
              }))
            : [{ descripcion: `Saldo orden #${orden.numero}`, cantidad: 1, precioUnit: orden.saldoPendiente }];
        const resVenta = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ordenId: orden.id,
            metodoPagoId,
            montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined,
            imprimir,
            items: itemsCobro,
          }),
        });
        if (!resVenta.ok) throw new Error((await resVenta.json()).error);
        // Ya quedó cobrada: si algo de abajo falla y se reintenta, no se
        // vuelve a cobrar.
        cobradaRef.current = true;
        setOrden((prev) => (prev ? { ...prev, saldoPendiente: 0 } : prev));
      }

      // 2. Subir firma y foto de salida.
      if (!evidenciaSubidaRef.current) {
        const blobFirma = await firmaRef.current!.obtenerBlob();
        if (!blobFirma) throw new Error("No se pudo capturar la firma");

        await subirEvidencia({
          empresaId: perfil.empresaId,
          ordenId: orden.id,
          archivo: blobFirma,
          extension: "png",
          tipo: "firma",
        });
        await subirEvidencia({
          empresaId: perfil.empresaId,
          ordenId: orden.id,
          archivo: foto,
          extension: foto.name.split(".").pop() ?? "jpg",
          tipo: "foto",
          fase: "salida",
          visibleCliente: true,
        });
        evidenciaSubidaRef.current = true;
      }

      // 3. Cerrar la orden. El servidor exige saldo_en_cero + firma + foto.
      const resTransicion = await fetch(`/api/ordenes/${orden.id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Si no se cobró nada ahora (ya estaba pagada), el servidor
        // reimprime el recibo de lo pagado para entregárselo al cliente.
        body: JSON.stringify({ aEstado: "entregada", imprimirComprobante: !cobradaRef.current }),
      });
      if (!resTransicion.ok) throw new Error((await resTransicion.json()).error);

      setListo(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar la entrega");
    } finally {
      setProcesando(false);
    }
  }

  if (listo) {
    return (
      <Tarjeta style={{ textAlign: "center", padding: 36 }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 58,
            height: 58,
            borderRadius: "var(--r-lg)",
            background: "var(--ok-fondo)",
            color: "var(--ok)",
            marginBottom: 14,
          }}
        >
          <Check size={30} strokeWidth={2.4} />
        </span>
        <h1>
          Orden <span className="cifra">#{orden!.numero}</span> entregada
        </h1>
        <p style={{ margin: "8px 0 20px", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Printer size={17} strokeWidth={2} aria-hidden />
          El comprobante se está imprimiendo en la estación de esta sede.
        </p>
        <Boton variante="primario" onClick={() => router.push("/vender")}>
          Volver a caja
        </Boton>
      </Tarjeta>
    );
  }

  const estado = orden?.estado as Estado | undefined;
  const entregada = estado === "entregada";
  const cambioAbono = montoRecibido - monto;
  const faltaAbono =
    !orden || monto <= 0
      ? "Escribe el valor del abono."
      : monto > orden.saldoPendiente
        ? "El abono no puede ser mayor al saldo."
        : metodo?.es_efectivo && cambioAbono < 0
          ? "El efectivo recibido no alcanza el abono."
          : null;
  const sePuedeAbonar = Boolean(orden && !entregada && orden.saldoPendiente > 0);

  return (
    <div>
      <TituloPantalla titulo="Cobrar y entregar" />

      <div className="pila">
        <form
          className="fila"
          style={{ gap: 8, flexWrap: "nowrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (numero.trim()) buscar();
          }}
        >
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número de orden"
            aria-label="Número o código de la orden"
            className="cifra"
            inputMode="numeric"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Boton type="submit" variante="primario" disabled={buscando || !numero.trim()}>
            {buscando ? "Buscando…" : "Buscar"}
          </Boton>
          <Boton
            type="button"
            variante={escaneando ? "primario" : "contorno"}
            icono={<QrCode size={18} strokeWidth={2} />}
            onClick={() => setEscaneando((v) => !v)}
            aria-label={escaneando ? "Cerrar la cámara" : "Escanear el QR"}
            title="Escanear el QR"
            aria-pressed={escaneando}
          />
        </form>

        {escaneando && (
          <VisorEscaner
            key={intentoCamara}
            formats={["qr_code"]}
            onDetectado={procesarQr}
            buscando={buscando}
            textoSinCamara="Este navegador no lee QR con la cámara. Escribe el número de la orden arriba."
          />
        )}

        {orden && (
          <Tarjeta>
            <div className="fila" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ minWidth: 0 }}>
                <h2>
                  {orden.producto.marca} {orden.producto.modelo}{" "}
                  <span className="cifra" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-3)" }}>
                    #{orden.numero}
                  </span>
                </h2>
                <p className="cifra" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
                  {orden.producto.cliente?.nombre ? `${orden.producto.cliente.nombre} · ` : ""}
                  {orden.producto.serial}
                </p>
              </div>
              {estado && estado in ETIQUETA_ESTADO ? (
                <EstadoOrden estado={estado} />
              ) : (
                <Etiqueta tono="neutro">{orden.estado}</Etiqueta>
              )}
            </div>

            {(orden.items.length > 0 || orden.pagos.length > 0) && (
              <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px solid var(--rule)" }}>
                {orden.items.map((it, i) => (
                  <div key={`i${i}`} className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                    <span>
                      {it.cantidad > 1 ? `${it.cantidad}× ` : ""}
                      {it.descripcion}
                    </span>
                    <span className="cifra">{fmt(it.cantidad * it.precioUnit)}</span>
                  </div>
                ))}
                {orden.pagos.length > 0 && (
                  <div className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", fontWeight: 700 }}>
                    <span>Valor de la orden</span>
                    <span className="cifra">{fmt(orden.valor)}</span>
                  </div>
                )}
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
              </div>
            )}
            <div
              className="fila"
              style={{ justifyContent: "space-between", fontSize: 15, fontWeight: 800, marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--rule)" }}
            >
              <span>Saldo</span>
              <span className="cifra">{fmt(orden.saldoPendiente)}</span>
            </div>

            {estado === "esperando_aprobacion" && (
              <div style={{ marginTop: 14 }}>
                <Aviso tono="aviso">
                  La cotización espera que el cliente la autorice.{" "}
                  <Boton
                    tamano="sm"
                    variante="primario"
                    icono={<ThumbsUp size={15} strokeWidth={2} />}
                    onClick={autorizar}
                    disabled={procesando}
                  >
                    El cliente autoriza
                  </Boton>
                </Aviso>
              </div>
            )}
          </Tarjeta>
        )}

        {orden && entregada && <Aviso tono="ok">Esta orden ya se entregó.</Aviso>}

        {orden && !entregada && (
          <div className="fila" role="tablist" aria-label="Qué hacer con la orden" style={{ gap: 6 }}>
            {(
              [
                { valor: "abonar", texto: "Abonar" },
                { valor: "entregar", texto: "Entregar" },
              ] as const
            ).map((m) => (
              <button
                key={m.valor}
                type="button"
                role="tab"
                aria-selected={modo === m.valor}
                className={`pastilla${modo === m.valor ? " pastilla-activa" : ""}`}
                onClick={() => setModo(m.valor)}
              >
                {m.texto}
              </button>
            ))}
          </div>
        )}

        {orden && !entregada && turnoAbierto === false && <AvisoTurnoCerrado />}

        {orden && !entregada && modo === "abonar" && (
          sePuedeAbonar ? (
            <Tarjeta>
              <div className="fila" style={{ gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
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
              <div className="fila" style={{ marginTop: 14, gap: 10 }}>
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
          ) : (
            <Aviso tono={orden.valor > 0 ? "ok" : "aviso"}>
              {orden.valor > 0
                ? "Esta orden ya está pagada."
                : "La orden todavía no tiene valor. Pon el valor del servicio o envía la cotización para poder abonar."}
            </Aviso>
          )
        )}

        {orden && !entregada && modo === "entregar" && (
          <>
            {orden.saldoPendiente > 0 && metodos.length > 0 && (
              <Tarjeta>
                <PanelCobro
                  total={orden.saldoPendiente}
                  metodos={metodos}
                  metodoPagoId={metodoPagoId}
                  onCambiarMetodo={setMetodoPagoId}
                  montoRecibido={montoRecibido}
                  onCambiarMontoRecibido={setMontoRecibido}
                  imprimir={imprimir}
                  onCambiarImprimir={setImprimir}
                />
              </Tarjeta>
            )}

            <Tarjeta>
              <div className="fila" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <span className="campo-etiqueta" style={{ margin: 0 }}>Foto de salida</span>
                {foto && <Etiqueta tono="ok" punto>Lista</Etiqueta>}
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
                aria-label="Foto de salida del equipo"
                style={{ height: "auto", padding: 10 }}
              />

              <div className="fila" style={{ justifyContent: "space-between", margin: "16px 0 10px" }}>
                <span className="campo-etiqueta" style={{ margin: 0 }}>Firma de quien recibe</span>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Eraser size={15} strokeWidth={2} />}
                  onClick={() => firmaRef.current?.limpiar()}
                >
                  Borrar
                </Boton>
              </div>
              <FirmaCanvas ref={firmaRef} />
            </Tarjeta>

            <Boton
              variante="primario"
              tamano="xl"
              ancho
              icono={<Lock size={19} strokeWidth={2} />}
              onClick={entregar}
              disabled={
                procesando ||
                turnoAbierto === false ||
                (orden.saldoPendiente > 0 && (!metodoPagoId || (metodo?.es_efectivo && cambio < 0)))
              }
            >
              <span className="cifra">
                {procesando
                  ? "Procesando…"
                  : orden.saldoPendiente > 0
                    ? `Cobrar y entregar ${fmt(orden.saldoPendiente)}`
                    : "Entregar"}
              </span>
            </Boton>
          </>
        )}

        {aviso && <Aviso tono="ok">{aviso}</Aviso>}
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
