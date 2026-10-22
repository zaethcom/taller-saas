"use client";

/**
 * La cotización, construida desde el catálogo (repuestos, servicios,
 * mano de obra) en vez de líneas 100% de texto libre -- así los
 * repuestos cotizados quedan ligados al catálogo real, y el técnico no
 * tiene que escribir todo a mano. Se permite además una línea de texto
 * libre para un cargo puntual que no amerita catálogo (decisión tomada
 * con el usuario) -- esa línea no descuenta inventario ni genera
 * movimiento de auditoría, solo suma al total.
 *
 * Lo que la orden ya tiene acordado (el "valor del servicio" que se puso
 * al recibir, o lo ya registrado en la orden) entra a la cotización
 * desde el principio y no se edita: el cliente ve el total completo, y
 * lo acordado no se cobra dos veces (la cuenta toma lo mayor entre lo
 * usado y lo cotizado, lib/cuenta-orden.ts). Lo que se agregó por error
 * sí se quita antes de enviar: la X lo borra de la orden (DELETE
 * /api/ordenes/[id]/items), y un repuesto consumido vuelve a la sede.
 *
 * Llega desde /diagnostico ("Continuar a cotización"); al enviar,
 * POST /api/ordenes/[id]/cotizacion mueve la orden a
 * esperando_aprobacion, igual que antes.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Plus, X, Send, Copy, Check, ArrowLeft, Search } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { CabeceraOrden } from "@/componentes/taller/cabecera-orden";
import { BotonWhatsappOrden } from "@/componentes/taller/boton-whatsapp-orden";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { ETIQUETA_ESTADO, puedeTransicionar, type Estado } from "@/lib/estados";
import { VentanaError } from "@/componentes/ui/ventana-error";

type Origen = "repuesto" | "servicio" | "mano_obra" | "libre" | "acordado";

interface Item {
  origen: Origen;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  repuestoId?: string;
  servicioId?: string;
  manoObraId?: string;
  /** Solo en las líneas "acordado": el orden_item que la respalda. */
  ordenItemId?: string;
}

interface ResultadoCatalogo {
  id: string;
  descripcion?: string;
  nombre?: string;
  precioVenta?: number;
  precio?: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const ETIQUETA_ORIGEN: Record<Origen, string> = {
  repuesto: "Repuesto",
  servicio: "Servicio",
  mano_obra: "Mano de obra",
  libre: "Otro",
  acordado: "Acordado",
};

function BuscadorCatalogo({
  titulo,
  endpoint,
  onAgregar,
}: {
  titulo: string;
  endpoint: string;
  onAgregar: (r: ResultadoCatalogo) => void;
}) {
  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<ResultadoCatalogo[]>([]);

  useEffect(() => {
    const texto = buscar.trim();
    if (!texto) {
      setResultados([]);
      return;
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => {
      fetch(`${endpoint}?buscar=${encodeURIComponent(texto)}`, { signal: controlador.signal })
        .then((r) => r.json())
        .then((data) => setResultados(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [buscar, endpoint]);

  return (
    <div className="pila" style={{ gap: 8 }}>
      <Campo etiqueta={titulo}>
        <input
          placeholder="Buscar…"
          value={buscar}
          onChange={(e) => setBuscar(e.target.value)}
          className={endpoint.includes("repuestos") ? "cifra" : undefined}
        />
      </Campo>
      {resultados.length > 0 && (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
          {resultados.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  onAgregar(r);
                  setBuscar("");
                  setResultados([]);
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "9px 12px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--rule)",
                  fontSize: 13,
                }}
              >
                <span style={{ fontWeight: 700 }}>{r.descripcion ?? r.nombre}</span>{" "}
                <span className="cifra" style={{ color: "var(--ink-3)" }}>
                  · {fmt(r.precioVenta ?? r.precio ?? 0)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaginaCotizacion() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [items, setItems] = useState<Item[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ total: number; urlSeguimiento: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado | null>(null);
  // Se avisa antes de armar la cotización, no al enviarla. Desde
  // Recibida (o tras un rechazo) se envía igual: la orden pasa sola por
  // diagnóstico (lib/diagnostico-auto.ts).
  const sePuedeEnviar =
    estado === null ||
    estado === "recibida" ||
    estado === "rechazada" ||
    puedeTransicionar(estado, "esperando_aprobacion");

  const total = items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);
  const hayAcordado = items.some((i) => i.origen === "acordado");

  useEffect(() => {
    clienteNavegador()
      .from("orden")
      .select("estado")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setEstado((data?.estado as Estado) ?? null));
  }, [id]);

  // Lo que la orden ya tiene (orden_item) entra fijo, antes que lo nuevo.
  useEffect(() => {
    clienteNavegador()
      .from("orden_item")
      .select("id, descripcion, cantidad, precio_unit")
      .eq("orden_id", id)
      // Un costo agregado que el cliente rechazó (0040) no es acordado.
      .or("decision.is.null,decision.neq.rechazada")
      .order("creado_en", { ascending: true })
      .then(({ data }) => {
        const acordados: Item[] = (data ?? []).map((it) => ({
          origen: "acordado",
          ordenItemId: it.id,
          descripcion: it.descripcion,
          cantidad: it.cantidad,
          precioUnit: Number(it.precio_unit),
        }));
        if (acordados.length) setItems((prev) => [...acordados, ...prev.filter((p) => p.origen !== "acordado")]);
      });
  }, [id]);

  function agregar(item: Item) {
    setItems((prev) => [...prev, item]);
  }

  function actualizar(i: number, cambios: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...cambios } : it)));
  }

  function quitar(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }

  // Lo acordado ya está guardado en la orden: quitarlo es borrarlo allí.
  async function quitarAcordado(ordenItemId: string) {
    setQuitando(ordenItemId);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/items?item=${encodeURIComponent(ordenItemId)}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setItems((prev) => prev.filter((it) => it.ordenItemId !== ordenItemId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar la línea");
    } finally {
      setQuitando(null);
    }
  }

  async function enviar() {
    if (items.length === 0) {
      setError("Agrega al menos un repuesto, servicio, mano de obra o línea.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/cotizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({
            descripcion: i.descripcion,
            cantidad: i.cantidad,
            precioUnit: i.precioUnit,
            repuestoId: i.repuestoId,
            servicioId: i.servicioId,
            manoObraId: i.manoObraId,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setResultado({ total: data.total, urlSeguimiento: data.urlSeguimiento });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la cotización");
    } finally {
      setEnviando(false);
    }
  }

  async function copiarEnlace() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.urlSeguimiento);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (resultado) {
    return (
      <div className="pila">
        <Tarjeta style={{ textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 54,
              height: 54,
              borderRadius: "var(--r-lg)",
              background: "var(--ok-fondo)",
              color: "var(--ok)",
              marginBottom: 12,
            }}
          >
            <Check size={28} strokeWidth={2.4} />
          </span>
          <h1>Cotización enviada</h1>
          <p className="cifra" style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {fmt(resultado.total)}
          </p>
        </Tarjeta>

        <Tarjeta>
          <div className="campo-etiqueta">
            Comparte este enlace con el cliente para que apruebe o rechace desde su celular
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--rule)",
              wordBreak: "break-all",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {resultado.urlSeguimiento}
          </div>
          <div className="fila">
            <Boton
              variante="primario"
              icono={copiado ? <Check size={17} strokeWidth={2.4} /> : <Copy size={17} strokeWidth={2} />}
              onClick={copiarEnlace}
            >
              {copiado ? "¡Copiado!" : "Copiar enlace"}
            </Boton>
            <BotonWhatsappOrden ordenId={id} tamano="md" variante="contorno" />
            <Boton
              variante="contorno"
              icono={<ArrowLeft size={17} strokeWidth={2} />}
              onClick={() => router.push(`/orden/${id}`)}
            >
              Volver a la orden
            </Boton>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div>
      <CabeceraOrden ordenId={id} anterior={{ href: `/orden/${id}/diagnostico`, etiqueta: "Diagnóstico" }} />

      <TituloPantalla
        titulo="Cotización"
      />

      <div className="pila">
        {!sePuedeEnviar && estado && (
          <Aviso tono="aviso">
            La orden está en &quot;{ETIQUETA_ESTADO[estado]}&quot;: la cotización ya se envió, desde aquí no se envía otra.
          </Aviso>
        )}
        <Tarjeta>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            <BuscadorCatalogo
              titulo="Buscar repuesto"
              endpoint="/api/repuestos"
              onAgregar={(r) =>
                agregar({
                  origen: "repuesto",
                  descripcion: r.descripcion ?? "",
                  cantidad: 1,
                  precioUnit: r.precioVenta ?? 0,
                  repuestoId: r.id,
                })
              }
            />
            <BuscadorCatalogo
              titulo="Buscar servicio"
              endpoint="/api/servicios"
              onAgregar={(r) =>
                agregar({
                  origen: "servicio",
                  descripcion: r.nombre ?? "",
                  cantidad: 1,
                  precioUnit: r.precio ?? 0,
                  servicioId: r.id,
                })
              }
            />
            <BuscadorCatalogo
              titulo="Buscar mano de obra"
              endpoint="/api/mano-obra"
              onAgregar={(r) =>
                agregar({
                  origen: "mano_obra",
                  descripcion: r.nombre ?? "",
                  cantidad: 1,
                  precioUnit: r.precio ?? 0,
                  manoObraId: r.id,
                })
              }
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Boton
              variante="fantasma"
              icono={<Plus size={17} strokeWidth={2.2} />}
              onClick={() => agregar({ origen: "libre", descripcion: "", cantidad: 1, precioUnit: 0 })}
            >
              Agregar línea libre
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Ítems de la cotización</h2>
          {items.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
              <Search size={15} strokeWidth={2} /> Busca arriba o agrega una línea libre.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {items.map((it, i) => {
                const acordado = it.origen === "acordado";
                return (
                  <div
                    key={i}
                    style={{
                      padding: "12px 0",
                      borderTop: i === 0 ? "none" : "1px solid var(--rule)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    {/* Arriba qué es; abajo cuánto. La X siempre a la derecha, dentro de la tarjeta. */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="campo-etiqueta" style={{ marginBottom: 2 }}>
                          {ETIQUETA_ORIGEN[it.origen]}
                        </div>
                        {it.origen === "libre" ? (
                          <input
                            placeholder="Descripción"
                            value={it.descripcion}
                            onChange={(e) => actualizar(i, { descripcion: e.target.value })}
                            aria-label={`Descripción de la línea ${i + 1}`}
                          />
                        ) : (
                          <div style={{ fontSize: 15, fontWeight: 700, overflowWrap: "anywhere" }}>{it.descripcion}</div>
                        )}
                      </div>
                      <Boton
                        variante="peligro"
                        tamano="sm"
                        icono={<X size={16} strokeWidth={2.4} />}
                        onClick={() => (acordado ? it.ordenItemId && quitarAcordado(it.ordenItemId) : quitar(i))}
                        disabled={acordado && quitando !== null}
                        aria-label={acordado ? `Quitar ${it.descripcion} de la orden` : `Quitar la línea ${i + 1}`}
                      />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                      {acordado ? (
                        <span className="cifra" style={{ color: "var(--ink-2)" }}>
                          {it.cantidad} × {fmt(it.precioUnit)}
                        </span>
                      ) : (
                        <>
                          <input
                            type="number"
                            min={1}
                            value={it.cantidad}
                            onChange={(e) => actualizar(i, { cantidad: Number(e.target.value) || 1 })}
                            aria-label={`Cantidad de la línea ${i + 1}`}
                            className="cifra"
                            style={{ width: 64, flex: "none", textAlign: "center" }}
                          />
                          <span style={{ color: "var(--ink-3)" }}>×</span>
                          <input
                            type="number"
                            min={0}
                            placeholder="Precio"
                            value={it.precioUnit || ""}
                            onChange={(e) => actualizar(i, { precioUnit: Number(e.target.value) || 0 })}
                            aria-label={`Precio de la línea ${i + 1}`}
                            className="cifra"
                            style={{ flex: "1 1 0", minWidth: 0, maxWidth: 160, textAlign: "right" }}
                          />
                        </>
                      )}
                      <span className="cifra" style={{ marginLeft: "auto", fontWeight: 800, whiteSpace: "nowrap" }}>
                        {fmt(it.cantidad * it.precioUnit)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Tarjeta>

        {hayAcordado && (
          <Aviso tono="info">
            Las líneas &quot;Acordado&quot; ya estaban en la orden (el valor que se pactó al recibir, o lo ya registrado).
            Quedan incluidas en el total y no se cobran dos veces. Si alguna está por error, la X la quita de la orden
            (un repuesto vuelve al inventario).
          </Aviso>
        )}

        <Tarjeta>
          <div style={{ textAlign: "right" }}>
            <div className="campo-etiqueta">Total</div>
            <div className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
              {fmt(total)}
            </div>
          </div>
        </Tarjeta>

        <Boton
          variante="primario"
          tamano="xl"
          ancho
          icono={<Send size={19} strokeWidth={2} />}
          onClick={enviar}
          disabled={enviando || !sePuedeEnviar}
        >
          {enviando ? "Enviando…" : "Enviar cotización"}
        </Boton>

        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
