"use client";

/**
 * La pantalla de la orden desde la app del técnico: la fase actual y
 * nada más. Muestra el historial completo del equipo -- esta pantalla,
 * llegada por el QR, es donde se cumple la primera de las dos promesas
 * del proyecto.
 *
 * Los tres accesos (evidencia, diagnóstico, repuestos) son tarjetas y
 * no enlaces de texto: se tocan con guantes, con una sola mano.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, Wrench, Package, ChevronRight, ArrowRight, KeyRound, Eye, Clock, Check, Printer } from "lucide-react";
import { ENTREGA_DESDE_TALLER, ETIQUETA_ESTADO, siguientesEstados, type Estado } from "@/lib/estados";
import { puede, type Rol } from "@/lib/permisos";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Aviso } from "@/componentes/ui/campo";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { HiloMensajes, type Mensaje } from "@/componentes/mensajeria/hilo-mensajes";
import { SelectorFase } from "@/componentes/taller/selector-fase";

/** Lo que la ficha ofrece como siguiente paso: la entrega anticipada
 *  (desde recibida, diagnóstico, etc.) solo se hace en el mostrador. */
function siguientesDesdeTaller(estado: Estado): Estado[] {
  return siguientesEstados(estado).filter((e) => e !== "entregada" || ENTREGA_DESDE_TALLER.includes(estado));
}

const ETIQUETA_TIPO_ACCESO: Record<string, string> = {
  pin3: "PIN de 3",
  pin4: "PIN de 4",
  pin6: "PIN de 6",
  patron: "Patrón",
  otro: "Otro",
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
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function Acceso({ href, icono, titulo, descripcion }: { href: string; icono: React.ReactNode; titulo: string; descripcion: string }) {
  return (
    <Link
      href={href}
      className="tarjeta"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: 14,
        color: "var(--ink)",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "var(--r-md)",
          background: "var(--accent-suave)",
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        {icono}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--ink-2)" }}>{descripcion}</span>
      </span>
      <ChevronRight size={19} strokeWidth={2} color="var(--ink-3)" aria-hidden />
    </Link>
  );
}

export default function PaginaOrdenTecnico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenTecnico | null>(null);
  const [rol, setRol] = useState<Rol | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [imprimiendo, setImprimiendo] = useState(false);
  const [avisoEtiqueta, setAvisoEtiqueta] = useState<string | null>(null);

  function cargarOrden() {
    fetch(`/api/ordenes/${id}`)
      .then((r) => r.json())
      .then(setOrden)
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

  async function avanzar(aEstado: Estado) {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
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

  if (!orden) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

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

      {rol && puede(rol, "ver_acceso_dispositivo") && <PanelAcceso ordenId={id} />}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Acceso
          href={`/orden/${id}/evidencia`}
          icono={<Camera size={21} strokeWidth={2} />}
          titulo="Evidencia"
          descripcion="Fotos y videos del equipo"
        />
        <Acceso
          href={`/orden/${id}/diagnostico`}
          icono={<Wrench size={21} strokeWidth={2} />}
          titulo="Diagnóstico"
          descripcion="Qué se encontró, y de ahí a la cotización"
        />
        <Acceso
          href={`/orden/${id}/repuestos`}
          icono={<Package size={21} strokeWidth={2} />}
          titulo="Repuestos"
          descripcion="Consumir del inventario o marcar faltante"
        />
      </div>

      {siguientesDesdeTaller(orden.estado).length > 0 && (
        <Tarjeta>
          <div className="campo-etiqueta">Avanzar a</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {siguientesDesdeTaller(orden.estado).map((e) => (
              <Boton
                key={e}
                variante="primario"
                tamano="lg"
                ancho
                icono={<ArrowRight size={19} strokeWidth={2} />}
                disabled={cambiando}
                onClick={() => avanzar(e)}
              >
                {ETIQUETA_ESTADO[e]}
              </Boton>
            ))}
          </div>
        </Tarjeta>
      )}

      <Historial eventos={eventos} />

      <div>
        <h2 style={{ marginBottom: 12 }}>Mensajes</h2>
        <HiloMensajes mensajes={mensajes} ladoPropio="staff" onEnviar={enviarMensaje} placeholder="Responder al cliente…" />
      </div>

      {error && <Aviso tono="peligro">{error}</Aviso>}
    </div>
  );
}
