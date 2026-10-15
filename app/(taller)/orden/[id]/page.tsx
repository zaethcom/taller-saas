"use client";

/**
 * La pantalla de la orden desde la app del técnico: la fase actual y
 * nada más. Muestra el historial completo del equipo -- esta pantalla,
 * llegada por el QR, es donde se cumple la primera de las dos promesas
 * del proyecto.
 *
 * Arriba, el camino de la orden (lib/camino-orden.ts) y el siguiente
 * paso con su botón: el técnico no tiene que saber a qué estado pasar.
 * Los accesos (evidencia, diagnóstico, repuestos) son tarjetas y no
 * enlaces de texto: se tocan con guantes, con una sola mano.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, Wrench, Package, FileText, ChevronRight, ArrowRight, KeyRound, Eye, Clock, Check, Printer } from "lucide-react";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { formatearMoneda } from "@/componentes/cobro/panel-cobro";
import { CAMINO, enlacesVisibles, pasoActual, siguientePaso, type Accion, type Destino } from "@/lib/camino-orden";
import { puede, type Rol } from "@/lib/permisos";
import { Boton, BotonEnlace } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { HiloMensajes, type Mensaje } from "@/componentes/mensajeria/hilo-mensajes";
import { SelectorFase } from "@/componentes/taller/selector-fase";
import { EnlaceOrden } from "@/componentes/taller/enlace-orden";
import { VentanaError } from "@/componentes/ui/ventana-error";

/** Los cambios que piden una nota, y qué se le pregunta a quien los hace. */
const NOTA_AL_PASAR: Partial<Record<Estado, { etiqueta: string; ayuda: string; prefijo: string }>> = {
  listo_entrega: {
    etiqueta: "Trabajo realizado",
    ayuda: "Qué se cambió o reparó, y cómo se probó",
    prefijo: "Trabajo verificado: ",
  },
  rechazada: {
    etiqueta: "Respuesta del cliente",
    ayuda: "Por qué no aprobó, o qué va a decidir",
    prefijo: "Cliente no aprobó: ",
  },
};

const ICONO_DESTINO: Record<Destino, React.ReactNode> = {
  evidencia: <Camera size={14} strokeWidth={2.2} color="var(--accent)" />,
  diagnostico: <Wrench size={14} strokeWidth={2.2} color="var(--accent)" />,
  cotizacion: <FileText size={14} strokeWidth={2.2} color="var(--accent)" />,
  repuestos: <Package size={14} strokeWidth={2.2} color="var(--accent)" />,
  entregar: <ArrowRight size={14} strokeWidth={2.2} color="var(--accent)" />,
};

function rutaDe(destino: Destino, orden: { id: string; numero: number }): string {
  return destino === "entregar" ? `/entregar?numero=${orden.numero}` : `/orden/${orden.id}/${destino}`;
}

/** Los pasos del camino, con el actual marcado y, bajo cada paso al que
 *  ya se llegó, sus pantallas (fotos, diagnóstico, cotización, repuestos). */
function Camino({ estado, orden }: { estado: Estado; orden: { id: string; numero: number } }) {
  const actual = pasoActual(estado);
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      {CAMINO.map((paso, i) => {
        const hecho = i < actual || estado === "entregada";
        const enCurso = i === actual && estado !== "entregada";
        return (
          <li key={paso.titulo} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                borderRadius: "50%",
                flexShrink: 0,
                fontSize: 12,
                fontWeight: 800,
                background: enCurso ? "var(--accent)" : hecho ? "var(--ok-fondo)" : "var(--surface-2)",
                color: enCurso ? "var(--accent-texto)" : hecho ? "var(--ok)" : "var(--ink-3)",
              }}
            >
              {hecho ? <Check size={14} strokeWidth={2.6} /> : i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
              <span style={{ fontWeight: enCurso ? 800 : 500, color: hecho || enCurso ? "var(--ink)" : "var(--ink-3)" }}>
                {paso.titulo}
                {enCurso && paso.estados.length > 1 && (
                  <span style={{ fontWeight: 600, color: "var(--ink-2)" }}> · {ETIQUETA_ESTADO[estado]}</span>
                )}
              </span>
              {enlacesVisibles(i, estado).length > 0 && (
                <span style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                  {enlacesVisibles(i, estado).map((e) => (
                    <Link
                      key={e.destino}
                      href={rutaDe(e.destino, orden)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        height: 34,
                        padding: "0 12px",
                        borderRadius: "var(--r-pill)",
                        border: "1px solid var(--rule)",
                        background: "var(--surface-2)",
                        color: "var(--ink)",
                        fontSize: 13,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      {ICONO_DESTINO[e.destino]}
                      {e.texto}
                      <ChevronRight size={14} strokeWidth={2.2} color="var(--ink-3)" aria-hidden />
                    </Link>
                  ))}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
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
      <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <KeyRound size={19} strokeWidth={2} color="var(--ink-2)" aria-hidden />
        Acceso al equipo
      </h2>
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
  if (eventos.length === 0) return null;
  return (
    <section>
      <h2 style={{ marginBottom: 12 }}>Historial</h2>
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
  fase_id: string | null;
  fase_nombre: string | null;
  token_publico: string;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaOrdenTecnico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenTecnico | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [cambiando, setCambiando] = useState(false);
  // Algunos cambios no son un clic: piden una nota que queda en el historial.
  const [cerrando, setCerrando] = useState<Estado | null>(null);
  const [notaCierre, setNotaCierre] = useState("");
  const [verificado, setVerificado] = useState(false);
  // "Ya viene con precio acordado": salta diagnóstico, cotización y
  // aprobación. Arranca marcado si la orden ya trae un valor.
  const [omitir, setOmitir] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [avisoEtiqueta, setAvisoEtiqueta] = useState<string | null>(null);

  function cargarOrden() {
    fetch(`/api/ordenes/${id}`)
      .then((r) => r.json())
      .then((o: OrdenTecnico) => {
        setOrden(o);
        setOmitir((prev) => prev ?? Number(o.total) > 0);
      })
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
  }, [id]);

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

  async function avanzar(aEstado: Estado, nota?: string, omitirCotizacion?: boolean) {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado, nota, omitirCotizacion }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // Con precio acordado el servidor decide: reparación o esperar repuesto.
      aEstado = (await res.json()).estado ?? aEstado;
      setCerrando(null);
      setNotaCierre("");
      setVerificado(false);
      router.refresh();
      setOrden((prev) => (prev ? { ...prev, estado: aEstado } : prev));
      // La transición también le pone la primera fase del estado nuevo
      // (o ninguna): se vuelve a leer la orden para mostrarla.
      cargarOrden();
      cargarEventos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setCambiando(false);
    }
  }

  // El cliente aprobó aquí o por teléfono: la misma ruta que su enlace
  // (reserva repuestos y decide si va a reparación o a esperar repuesto).
  async function aprobar() {
    if (!orden) return;
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch("/api/aprobacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: orden.token_publico, decision: "aprobada" }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cargarOrden();
      cargarEventos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la aprobación");
    } finally {
      setCambiando(false);
    }
  }

  function ejecutar(accion: Accion) {
    if (accion.tipo === "ir") router.push(rutaDe(accion.destino, orden!));
    else if (accion.tipo === "aprobar") aprobar();
    else if (NOTA_AL_PASAR[accion.a]) setCerrando(accion.a);
    else avanzar(accion.a);
  }

  if (!orden) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  const paso = siguientePaso(orden.estado);
  const antesDeCotizar = orden.estado === "recibida" || orden.estado === "en_diagnostico";

  return (
    <div className="pila">
      <Tarjeta>
        <div className="fila" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h1 className="cifra">Orden #{orden.numero}</h1>
          <span className="fila" style={{ gap: 6, alignItems: "center" }}>
            <EstadoOrden estado={orden.estado} />
            {orden.fase_nombre && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)" }}>· {orden.fase_nombre}</span>
            )}
          </span>
        </div>
        <h2 style={{ fontSize: 17 }}>
          {orden.marca} {orden.modelo}
        </h2>
        <p className="cifra" style={{ margin: "4px 0 14px", fontSize: 13, color: "var(--ink-2)" }}>
          {orden.tipo} · {orden.serial}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div>
            <span style={{ color: "var(--ink-3)" }}>Cliente · </span>
            <strong>{orden.cliente_nombre}</strong>
          </div>
          <div>
            <span style={{ color: "var(--ink-3)" }}>Motivo · </span>
            {orden.motivo}
          </div>
          {Number(orden.total) > 0 && (
            <div>
              <span style={{ color: "var(--ink-3)" }}>Total · </span>
              <strong className="cifra">{fmt(Number(orden.total))}</strong>
            </div>
          )}
        </div>
        <div style={{ marginTop: 14 }}>
          <EnlaceOrden
            ordenId={id}
            tokenPublico={orden.token_publico}
            conWhatsapp={Boolean(rol && puede(rol, "enviar_whatsapp_orden"))}
          />
        </div>
        {rol && puede(rol, "reimprimir_etiqueta_orden") && (
          <div style={{ marginTop: 14 }}>
            <Boton
              variante="contorno"
              icono={<Printer size={16} strokeWidth={2} />}
              onClick={reimprimirEtiqueta}
              disabled={imprimiendo}
            >
              {imprimiendo ? "Enviando…" : "Reimprimir etiqueta"}
            </Boton>
            {avisoEtiqueta && (
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--ink-2)" }}>{avisoEtiqueta}</p>
            )}
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <div className="campo-etiqueta">Camino de la orden</div>
        <Camino estado={orden.estado} orden={orden} />
      </Tarjeta>

      <Tarjeta>
        <div className="campo-etiqueta">Siguiente paso</div>
        {antesDeCotizar && (
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: 12,
              marginBottom: 14,
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              cursor: "pointer",
            }}
          >
            <input type="checkbox" checked={!!omitir} onChange={(e) => setOmitir(e.target.checked)} style={{ marginTop: 2 }} />
            <span>
              <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>Ya viene con precio acordado</span>
              <span style={{ display: "block", fontSize: 12, color: "var(--ink-2)" }}>
                Omite diagnóstico, cotización y aprobación del cliente.
                {Number(orden.total) > 0 ? ` Precio: ${formatearMoneda(Number(orden.total))}.` : ""}
              </span>
            </span>
          </label>
        )}
        {antesDeCotizar && omitir ? (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Reparar</h2>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-2)" }}>
              {Number(orden.total) > 0
                ? "Pasa directo a reparación, o a esperar repuesto si falta alguno pedido a Compras."
                : "La orden no tiene precio todavía. Agrégalo en Repuestos (servicio o mano de obra) y vuelve aquí."}
            </p>
            {!(Number(orden.total) > 0) && (
              <div style={{ marginBottom: 8 }}>
                <BotonEnlace variante="contorno" ancho href={rutaDe("repuestos", orden)} icono={<Package size={17} strokeWidth={2} />}>
                  Repuestos
                </BotonEnlace>
              </div>
            )}
            <Boton
              variante="primario"
              tamano="lg"
              ancho
              icono={<ArrowRight size={19} strokeWidth={2} />}
              disabled={cambiando || !(Number(orden.total) > 0)}
              onClick={() => avanzar("en_reparacion", undefined, true)}
            >
              Continuar a reparación
            </Boton>
          </>
        ) : (
          <>
        <h2 style={{ fontSize: 18, marginBottom: 4 }}>{paso.titulo}</h2>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-2)" }}>{paso.ayuda}</p>
        {paso.acciones.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {paso.acciones.map((accion, i) => (
              <Boton
                key={accion.texto}
                variante={i === 0 ? "primario" : "contorno"}
                tamano={i === 0 ? "lg" : undefined}
                ancho
                icono={i === 0 ? <ArrowRight size={19} strokeWidth={2} /> : undefined}
                disabled={cambiando || (accion.tipo === "estado" && cerrando === accion.a)}
                onClick={() => ejecutar(accion)}
              >
                {accion.texto}
              </Boton>
            ))}
          </div>
        )}
          </>
        )}
          {cerrando && NOTA_AL_PASAR[cerrando] && (
            <div className="pila" style={{ gap: 10, marginTop: 14 }}>
              <label style={{ display: "block" }}>
                <span className="campo-etiqueta">{NOTA_AL_PASAR[cerrando]!.etiqueta}</span>
                <textarea
                  rows={3}
                  value={notaCierre}
                  onChange={(ev) => setNotaCierre(ev.target.value)}
                  placeholder={NOTA_AL_PASAR[cerrando]!.ayuda}
                  autoFocus
                />
              </label>
              {cerrando === "listo_entrega" && (
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={verificado}
                    onChange={(ev) => setVerificado(ev.target.checked)}
                    style={{ width: 18, height: 18, padding: 0, accentColor: "var(--accent)" }}
                  />
                  Verifiqué que el equipo funciona
                </label>
              )}
              <div className="fila" style={{ gap: 8 }}>
                <Boton
                  variante="primario"
                  icono={<Check size={18} strokeWidth={2.4} />}
                  disabled={cambiando || !notaCierre.trim() || (cerrando === "listo_entrega" && !verificado)}
                  onClick={() => avanzar(cerrando, `${NOTA_AL_PASAR[cerrando]!.prefijo}${notaCierre.trim()}`)}
                >
                  Confirmar: {ETIQUETA_ESTADO[cerrando]}
                </Boton>
                <Boton variante="fantasma" onClick={() => setCerrando(null)}>
                  Cancelar
                </Boton>
              </div>
            </div>
          )}
      </Tarjeta>

      {rol && puede(rol, "ver_acceso_dispositivo") && <PanelAcceso ordenId={id} />}

      {/* Las fases de la empresa son detalle opcional dentro de cada paso. */}
      {rol && puede(rol, "diagnosticar") && (
        <SelectorFase
          ordenId={id}
          estado={orden.estado}
          faseId={orden.fase_id}
          onCambio={(fase) => {
            setOrden((prev) => (prev ? { ...prev, fase_id: fase?.id ?? null, fase_nombre: fase?.nombre ?? null } : prev));
            cargarEventos();
          }}
        />
      )}

      <Historial eventos={eventos} />

      <div>
        <h2 style={{ marginBottom: 12 }}>Mensajes</h2>
        <HiloMensajes mensajes={mensajes} ladoPropio="staff" onEnviar={enviarMensaje} placeholder="Responder al cliente…" />
      </div>

      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </div>
  );
}
