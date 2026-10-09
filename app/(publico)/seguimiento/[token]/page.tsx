"use client";

/**
 * Lo que ve el cliente con su enlace: en qué va su equipo, cuánto
 * cuesta arreglarlo y las fotos que el taller decidió mostrarle -- la
 * segunda de las dos promesas del proyecto.
 *
 * Es la única pantalla que ve alguien de afuera, así que no muestra
 * nada interno (ni técnico, ni costos, ni notas de diagnóstico) y no
 * pide cuenta. El par Aprobar/Rechazar es la única decisión que puede
 * tomar, y desaparece en cuanto la toma.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Check, X, Clock, Stethoscope } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";
import { HiloMensajes, type Mensaje } from "@/componentes/mensajeria/hilo-mensajes";

interface Diagnostico {
  hallazgos: string | null;
  fallas: string | null;
  observaciones: string | null;
  recomendaciones: string | null;
}

interface Seguimiento {
  numero: number;
  estado: string;
  etiquetaEstado: string;
  motivo: string;
  abiertaEn: string;
  empresaNombre: string;
  logoUrl: string | null;
  colorPrincipal: string | null;
  diagnostico: Diagnostico | null;
  producto: { serial: string; tipo: string; marca: string | null; modelo: string | null };
  historial: { estado: string; etiqueta: string; fecha: string }[];
  cotizacion: {
    total: number;
    estado: string;
    decision: string | null;
    cotizacion_item: { descripcion: string; cantidad: number; precio_unit: number }[];
  } | null;
  evidencias: { tipo: "foto" | "video"; tomadaEn: string; url: string | null }[];
  itemsPendientes: { id: string; descripcion: string; cantidad: number; precioUnit: number; decision: string | null }[];
  mensajes: Mensaje[];
}

/** El diagnóstico es texto libre en cuatro campos opcionales --
 *  solo vale la pena mostrar la sección si alguno quedó lleno. */
function tieneDiagnostico(d: Diagnostico | null): d is Diagnostico {
  return !!d && [d.hallazgos, d.fallas, d.observaciones, d.recomendaciones].some((v) => v?.trim());
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaSeguimiento() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [decidiendoItem, setDecidiendoItem] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/seguimiento/${token}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "No se pudo cargar");
        return r.json();
      })
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, [token]);

  async function decidir(decision: "aprobada" | "rechazada") {
    setEnviando(true);
    try {
      const res = await fetch("/api/aprobacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      // Recargar para reflejar el nuevo estado.
      const actualizado = await fetch(`/api/seguimiento/${token}`).then((r) => r.json());
      setDatos(actualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la decisión");
    } finally {
      setEnviando(false);
    }
  }

  async function decidirItem(itemId: string, decision: "aprobada" | "rechazada") {
    setDecidiendoItem(itemId);
    try {
      const res = await fetch(`/api/seguimiento/${token}/items/aprobar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, itemId, decision }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const actualizado = await fetch(`/api/seguimiento/${token}`).then((r) => r.json());
      setDatos(actualizado);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la decisión");
    } finally {
      setDecidiendoItem(null);
    }
  }

  async function enviarMensaje(texto: string) {
    const res = await fetch(`/api/seguimiento/${token}/mensajes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texto }),
    });
    if (!res.ok) throw new Error((await res.json()).error);
    const actualizado = await fetch(`/api/seguimiento/${token}`).then((r) => r.json());
    setDatos(actualizado);
  }

  if (error) {
    return (
      <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
        <Aviso tono="peligro">{error}</Aviso>
      </main>
    );
  }

  if (!datos) {
    return (
      <main style={{ padding: 24, maxWidth: 520, margin: "0 auto" }}>
        <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>
      </main>
    );
  }

  const puedeDecidir =
    datos.cotizacion && datos.cotizacion.estado === "enviada" && !datos.cotizacion.decision;

  return (
    <main style={{ padding: "28px 20px 48px", maxWidth: 520, margin: "0 auto" }}>
      <div className="pila">
        {(datos.logoUrl || datos.empresaNombre) && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {datos.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={datos.logoUrl}
                alt={datos.empresaNombre}
                style={{ height: 40, width: 40, objectFit: "contain", borderRadius: "var(--r-md)", background: "var(--surface-2)" }}
              />
            )}
            {datos.empresaNombre && <span style={{ fontSize: 15, fontWeight: 800 }}>{datos.empresaNombre}</span>}
          </div>
        )}

        <div>
          <div className="cifra" style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            Orden #{datos.numero}
          </div>
          <h1 style={{ marginTop: 4 }}>
            {datos.producto.marca} {datos.producto.modelo}
          </h1>
          <p className="cifra" style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            {datos.producto.tipo} · {datos.producto.serial}
          </p>
          {datos.motivo && (
            <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              <span style={{ color: "var(--ink-3)" }}>Motivo reportado · </span>
              {datos.motivo}
            </p>
          )}
        </div>

        <Tarjeta style={{ background: "var(--accent-suave)", borderColor: "var(--accent-linea)" }}>
          <div className="campo-etiqueta" style={{ color: "var(--ink-2)" }}>
            Estado actual
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em" }}>{datos.etiquetaEstado}</div>
        </Tarjeta>

        {tieneDiagnostico(datos.diagnostico) && (
          <section>
            <h2 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              <Stethoscope size={18} strokeWidth={2} color="var(--ink-2)" aria-hidden />
              Diagnóstico
            </h2>
            <Tarjeta style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {datos.diagnostico.hallazgos && (
                <div>
                  <div className="campo-etiqueta">Hallazgos</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{datos.diagnostico.hallazgos}</p>
                </div>
              )}
              {datos.diagnostico.fallas && (
                <div>
                  <div className="campo-etiqueta">Fallas encontradas</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{datos.diagnostico.fallas}</p>
                </div>
              )}
              {datos.diagnostico.recomendaciones && (
                <div>
                  <div className="campo-etiqueta">Recomendaciones</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{datos.diagnostico.recomendaciones}</p>
                </div>
              )}
              {datos.diagnostico.observaciones && (
                <div>
                  <div className="campo-etiqueta">Observaciones</div>
                  <p style={{ margin: 0, fontSize: 14 }}>{datos.diagnostico.observaciones}</p>
                </div>
              )}
            </Tarjeta>
          </section>
        )}

        <section>
          <h2 style={{ marginBottom: 12 }}>Historial</h2>
          <Tarjeta>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {datos.historial.map((h, i) => (
                <li key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: i === 0 ? "var(--accent)" : "var(--surface-2)",
                      color: i === 0 ? "var(--accent-texto)" : "var(--ink-3)",
                      flexShrink: 0,
                    }}
                  >
                    {i === 0 ? <Clock size={14} strokeWidth={2.4} /> : <Check size={14} strokeWidth={2.6} />}
                  </span>
                  <span>
                    <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>{h.etiqueta}</span>
                    <span className="cifra" style={{ display: "block", fontSize: 12, color: "var(--ink-3)" }}>
                      {new Date(h.fecha).toLocaleString("es-CO")}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </section>

        {datos.cotizacion && (
          <section>
            <h2 style={{ marginBottom: 12 }}>Cotización</h2>
            <Tarjeta relleno={false}>
              <div style={{ padding: "14px 16px" }}>
                {datos.cotizacion.cotizacion_item.map((it, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "9px 0",
                      borderBottom: "1px solid var(--rule)",
                      fontSize: 14,
                    }}
                  >
                    <span>
                      <span className="cifra" style={{ color: "var(--ink-3)" }}>
                        {it.cantidad}×
                      </span>{" "}
                      {it.descripcion}
                    </span>
                    <span className="cifra" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {fmt(it.cantidad * it.precio_unit)}
                    </span>
                  </div>
                ))}
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", paddingTop: 14 }}>
                  <span style={{ fontSize: 18, fontWeight: 800 }}>Total</span>
                  <span className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
                    {fmt(datos.cotizacion.total)}
                  </span>
                </div>
              </div>

              {puedeDecidir && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 16px 16px" }}>
                  <Boton
                    variante="primario"
                    tamano="lg"
                    icono={<Check size={19} strokeWidth={2.4} />}
                    disabled={enviando}
                    onClick={() => decidir("aprobada")}
                  >
                    Aprobar
                  </Boton>
                  <Boton
                    variante="contorno"
                    tamano="lg"
                    icono={<X size={19} strokeWidth={2.4} />}
                    disabled={enviando}
                    onClick={() => decidir("rechazada")}
                  >
                    Rechazar
                  </Boton>
                </div>
              )}

              {datos.cotizacion.decision && (
                <div style={{ padding: "0 16px 16px" }}>
                  <Etiqueta tono={datos.cotizacion.decision === "aprobada" ? "ok" : "neutro"} punto>
                    {datos.cotizacion.decision === "aprobada" ? "Aprobada por ti" : "Rechazada por ti"}
                  </Etiqueta>
                </div>
              )}
            </Tarjeta>
          </section>
        )}

        {datos.itemsPendientes.length > 0 && (
          <section>
            <h2 style={{ marginBottom: 12 }}>Costos adicionales</h2>
            <Tarjeta relleno={false}>
              {datos.itemsPendientes.map((it) => (
                <div key={it.id} style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14, marginBottom: 10 }}>
                    <span>
                      <span className="cifra" style={{ color: "var(--ink-3)" }}>
                        {it.cantidad}×
                      </span>{" "}
                      {it.descripcion}
                    </span>
                    <span className="cifra" style={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                      {fmt(it.cantidad * it.precioUnit)}
                    </span>
                  </div>
                  {it.decision ? (
                    <Etiqueta tono={it.decision === "aprobada" ? "ok" : "neutro"} punto>
                      {it.decision === "aprobada" ? "Aprobado por ti" : "Rechazado por ti"}
                    </Etiqueta>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <Boton
                        variante="primario"
                        tamano="sm"
                        icono={<Check size={15} strokeWidth={2.4} />}
                        disabled={decidiendoItem === it.id}
                        onClick={() => decidirItem(it.id, "aprobada")}
                      >
                        Aprobar
                      </Boton>
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        icono={<X size={15} strokeWidth={2.4} />}
                        disabled={decidiendoItem === it.id}
                        onClick={() => decidirItem(it.id, "rechazada")}
                      >
                        Rechazar
                      </Boton>
                    </div>
                  )}
                </div>
              ))}
            </Tarjeta>
            <p className="campo-ayuda" style={{ marginTop: 8 }}>
              Se agregaron después de que aprobaste la cotización original -- por eso se piden aparte.
            </p>
          </section>
        )}

        {datos.evidencias.length > 0 && (
          <section>
            <h2 style={{ marginBottom: 12 }}>Fotos y videos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {datos.evidencias.map((ev, i) => {
                if (!ev.url) return null;
                const estilo: React.CSSProperties = {
                  width: "100%",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--rule)",
                  display: "block",
                  // Un video pesa mucho más que una foto: sin esto el navegador
                  // precarga los datos de cada clip apenas entra a la pantalla,
                  // aunque el cliente nunca llegue a reproducirlo.
                  aspectRatio: "1",
                  objectFit: "cover",
                };
                return ev.tipo === "video" ? (
                  <video key={i} src={ev.url} controls preload="none" style={estilo} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={ev.url} alt="Evidencia del equipo" style={estilo} />
                );
              })}
            </div>
          </section>
        )}

        <section>
          <h2 style={{ marginBottom: 12 }}>Mensajes</h2>
          <HiloMensajes mensajes={datos.mensajes} ladoPropio="cliente" onEnviar={enviarMensaje} />
        </section>
      </div>
    </main>
  );
}
