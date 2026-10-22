"use client";

/**
 * La pantalla de la orden desde la app del técnico: la fase actual y
 * nada más. Muestra el historial completo del equipo -- esta pantalla,
 * llegada por el QR, es donde se cumple la primera de las dos promesas
 * del proyecto.
 *
 * Arriba, los datos de la orden con su estado (lib/estados.ts: en
 * proceso, falta repuesto, esperando al cliente, listo para entregar) y
 * enseguida los botones de ese estado: casi siempre "Terminado" y
 * "Falta repuesto"; lo demás cambia solo. Los accesos (fotos,
 * diagnóstico, repuestos, cotizar) son pastillas grandes y no enlaces
 * de texto: se tocan con guantes, con una sola mano. Editar y reimprimir
 * van en el menú «⋯»; mensajes, historial y acceso, en pestañas al final.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, Wrench, Package, FileText, ChevronRight, ArrowRight, Eye, Clock, Check, Printer, Pencil, Receipt, PackageX, Undo2 } from "lucide-react";
import { type Estado } from "@/lib/estados";
import { puede, type Rol } from "@/lib/permisos";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { HiloMensajes, type Mensaje } from "@/componentes/mensajeria/hilo-mensajes";
import { EnlaceOrden } from "@/componentes/taller/enlace-orden";
import { VentanaError } from "@/componentes/ui/ventana-error";
import { MenuMas } from "@/componentes/ui/menu-mas";
import { reimprimirComprobante } from "@/componentes/recepcion/ultimas-recepciones";

/** Pantallas de la orden a las que lleva una pastilla. */
type Destino = "evidencia" | "diagnostico" | "repuestos" | "cotizacion" | "entregar";

const ICONO_DESTINO: Record<Destino, React.ReactNode> = {
  evidencia: <Camera size={14} strokeWidth={2.2} color="var(--accent)" />,
  diagnostico: <Wrench size={14} strokeWidth={2.2} color="var(--accent)" />,
  cotizacion: <FileText size={14} strokeWidth={2.2} color="var(--accent)" />,
  repuestos: <Package size={14} strokeWidth={2.2} color="var(--accent)" />,
  entregar: <ArrowRight size={14} strokeWidth={2.2} color="var(--accent)" />,
};

const TEXTO_DESTINO: Record<Destino, string> = {
  evidencia: "Fotos y videos",
  diagnostico: "Diagnóstico",
  repuestos: "Repuestos y servicios",
  cotizacion: "Cotizar",
  entregar: "Cobrar y entregar",
};

function rutaDe(destino: Destino, orden: { id: string; numero: number }): string {
  return destino === "entregar" ? `/entregar?numero=${orden.numero}` : `/orden/${orden.id}/${destino}`;
}

/** Las pantallas de la orden mientras está en el taller. "Cotizar" es
 *  opcional: solo cuando hay que pedirle permiso al cliente. */
function Pastillas({ estado, orden }: { estado: Estado; orden: { id: string; numero: number } }) {
  if (estado === "entregada") return null;
  const destinos: Destino[] =
    estado === "esperando_cliente"
      ? ["evidencia", "diagnostico", "repuestos"]
      : ["evidencia", "diagnostico", "repuestos", "cotizacion"];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {destinos.map((d) => (
        <Link key={d} href={rutaDe(d, orden)} className="pastilla" style={{ gap: 6 }}>
          {ICONO_DESTINO[d]}
          {TEXTO_DESTINO[d]}
          <ChevronRight size={14} strokeWidth={2.2} color="var(--ink-3)" aria-hidden />
        </Link>
      ))}
    </div>
  );
}

/** Los botones de cada estado. Lo que no está aquí cambia solo: pedir a
 *  Compras, recibir el repuesto, enviar una cotización, la aprobación. */
function AccionesEstado({
  orden,
  cambiando,
  panel,
  onPanel,
  onAvanzar,
  onDecidir,
  onIr,
}: {
  orden: { estado: Estado; cotizacion_rechazada: boolean };
  cambiando: boolean;
  panel: "terminado" | "falta" | "rechazo" | null;
  onPanel: (p: "terminado" | "falta" | "rechazo") => void;
  onAvanzar: (a: Estado) => void;
  onDecidir: (d: "aprobada") => void;
  onIr: (d: Destino) => void;
}) {
  const bloqueado = cambiando || panel !== null;
  const ayuda = (t: string) => <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-2)" }}>{t}</p>;
  const botones = (hijos: React.ReactNode) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{hijos}</div>
  );

  switch (orden.estado) {
    case "en_proceso":
      return (
        <>
          {ayuda("Cuando el equipo quede listo, márcalo terminado. Si falta un repuesto, pídelo y la orden espera sola.")}
          {botones(
            <>
              <Boton variante="primario" tamano="lg" ancho icono={<Check size={19} strokeWidth={2.4} />} disabled={bloqueado} onClick={() => onPanel("terminado")}>
                Terminado
              </Boton>
              <Boton variante="contorno" ancho icono={<PackageX size={17} strokeWidth={2} />} disabled={bloqueado} onClick={() => onPanel("falta")}>
                Falta repuesto
              </Boton>
            </>,
          )}
        </>
      );
    case "falta_repuesto":
      return (
        <>
          {ayuda("Compras ya lo tiene en su lista. Cuando lo marque como recibido, la orden vuelve sola a En proceso.")}
          {botones(
            <Boton variante="contorno" ancho icono={<Undo2 size={17} strokeWidth={2} />} disabled={bloqueado} onClick={() => onAvanzar("en_proceso")}>
              Seguir sin esperar el repuesto
            </Boton>,
          )}
        </>
      );
    case "esperando_cliente":
      return orden.cotizacion_rechazada ? (
        <>
          {ayuda("El cliente no aprobó la cotización. Envíale otra, o entrégale el equipo sin reparar.")}
          {botones(
            <>
              <Boton variante="primario" tamano="lg" ancho icono={<FileText size={18} strokeWidth={2} />} disabled={bloqueado} onClick={() => onIr("cotizacion")}>
                Volver a cotizar
              </Boton>
              <Boton variante="contorno" ancho icono={<ArrowRight size={17} strokeWidth={2} />} disabled={bloqueado} onClick={() => onIr("entregar")}>
                Entregar sin reparar
              </Boton>
            </>,
          )}
        </>
      ) : (
        <>
          {ayuda("Se le envió la cotización. El cliente responde desde su enlace; si lo hizo aquí o por teléfono, regístralo.")}
          {botones(
            <>
              <Boton variante="primario" tamano="lg" ancho icono={<Check size={19} strokeWidth={2.4} />} disabled={bloqueado} onClick={() => onDecidir("aprobada")}>
                El cliente aprobó
              </Boton>
              <Boton variante="contorno" ancho disabled={bloqueado} onClick={() => onPanel("rechazo")}>
                El cliente no aprobó
              </Boton>
            </>,
          )}
        </>
      );
    case "listo_entrega":
      return (
        <>
          {ayuda("En Cobrar y entregar se cobra el saldo y, si quieres, se toma la foto de salida.")}
          {botones(
            <>
              <Boton variante="primario" tamano="lg" ancho icono={<ArrowRight size={19} strokeWidth={2} />} disabled={bloqueado} onClick={() => onIr("entregar")}>
                Cobrar y entregar
              </Boton>
              <Boton variante="contorno" ancho icono={<Undo2 size={17} strokeWidth={2} />} disabled={bloqueado} onClick={() => onAvanzar("en_proceso")}>
                Volver a En proceso
              </Boton>
            </>,
          )}
        </>
      );
    case "entregada":
      return null;
  }
}

const ETIQUETA_TIPO_ACCESO: Record<string, string> = {
  pin: "PIN",
  // Órdenes guardadas antes de que el PIN fuera de cualquier largo.
  pin3: "PIN",
  pin4: "PIN",
  pin6: "PIN",
  patron: "Patrón",
  contrasena: "Contraseña",
  otro: "Otros",
};

/** Panel con el PIN/patrón del equipo -- se carga solo al tocar "Ver",
 *  nunca automático con el resto de la orden, para no exponerlo sin
 *  necesidad en una pantalla que puede estar a la vista del cliente. */
function PanelAcceso({ ordenId }: { ordenId: string }) {
  const [acceso, setAcceso] = useState<{ tipo: string; valor: string; nota: string | null } | null | undefined>(
    undefined,
  );
  const [cargando, setCargando] = useState(false);

  async function verAcceso() {
    setCargando(true);
    try {
      const res = await fetch(`/api/ordenes/${ordenId}/acceso`);
      setAcceso(res.ok ? await res.json() : null);
    } catch {
      setAcceso(null);
    } finally {
      setCargando(false);
    }
  }

  return (
    <Tarjeta>
      {acceso === undefined ? (
        <Boton variante="contorno" icono={<Eye size={16} strokeWidth={2} />} onClick={verAcceso} disabled={cargando}>
          {cargando ? "Cargando…" : "Ver código de acceso"}
        </Boton>
      ) : acceso === null ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>No se registró información de acceso.</p>
      ) : (
        <div>
          <div className="campo-etiqueta">{ETIQUETA_TIPO_ACCESO[acceso.tipo] ?? acceso.tipo}</div>
          <div className="cifra" style={{ fontSize: 20, fontWeight: 800 }}>
            {acceso.tipo === "patron" ? acceso.valor.split("-").join(" → ") : acceso.valor}
          </div>
          {acceso.nota && (
            <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{acceso.nota}</p>
          )}
        </div>
      )}
    </Tarjeta>
  );
}

interface Contabilidad {
  cobrado: number;
  pagado: number;
  costoCompras: number;
  costoInventario: number;
  gastado: number;
  utilidad: number;
  margen: number | null;
  sinCosto: number;
  compras: { producto: string; cantidad: number; costo: number }[];
  inventario: { descripcion: string; cantidad: number; costoUnit: number | null }[];
}

/** Cuánto se gastó, cuánto se cobra y cuánto queda: solo el
 *  administrador (ver_utilidad_orden). Se carga al abrir la pestaña. */
function PanelContabilidad({ ordenId }: { ordenId: string }) {
  const [datos, setDatos] = useState<Contabilidad | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ordenes/${ordenId}/contabilidad`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setDatos(d);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar"));
  }, [ordenId]);

  if (error) return <Tarjeta style={{ color: "var(--ink-3)", fontSize: 13 }}>{error}</Tarjeta>;
  if (!datos) return <Tarjeta style={{ color: "var(--ink-3)", fontSize: 13 }}>Cargando…</Tarjeta>;

  const fila = (texto: string, valor: string, fuerte = false) => (
    <div className="fila" style={{ justifyContent: "space-between", gap: 10, fontSize: fuerte ? 16 : 14, fontWeight: fuerte ? 800 : 500 }}>
      <span>{texto}</span>
      <span className="cifra">{valor}</span>
    </div>
  );

  return (
    <Tarjeta>
      <div className="pila" style={{ gap: 8 }}>
        {fila("Valor de la orden (cobrado al cliente)", fmt(datos.cobrado))}
        {datos.compras.map((c, i) => (
          <div key={`c${i}`}>{fila(`Compra: ${c.producto}${c.cantidad > 1 ? ` x${c.cantidad}` : ""}`, `− ${fmt(c.costo)}`)}</div>
        ))}
        {datos.inventario.map((r, i) => (
          <div key={`i${i}`}>
            {fila(
              `Inventario: ${r.descripcion}${r.cantidad > 1 ? ` x${r.cantidad}` : ""}`,
              r.costoUnit == null ? "sin costo" : `− ${fmt(r.costoUnit * r.cantidad)}`,
            )}
          </div>
        ))}
        {datos.compras.length + datos.inventario.length === 0 && (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Esta orden no tiene repuestos con costo.</p>
        )}
        <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 8 }} className="pila">
          {fila("Gastado en repuestos", fmt(datos.gastado))}
          {fila(
            `Utilidad${datos.margen != null ? ` (${datos.margen.toLocaleString("es-CO")} %)` : ""}`,
            fmt(datos.utilidad),
            true,
          )}
          {datos.pagado < datos.cobrado && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
              El cliente ha pagado {fmt(datos.pagado)} de {fmt(datos.cobrado)}.
            </p>
          )}
          {datos.sinCosto > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: "var(--aviso, var(--ink-3))" }}>
              {datos.sinCosto === 1 ? "Un repuesto no tiene" : `${datos.sinCosto} repuestos no tienen`} costo anotado: la
              utilidad real es menor.
            </p>
          )}
        </div>
      </div>
    </Tarjeta>
  );
}

interface Evento {
  estado: string;
  etiqueta: string;
  nota: string | null;
  fecha: string;
}

/** Mismo formato de timeline que ya usa app/(publico)/seguimiento/[token]/page.tsx,
 *  del lado del técnico/admin -- Fase 8 del Plan 1. La nota (si hay)
 *  solo se muestra acá, no en el enlace público del cliente. */
function Historial({ eventos }: { eventos: Evento[] }) {
  if (eventos.length === 0) {
    return <Tarjeta style={{ color: "var(--ink-3)", fontSize: 13 }}>Todavía no hay movimientos.</Tarjeta>;
  }
  return (
    <section>
      <Tarjeta>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          {eventos.map((e, i) => (
            <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  background: i === eventos.length - 1 ? "var(--accent)" : "var(--surface-2)",
                  color: i === eventos.length - 1 ? "var(--accent-texto)" : "var(--ink-3)",
                  flexShrink: 0,
                }}
              >
                {i === eventos.length - 1 ? <Clock size={14} strokeWidth={2.4} /> : <Check size={14} strokeWidth={2.6} />}
              </span>
              <span>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{e.etiqueta}</span>
                <span className="cifra" style={{ display: "block", fontSize: 12, color: "var(--ink-3)" }}>
                  {new Date(e.fecha).toLocaleString("es-CO")}
                </span>
                {e.nota && (
                  <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)", marginTop: 2 }}>{e.nota}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </Tarjeta>
    </section>
  );
}

interface OrdenTecnico {
  id: string;
  numero: number;
  estado: Estado;
  motivo: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  cliente_nombre: string;
  total: number;
  token_publico: string;
  /** El cliente no aprobó la última cotización (sigue esperándolo). */
  cotizacion_rechazada: boolean;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaOrdenTecnico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenTecnico | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [cambiando, setCambiando] = useState(false);
  // Terminado (nota opcional), qué falta (va a Compras) o por qué el
  // cliente no aprobó: un campo de texto debajo de los botones.
  const [panel, setPanel] = useState<"terminado" | "falta" | "rechazo" | null>(null);
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [avisoEtiqueta, setAvisoEtiqueta] = useState<string | null>(null);
  const [pestana, setPestana] = useState<"mensajes" | "historial" | "acceso" | "utilidad">("mensajes");

  function cargarOrden() {
    fetch(`/api/ordenes/${id}`)
      .then((r) => r.json())
      .then((o: OrdenTecnico) => setOrden(o))
      .catch(() => setError("No se pudo cargar la orden"));
  }

  function cargarEventos() {
    fetch(`/api/ordenes/${id}/eventos`)
      .then((r) => r.json())
      .then((data) => setEventos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }

  useEffect(() => {
    cargarOrden();
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((p) => setRol(p.rol ?? null))
      .catch(() => {});
    cargarEventos();
    cargarMensajes();
    // Abrir la orden es atender sus avisos: salen del globo de la barra
    // superior para todo el taller (0061_avisos_cliente.sql).
    fetch("/api/avisos/atender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ordenId: id }),
    }).catch(() => {});
  }, [id]);

  // Desde un aviso se llega con #mensajes, pero la tarjeta aparece
  // cuando ya cargó la orden: el navegador no alcanza a bajar solo.
  const ordenCargada = Boolean(orden);
  useEffect(() => {
    if (ordenCargada && window.location.hash === "#mensajes") {
      document.getElementById("mensajes")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [ordenCargada]);

  async function cargarMensajes() {
    const res = await fetch(`/api/ordenes/${id}/mensajes`);
    if (res.ok) setMensajes(await res.json());
  }

  async function enviarMensaje(texto: string) {
    const res = await fetch(`/api/ordenes/${id}/mensajes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    await cargarMensajes();
  }

  async function reimprimirRecibo() {
    setAvisoEtiqueta("Enviando recibo…");
    try {
      await reimprimirComprobante(id);
      setAvisoEtiqueta("Recibo de recepción enviado a la impresora de esta sede.");
    } catch (e) {
      setAvisoEtiqueta(e instanceof Error ? e.message : "No se pudo reimprimir el recibo");
    }
  }

  async function reimprimirEtiqueta() {
    setImprimiendo(true);
    setAvisoEtiqueta(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/etiqueta`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      setAvisoEtiqueta("Etiqueta enviada a la etiquetadora de esta sede.");
    } catch (e) {
      setAvisoEtiqueta(e instanceof Error ? e.message : "No se pudo reimprimir la etiqueta");
    } finally {
      setImprimiendo(false);
    }
  }

  function cerrarPanel() {
    setPanel(null);
    setTexto("");
  }

  /** Después de cualquier cambio: la orden y su historial se vuelven a leer. */
  function recargar() {
    router.refresh();
    cargarOrden();
    cargarEventos();
  }

  async function avanzar(aEstado: Estado, nota?: string) {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado, nota }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cerrarPanel();
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setCambiando(false);
    }
  }

  // Lo que falta va a Compras, y la orden pasa sola a "Falta repuesto";
  // vuelve sola a "En proceso" cuando Compras lo recibe.
  async function pedirRepuesto() {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "faltante", descripcion: texto.trim(), cantidad: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cerrarPanel();
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo pedir el repuesto");
    } finally {
      setCambiando(false);
    }
  }

  // El cliente respondió aquí o por teléfono: la misma ruta que su enlace
  // (al aprobar reserva repuestos y decide si sigue en proceso o falta repuesto).
  async function decidir(decision: "aprobada" | "rechazada") {
    if (!orden) return;
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch("/api/aprobacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: orden.token_publico,
          decision,
          motivo: decision === "rechazada" ? texto.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cerrarPanel();
      recargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la respuesta del cliente");
    } finally {
      setCambiando(false);
    }
  }

  if (!orden) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div className="pila">
      <Tarjeta>
        <div className="fila" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "nowrap" }}>
          <div style={{ minWidth: 0 }}>
            <div className="fila" style={{ gap: 10, alignItems: "center" }}>
              <h1 className="cifra">Orden #{orden.numero}</h1>
              <EstadoOrden estado={orden.estado} />
              {orden.estado === "esperando_cliente" && orden.cotizacion_rechazada && (
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>· No aprobó</span>
              )}
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 15, fontWeight: 700 }}>
              {orden.marca} {orden.modelo}{" "}
              <span className="cifra" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-3)" }}>
                · {orden.tipo} · {orden.serial}
              </span>
            </p>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: "var(--ink-2)" }}>
              {orden.cliente_nombre}
              {Number(orden.total) > 0 && (
                <>
                  {" · "}
                  <strong className="cifra" style={{ color: "var(--ink)" }}>{fmt(Number(orden.total))}</strong>
                </>
              )}
            </p>
          </div>
          <MenuMas
            opciones={[
              ...(rol && puede(rol, "editar_orden") && orden.estado !== "entregada"
                ? [
                    {
                      texto: "Editar datos",
                      icono: <Pencil size={16} strokeWidth={2} />,
                      href: `/ordenes/${id}/editar?volver=${encodeURIComponent(`/orden/${id}`)}`,
                    },
                  ]
                : []),
              ...(rol && puede(rol, "reimprimir_comprobante_orden")
                ? [
                    {
                      texto: "Reimprimir recibo de recepción",
                      icono: <Receipt size={16} strokeWidth={2} />,
                      onClick: reimprimirRecibo,
                    },
                  ]
                : []),
              ...(rol && puede(rol, "reimprimir_etiqueta_orden")
                ? [
                    {
                      texto: imprimiendo ? "Enviando etiqueta…" : "Reimprimir etiqueta",
                      icono: <Printer size={16} strokeWidth={2} />,
                      onClick: reimprimirEtiqueta,
                      disabled: imprimiendo,
                    },
                  ]
                : []),
            ]}
          />
        </div>
        {orden.motivo && <p style={{ margin: "10px 0 0", fontSize: 14 }}>{orden.motivo}</p>}
        {avisoEtiqueta && <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{avisoEtiqueta}</p>}

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
          <Pastillas estado={orden.estado} orden={orden} />
        </div>

        <div style={{ marginTop: 14 }}>
          <EnlaceOrden
            ordenId={id}
            tokenPublico={orden.token_publico}
            conWhatsapp={Boolean(rol && puede(rol, "enviar_whatsapp_orden"))}
          />
        </div>
      </Tarjeta>

      {orden.estado !== "entregada" && (
        <Tarjeta>
          <AccionesEstado
            orden={orden}
            cambiando={cambiando}
            panel={panel}
            onPanel={(p) => {
              setPanel(p);
              setTexto("");
            }}
            onAvanzar={avanzar}
            onDecidir={decidir}
            onIr={(d) => router.push(rutaDe(d, orden))}
          />
          {panel && (
            <div className="pila" style={{ gap: 10, marginTop: 14 }}>
              <label style={{ display: "block" }}>
                <span className="campo-etiqueta">
                  {panel === "terminado"
                    ? "Qué se hizo (opcional)"
                    : panel === "falta"
                      ? "Qué repuesto falta"
                      : "Qué dijo el cliente (opcional)"}
                </span>
                <textarea
                  rows={panel === "falta" ? 2 : 3}
                  value={texto}
                  onChange={(ev) => setTexto(ev.target.value)}
                  placeholder={
                    panel === "terminado"
                      ? "Ej. Cambio de pantalla, probado"
                      : panel === "falta"
                        ? "Ej. Pantalla Samsung A32"
                        : "Ej. Le parece caro, lo recoge sin reparar"
                  }
                  autoFocus
                />
              </label>
              <div className="fila" style={{ gap: 8 }}>
                <Boton
                  variante="primario"
                  icono={<Check size={18} strokeWidth={2.4} />}
                  disabled={cambiando || (panel === "falta" && !texto.trim())}
                  onClick={() =>
                    panel === "terminado"
                      ? avanzar("listo_entrega", texto.trim() || undefined)
                      : panel === "falta"
                        ? pedirRepuesto()
                        : decidir("rechazada")
                  }
                >
                  {panel === "terminado" ? "Marcar terminado" : panel === "falta" ? "Pedir a Compras" : "Guardar"}
                </Boton>
                <Boton variante="fantasma" onClick={cerrarPanel}>
                  Cancelar
                </Boton>
              </div>
            </div>
          )}
        </Tarjeta>
      )}

      <div id="mensajes" style={{ scrollMarginTop: 16 }}>
        <div role="tablist" aria-label="Detalle de la orden" style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12 }}>
          {(
            [
              { valor: "mensajes", texto: `Mensajes${mensajes.length ? ` (${mensajes.length})` : ""}` },
              { valor: "historial", texto: "Historial" },
              ...(rol && puede(rol, "ver_acceso_dispositivo") ? [{ valor: "acceso", texto: "Acceso" }] : []),
              ...(rol && puede(rol, "ver_utilidad_orden") ? [{ valor: "utilidad", texto: "Costos y utilidad" }] : []),
            ] as { valor: typeof pestana; texto: string }[]
          ).map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              aria-selected={pestana === p.valor}
              className={`pastilla${pestana === p.valor ? " pastilla-activa" : ""}`}
              onClick={() => setPestana(p.valor)}
            >
              {p.texto}
            </button>
          ))}
        </div>
        <div role="tabpanel">
          {pestana === "mensajes" && (
            <HiloMensajes mensajes={mensajes} ladoPropio="staff" onEnviar={enviarMensaje} placeholder="Responder al cliente…" />
          )}
          {pestana === "historial" && <Historial eventos={eventos} />}
          {pestana === "acceso" && <PanelAcceso ordenId={id} />}
          {pestana === "utilidad" && <PanelContabilidad ordenId={id} />}
        </div>
      </div>

      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </div>
  );
}
