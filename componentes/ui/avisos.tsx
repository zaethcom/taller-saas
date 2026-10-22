"use client";

/**
 * El globo de la barra superior: lo que los clientes hicieron desde el
 * enlace de seguimiento y nadie ha atendido (0061_avisos_cliente.sql).
 * Un número rojo con cuántos hay; al tocarlo, un panel con cada orden,
 * su mensaje o su decisión, y una caja para responderle ahí mismo --
 * recepción no entra a /orden/[id], así que responder no puede depender
 * de esa pantalla.
 *
 * Revisa cada 20 segundos. Cuando llega algo nuevo suena un aviso y, si
 * este equipo dio permiso y la pestaña no está a la vista, sale una
 * notificación del sistema. Con las llaves VAPID configuradas, además
 * se puede activar el push: llega aunque la app esté cerrada.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, CheckCircle2, ExternalLink, MessageCircle, PackageCheck, Send, X, XCircle } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { ETIQUETA_AVISO, base64UrlABytes, type TipoAviso } from "@/lib/avisos";
import { puedeEntrarA, type Rol } from "@/lib/permisos";

interface Aviso {
  id: string;
  ordenId: string;
  tipo: TipoAviso;
  texto: string;
  creadoEn: string;
  numero: number | null;
  cliente: string | null;
}

interface GrupoOrden {
  ordenId: string;
  numero: number | null;
  cliente: string | null;
  avisos: Aviso[];
}

type EstadoPush = "cargando" | "no_soportado" | "iphone_sin_instalar" | "bloqueado" | "activo" | "inactivo";

const CADA_MS = 20_000;

function agrupar(avisos: Aviso[]): GrupoOrden[] {
  const grupos = new Map<string, GrupoOrden>();
  for (const a of avisos) {
    const g = grupos.get(a.ordenId) ?? { ordenId: a.ordenId, numero: a.numero, cliente: a.cliente, avisos: [] };
    g.avisos.push(a);
    grupos.set(a.ordenId, g);
  }
  // Dentro de cada orden, del más viejo al más nuevo: se lee como conversación.
  return [...grupos.values()].map((g) => ({ ...g, avisos: [...g.avisos].reverse() }));
}

function haceCuanto(fecha: string): string {
  const min = Math.round((Date.now() - new Date(fecha).getTime()) / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return new Date(fecha).toLocaleDateString("es-CO");
}

/** Dos tonos cortos con WebAudio: no hace falta un archivo de sonido. */
function sonar() {
  try {
    const Contexto = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Contexto) return;
    const ctx = new Contexto();
    [880, 1320].forEach((frecuencia, i) => {
      const osc = ctx.createOscillator();
      const vol = ctx.createGain();
      osc.frequency.value = frecuencia;
      vol.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      vol.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.16);
      osc.connect(vol).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.17);
    });
    setTimeout(() => ctx.close().catch(() => {}), 600);
  } catch {
    // El navegador puede bloquear el sonido hasta que la persona toque algo.
  }
}

function IconoAviso({ tipo }: { tipo: TipoAviso }) {
  if (tipo === "mensaje") return <MessageCircle size={16} strokeWidth={2} color="var(--accent)" />;
  if (tipo === "repuesto_recibido") return <PackageCheck size={16} strokeWidth={2} color="var(--ok)" />;
  if (tipo === "cotizacion_aprobada" || tipo === "item_aprobado")
    return <CheckCircle2 size={16} strokeWidth={2} color="var(--ok)" />;
  return <XCircle size={16} strokeWidth={2} color="var(--peligro)" />;
}

export function Avisos({ rol }: { rol: Rol }) {
  const [disponible, setDisponible] = useState(false);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [clavePush, setClavePush] = useState<string | null>(null);
  const [estadoPush, setEstadoPush] = useState<EstadoPush>("cargando");
  const [permisoLocal, setPermisoLocal] = useState<NotificationPermission | "no_soportado">("default");
  const vistos = useRef<Set<string> | null>(null);
  const pushActivo = useRef(false);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/avisos", { cache: "no-store" });
      if (!res.ok) return;
      const datos = (await res.json()) as { disponible: boolean; avisos: Aviso[]; clavePush?: string | null };
      setDisponible(datos.disponible);
      setAvisos(datos.avisos);
      setClavePush(datos.clavePush ?? null);

      // La primera carga solo aprende qué había; de ahí en adelante, lo
      // que aparece nuevo suena y (si se puede) sale como notificación.
      const nuevos = vistos.current ? datos.avisos.filter((a) => !vistos.current!.has(a.id)) : [];
      vistos.current = new Set(datos.avisos.map((a) => a.id));
      if (nuevos.length === 0) return;
      sonar();
      if (pushActivo.current || !document.hidden) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const a = nuevos[0]!;
      const titulo = `${a.tipo === "mensaje" ? `${a.cliente ?? "El cliente"} escribió` : ETIQUETA_AVISO[a.tipo]}${a.numero != null ? ` · Orden #${a.numero}` : ""}`;
      const registro = await navigator.serviceWorker?.getRegistration();
      const opciones = { body: a.texto, tag: `orden-${a.ordenId}`, icon: "/icon.svg", data: { url: window.location.pathname + "?avisos=1" } };
      if (registro) await registro.showNotification(titulo, opciones);
      else new Notification(titulo, opciones);
    } catch {
      // Sin red un momento: se reintenta en la próxima vuelta.
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => {
      if (!document.hidden) cargar();
    }, CADA_MS);
    const alVolver = () => {
      if (!document.hidden) cargar();
    };
    document.addEventListener("visibilitychange", alVolver);
    if (new URLSearchParams(window.location.search).get("avisos") === "1") setAbierto(true);
    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [cargar]);

  // En segundo plano también se revisa, pero más despacio, para que la
  // notificación local salga aunque la pestaña esté detrás de otra.
  useEffect(() => {
    const lento = setInterval(() => {
      if (document.hidden) cargar();
    }, CADA_MS * 3);
    return () => clearInterval(lento);
  }, [cargar]);

  const revisarPush = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermisoLocal("no_soportado");
    } else {
      setPermisoLocal(Notification.permission);
    }
    const esIphone = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const instalada = window.matchMedia?.("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setEstadoPush(esIphone && !instalada ? "iphone_sin_instalar" : "no_soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstadoPush("bloqueado");
      return;
    }
    const registro = await navigator.serviceWorker.getRegistration();
    const sub = await registro?.pushManager.getSubscription();
    pushActivo.current = Boolean(sub);
    setEstadoPush(sub ? "activo" : "inactivo");
  }, []);

  useEffect(() => {
    if (abierto) revisarPush();
  }, [abierto, revisarPush]);

  useEffect(() => {
    revisarPush();
  }, [revisarPush]);

  async function activarPush() {
    if (!clavePush) return;
    const permiso = await Notification.requestPermission();
    setPermisoLocal(permiso);
    if (permiso !== "granted") {
      setEstadoPush(permiso === "denied" ? "bloqueado" : "inactivo");
      return;
    }
    const registro = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
    await navigator.serviceWorker.ready;
    const sub = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlABytes(clavePush) as BufferSource,
    });
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) {
      await sub.unsubscribe();
      setEstadoPush("inactivo");
      return;
    }
    pushActivo.current = true;
    setEstadoPush("activo");
  }

  async function desactivarPush() {
    const registro = await navigator.serviceWorker.getRegistration();
    const sub = await registro?.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    pushActivo.current = false;
    setEstadoPush("inactivo");
  }

  async function pedirPermisoLocal() {
    if (!("Notification" in window)) return;
    setPermisoLocal(await Notification.requestPermission());
  }

  async function atender(cuerpo: { ids?: string[]; ordenId?: string; todos?: boolean }) {
    const quitar = (a: Aviso) =>
      cuerpo.todos || (cuerpo.ordenId ? a.ordenId === cuerpo.ordenId : cuerpo.ids?.includes(a.id));
    setAvisos((prev) => prev.filter((a) => !quitar(a)));
    await fetch("/api/avisos/atender", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    }).catch(() => {});
  }

  if (!disponible) return null;

  const cantidad = avisos.length;
  const grupos = agrupar(avisos);
  const entraAlTaller = puedeEntrarA(rol, "taller");

  return (
    <>
      <button
        type="button"
        className="btn btn-oscuro bs-avisos"
        onClick={() => setAbierto(true)}
        title={cantidad ? `${cantidad} aviso${cantidad === 1 ? "" : "s"} de clientes` : "Avisos de clientes"}
        aria-label={cantidad ? `${cantidad} avisos de clientes sin atender` : "Avisos de clientes"}
        style={{ position: "relative" }}
      >
        {cantidad ? <BellRing size={17} strokeWidth={2} /> : <Bell size={17} strokeWidth={2} />}
        {cantidad > 0 && (
          <span
            className="cifra"
            style={{
              position: "absolute",
              top: -6,
              right: -6,
              minWidth: 20,
              height: 20,
              padding: "0 5px",
              borderRadius: 10,
              background: "var(--peligro)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 800,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              border: "2px solid var(--chrome)",
            }}
          >
            {cantidad > 99 ? "99+" : cantidad}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Avisos de clientes"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAbierto(false);
          }}
          style={{ position: "fixed", inset: 0, background: "rgba(11, 11, 12, 0.45)", zIndex: 90, display: "flex", justifyContent: "flex-end" }}
        >
          <div
            style={{
              background: "var(--ground)",
              width: "100%",
              maxWidth: 440,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--sombra-2)",
            }}
          >
            <div className="fila" style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)", background: "var(--surface)", gap: 8, flexWrap: "nowrap" }}>
              <h3 style={{ margin: 0, flex: 1 }}>Avisos de clientes</h3>
              {cantidad > 0 && (
                <Boton variante="fantasma" tamano="sm" onClick={() => atender({ todos: true })}>
                  Marcar todo leído
                </Boton>
              )}
              <Boton variante="fantasma" tamano="sm" icono={<X size={18} strokeWidth={2} />} aria-label="Cerrar" onClick={() => setAbierto(false)} />
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              {grupos.length === 0 ? (
                <p style={{ margin: "24px 0", textAlign: "center", fontSize: 14, color: "var(--ink-3)" }}>
                  No hay mensajes ni aprobaciones pendientes.
                </p>
              ) : (
                grupos.map((g) => (
                  <TarjetaGrupo
                    key={g.ordenId}
                    grupo={g}
                    entraAlTaller={entraAlTaller}
                    onAtender={() => atender({ ordenId: g.ordenId })}
                    onIr={() => setAbierto(false)}
                  />
                ))
              )}
            </div>

            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--rule)", background: "var(--surface)", fontSize: 13, color: "var(--ink-2)" }}>
              <PieNotificaciones
                clavePush={clavePush}
                estadoPush={estadoPush}
                permisoLocal={permisoLocal}
                onActivarPush={() => activarPush().catch(() => setEstadoPush("inactivo"))}
                onDesactivarPush={() => desactivarPush().catch(() => {})}
                onPermisoLocal={pedirPermisoLocal}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function TarjetaGrupo({
  grupo,
  entraAlTaller,
  onAtender,
  onIr,
}: {
  grupo: GrupoOrden;
  entraAlTaller: boolean;
  onAtender: () => void;
  onIr: () => void;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hayMensajes = grupo.avisos.some((a) => a.tipo === "mensaje");

  async function responder() {
    const texto = respuesta.trim();
    if (!texto) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${grupo.ordenId}/mensajes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
      });
      if (!res.ok) {
        setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "No se pudo enviar");
        return;
      }
      setRespuesta("");
      onAtender();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="tarjeta" style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div className="fila" style={{ gap: 8, flexWrap: "nowrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="cifra" style={{ fontWeight: 800, fontSize: 14 }}>
            {grupo.numero != null ? `Orden #${grupo.numero}` : "Orden"}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {grupo.cliente ?? "Cliente"}
          </div>
        </div>
        {entraAlTaller && (
          <Link
            href={`/orden/${grupo.ordenId}#mensajes`}
            onClick={onIr}
            className="btn btn-contorno btn-sm"
            title="Abrir la orden"
          >
            <ExternalLink size={14} strokeWidth={2} />
            Ver orden
          </Link>
        )}
      </div>

      {grupo.avisos.map((a) => (
        <div key={a.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <span style={{ marginTop: 2, flexShrink: 0 }}>
            <IconoAviso tipo={a.tipo} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            {a.tipo !== "mensaje" && <div style={{ fontSize: 12, fontWeight: 700 }}>{ETIQUETA_AVISO[a.tipo]}</div>}
            <div
              style={{
                fontSize: 14,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                ...(a.tipo === "mensaje"
                  ? { background: "var(--surface-2)", padding: "6px 10px", borderRadius: "var(--r-md)" }
                  : {}),
              }}
            >
              {a.texto}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{haceCuanto(a.creadoEn)}</div>
          </div>
        </div>
      ))}

      {hayMensajes && (
        <form
          className="fila"
          style={{ gap: 6, flexWrap: "nowrap" }}
          onSubmit={(e) => {
            e.preventDefault();
            responder();
          }}
        >
          <input
            value={respuesta}
            onChange={(e) => setRespuesta(e.target.value)}
            placeholder="Responder al cliente…"
            aria-label="Respuesta al cliente"
            disabled={enviando}
          />
          <Boton type="submit" variante="primario" icono={<Send size={16} strokeWidth={2} />} disabled={enviando || !respuesta.trim()} aria-label="Enviar respuesta" />
        </form>
      )}
      {error && <div style={{ fontSize: 12, color: "var(--peligro)" }}>{error}</div>}

      <div>
        <Boton variante="fantasma" tamano="sm" icono={<CheckCircle2 size={14} strokeWidth={2} />} onClick={onAtender}>
          {hayMensajes ? "Marcar leído sin responder" : "Entendido"}
        </Boton>
      </div>
    </div>
  );
}

function PieNotificaciones({
  clavePush,
  estadoPush,
  permisoLocal,
  onActivarPush,
  onDesactivarPush,
  onPermisoLocal,
}: {
  clavePush: string | null;
  estadoPush: EstadoPush;
  permisoLocal: NotificationPermission | "no_soportado";
  onActivarPush: () => void;
  onDesactivarPush: () => void;
  onPermisoLocal: () => void;
}) {
  if (estadoPush === "cargando") return null;
  if (estadoPush === "iphone_sin_instalar") {
    return <span>En iPhone, para recibir notificaciones primero agrega la app a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.</span>;
  }
  if (estadoPush === "bloqueado") {
    return <span>Las notificaciones están bloqueadas en este navegador. Actívalas en los permisos del sitio para recibir avisos.</span>;
  }

  // Sin llaves VAPID en el servidor no hay push; queda la notificación
  // mientras la app está abierta (aunque sea en otra pestaña).
  if (!clavePush || estadoPush === "no_soportado") {
    if (permisoLocal === "granted") return <span>Este equipo te avisa con sonido y notificación mientras la app esté abierta.</span>;
    if (permisoLocal === "no_soportado") return <span>Este navegador avisa con sonido mientras la app esté abierta.</span>;
    return (
      <div className="fila" style={{ gap: 8 }}>
        <span style={{ flex: 1 }}>Avisar con notificación mientras la app esté abierta.</span>
        <Boton variante="contorno" tamano="sm" icono={<BellRing size={14} strokeWidth={2} />} onClick={onPermisoLocal}>
          Activar
        </Boton>
      </div>
    );
  }

  if (estadoPush === "activo") {
    return (
      <div className="fila" style={{ gap: 8 }}>
        <span style={{ flex: 1 }}>Este equipo recibe notificaciones aunque la app esté cerrada.</span>
        <Boton variante="fantasma" tamano="sm" onClick={onDesactivarPush}>
          Desactivar
        </Boton>
      </div>
    );
  }
  return (
    <div className="fila" style={{ gap: 8 }}>
      <span style={{ flex: 1 }}>Recibe un aviso en este celular o PC cuando un cliente escriba o apruebe.</span>
      <Boton variante="primario" tamano="sm" icono={<BellRing size={14} strokeWidth={2} />} onClick={onActivarPush}>
        Activar notificaciones
      </Boton>
    </div>
  );
}
