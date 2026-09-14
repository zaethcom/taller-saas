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
import { Check, X, Clock } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";

interface Seguimiento {
  numero: number;
  estado: string;
  etiquetaEstado: string;
  motivo: string;
  abiertaEn: string;
  producto: { serial: string; tipo: string; marca: string | null; modelo: string | null };
  historial: { estado: string; etiqueta: string; fecha: string }[];
  cotizacion: {
    total: number;
    estado: string;
    decision: string | null;
    cotizacion_item: { descripcion: string; cantidad: number; precio_unit: number }[];
  } | null;
  evidencias: { tipo: "foto" | "video"; tomadaEn: string; url: string | null }[];
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaSeguimiento() {
  const { token } = useParams<{ token: string }>();
  const [datos, setDatos] = useState<Seguimiento | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

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
        </div>

        <Tarjeta style={{ background: "var(--accent-suave)", borderColor: "var(--accent-linea)" }}>
          <div className="campo-etiqueta" style={{ color: "var(--ink-2)" }}>
            Estado actual
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.015em" }}>{datos.etiquetaEstado}</div>
        </Tarjeta>

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

        {datos.evidencias.length > 0 && (
          <section>
            <h2 style={{ marginBottom: 12 }}>Fotos</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {datos.evidencias.map((ev, i) =>
                ev.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={i}
                    src={ev.url}
                    alt="Evidencia del equipo"
                    style={{ width: "100%", borderRadius: "var(--r-md)", border: "1px solid var(--rule)", display: "block" }}
                  />
                ) : null,
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
