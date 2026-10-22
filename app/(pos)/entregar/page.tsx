"use client";

/**
 * Entrega: buscar la orden, cobrar el saldo pendiente, capturar firma
 * y foto de salida, y cerrar -- Fase 8 del plano de construcción.
 *
 * La transición a "entregada" la valida el servidor
 * (/api/ordenes/[id]/transicion) contra saldo_en_cero, tiene_firma y
 * tiene_foto_salida reales -- esta pantalla no duplica esa lógica,
 * solo intenta la transición y muestra el error si algo falta. Lo que
 * sí hace la pantalla es mostrar cuáles de esos tres requisitos ya
 * están cumplidos, para que quien entrega no descubra lo que falta al
 * final, cuando el cliente ya está esperando en el mostrador.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Check, Camera, PenLine, Eraser, Lock, Printer, Hash } from "lucide-react";
import { FirmaCanvas, type FirmaCanvasHandle } from "@/componentes/evidencia/firma-canvas";
import { VisorEscaner, SeparadorEscribelo } from "@/componentes/lector-codigos/visor-escaner";
import { PanelCobro } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { subirEvidencia } from "@/lib/subir-evidencia";
import { extraerTokenDeSeguimiento } from "@/lib/token-seguimiento";
import { ETIQUETA_ESTADO, puedeTransicionar, type Estado } from "@/lib/estados";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo } from "@/componentes/ui/campo";
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
  saldoPendiente: number;
  /** Valor de la orden y lo ya pagado en abonos o cobros (lib/cuenta-orden.ts). */
  valor: number;
  pagado: number;
  pagos: { numero: number; tipo: string; monto: number; medio: string | null; fecha: string }[];
  items: ItemOrden[];
  producto: { marca: string | null; modelo: string | null; tipo: string; serial: string };
}

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaEntregar() {
  const router = useRouter();
  const firmaRef = useRef<FirmaCanvasHandle>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);
  // Lo que ya quedó hecho en un intento anterior de esta misma entrega,
  // para que reintentar no cobre, imprima ni suba evidencia dos veces.
  const cobradaRef = useRef(false);
  const evidenciaSubidaRef = useRef(false);

  const [numero, setNumero] = useState("");
  const [orden, setOrden] = useState<OrdenEncontrada | null>(null);
  const [escaneando, setEscaneando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  // La cámara se apaga al leer un código: si la búsqueda falla, se
  // vuelve a montar el visor para leer otro.
  const [intentoCamara, setIntentoCamara] = useState(0);
  const [foto, setFoto] = useState<File | null>(null);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [imprimir, setImprimir] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      setOrden(await resOrden.json());
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

  // Desde la ficha de la orden ("Entregar") llega con ?numero=N; si no,
  // la cámara abre de una para escanear el QR de la etiqueta.
  useEffect(() => {
    const n = new URLSearchParams(window.location.search).get("numero");
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

  return (
    <div>
      <TituloPantalla
        titulo="Entregar"
      />

      {!orden ? (
        <div className="pila">
          {escaneando && (
            <>
              <VisorEscaner
                key={intentoCamara}
                formats={["qr_code"]}
                onDetectado={procesarQr}
                buscando={buscando}
                textoSinCamara="Este navegador no lee QR con la cámara. Escribe el número de la orden abajo."
              />
              <SeparadorEscribelo />
            </>
          )}

          <Tarjeta>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (numero.trim()) buscar();
              }}
            >
              <Campo etiqueta="Número o código de la orden">
                <div className="fila" style={{ gap: 0, flexWrap: "nowrap" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 46,
                      height: 44,
                      borderRadius: "var(--r-md) 0 0 var(--r-md)",
                      border: "1px solid var(--rule-fuerte)",
                      borderRight: "none",
                      background: "var(--surface-2)",
                      color: "var(--ink-2)",
                      flexShrink: 0,
                    }}
                  >
                    <Hash size={20} strokeWidth={1.8} aria-hidden />
                  </span>
                  <input
                    value={numero}
                    onChange={(e) => setNumero(e.target.value)}
                    placeholder="Ej. 13"
                    aria-label="Número de orden"
                    className="cifra"
                    style={{ borderRadius: "0 var(--r-md) var(--r-md) 0" }}
                  />
                </div>
              </Campo>
              <div style={{ marginTop: 14 }}>
                <Boton
                  type="submit"
                  variante="primario"
                  tamano="lg"
                  ancho
                  icono={<Search size={19} strokeWidth={2} />}
                  disabled={buscando || !numero.trim()}
                >
                  {buscando ? "Buscando…" : "Buscar orden"}
                </Boton>
              </div>
            </form>
          </Tarjeta>

          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
        </div>
      ) : (
        <div className="pila">
          <Tarjeta>
            <div className="fila" style={{ justifyContent: "space-between" }}>
              <div>
                <h2>
                  {orden.producto.marca} {orden.producto.modelo}
                </h2>
                <p className="cifra" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
                  {orden.producto.tipo} · {orden.producto.serial} · orden #{orden.numero}
                </p>
              </div>
              {orden.saldoPendiente > 0 ? (
                <Etiqueta tono="aviso" punto>
                  <span className="cifra">Saldo {fmt(orden.saldoPendiente)}</span>
                </Etiqueta>
              ) : (
                <Etiqueta tono="ok" punto>
                  Sin saldo pendiente
                </Etiqueta>
              )}
            </div>

            {orden.items.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
                <div className="campo-etiqueta">Qué se usó</div>
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

            {orden.pagos.length > 0 && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
                <div className="campo-etiqueta">Cuenta del equipo</div>
                <div className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
                  <span>Valor de la orden</span>
                  <span className="cifra">{fmt(orden.valor)}</span>
                </div>
                {orden.pagos.map((p) => (
                  <div key={p.numero} className="fila" style={{ justifyContent: "space-between", fontSize: 13, padding: "4px 0", color: "var(--ink-2)" }}>
                    <span>
                      {p.tipo === "anticipo" ? "Abono" : "Pago"} · {new Date(p.fecha).toLocaleDateString("es-CO")}
                      {p.medio ? ` · ${p.medio}` : ""}
                    </span>
                    <span className="cifra">−{fmt(p.monto)}</span>
                  </div>
                ))}
                <div className="fila" style={{ justifyContent: "space-between", fontSize: 14, fontWeight: 800, padding: "4px 0" }}>
                  <span>Saldo</span>
                  <span className="cifra">{fmt(orden.saldoPendiente)}</span>
                </div>
              </div>
            )}

            {orden.saldoPendiente > 0 && metodos.length > 0 && (
              <div style={{ marginTop: 16 }}>
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
              </div>
            )}
          </Tarjeta>

          {turnoAbierto === false && <AvisoTurnoCerrado />}

          <Tarjeta>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <Camera size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Foto de salida
              {foto && <Etiqueta tono="ok" punto>Lista</Etiqueta>}
            </h2>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              aria-label="Foto de salida del equipo"
              style={{ height: "auto", padding: 10 }}
            />
            <p className="campo-ayuda">Queda visible para el cliente en su enlace de seguimiento.</p>
          </Tarjeta>

          <Tarjeta>
            <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
              <PenLine size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Firma de quien recibe
            </h2>
            <FirmaCanvas ref={firmaRef} />
            <div style={{ marginTop: 10 }}>
              <Boton
                variante="fantasma"
                tamano="sm"
                icono={<Eraser size={15} strokeWidth={2} />}
                onClick={() => firmaRef.current?.limpiar()}
              >
                Borrar firma
              </Boton>
            </div>
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

          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
        </div>
      )}
    </div>
  );
}
