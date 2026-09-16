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
 * Llega desde /diagnostico ("Continuar a cotización"); al enviar,
 * POST /api/ordenes/[id]/cotizacion mueve la orden a
 * esperando_aprobacion, igual que antes.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Receipt, Plus, X, Send, Copy, Check, ArrowLeft, Search } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

type Origen = "repuesto" | "servicio" | "mano_obra" | "libre";

interface Item {
  origen: Origen;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
  repuestoId?: string;
  servicioId?: string;
  manoObraId?: string;
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

  const total = items.reduce((s, i) => s + i.cantidad * i.precioUnit, 0);

  function agregar(item: Item) {
    setItems((prev) => [...prev, item]);
  }

  function actualizar(i: number, cambios: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...cambios } : it)));
  }

  function quitar(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
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
      <TituloPantalla
        icono={<Receipt size={24} strokeWidth={2} />}
        titulo="Cotización"
        descripcion="Repuestos, servicios y mano de obra para el cliente."
        acciones={
          <Boton
            variante="fantasma"
            tamano="sm"
            icono={<ArrowLeft size={16} strokeWidth={2} />}
            onClick={() => router.push(`/orden/${id}/diagnostico`)}
          >
            Volver a diagnóstico
          </Boton>
        }
      />

      <div className="pila">
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {items.map((it, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "70px minmax(0,1fr) 64px 100px 44px", gap: 8, alignItems: "center" }}>
                  <span className="cifra" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {ETIQUETA_ORIGEN[it.origen]}
                  </span>
                  {it.origen === "libre" ? (
                    <input
                      placeholder="Descripción"
                      value={it.descripcion}
                      onChange={(e) => actualizar(i, { descripcion: e.target.value })}
                      aria-label={`Descripción de la línea ${i + 1}`}
                    />
                  ) : (
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{it.descripcion}</span>
                  )}
                  <input
                    type="number"
                    min={1}
                    value={it.cantidad}
                    onChange={(e) => actualizar(i, { cantidad: Number(e.target.value) || 1 })}
                    aria-label={`Cantidad de la línea ${i + 1}`}
                    className="cifra"
                    style={{ textAlign: "center" }}
                  />
                  <input
                    type="number"
                    min={0}
                    value={it.precioUnit || ""}
                    onChange={(e) => actualizar(i, { precioUnit: Number(e.target.value) || 0 })}
                    aria-label={`Precio de la línea ${i + 1}`}
                    className="cifra"
                    style={{ textAlign: "right" }}
                  />
                  <Boton
                    variante="peligro"
                    icono={<X size={16} strokeWidth={2.4} />}
                    onClick={() => quitar(i)}
                    aria-label={`Quitar la línea ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

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
          disabled={enviando}
        >
          {enviando ? "Enviando…" : "Enviar cotización"}
        </Boton>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
