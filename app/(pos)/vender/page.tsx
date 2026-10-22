"use client";

/**
 * Venta de mostrador. Dos maneras de agregar algo al carrito: un
 * repuesto/accesorio a granel (con cantidad) o un artículo
 * individualizado -- patineta, teléfono -- que se vende de a una unidad
 * y, al confirmar, queda 'vendido' para siempre (no una cantidad que
 * baja, una unidad concreta que sale del inventario).
 *
 * La pantalla es de dos columnas: catálogo a la izquierda, carrito
 * fijo a la derecha -- quien cobra necesita ver el total sin desplazar
 * nada. Bajo 1000px se apilan y el carrito queda arriba, que es donde
 * mira quien usa una tablet.
 *
 * Los dos catálogos siguen separados a propósito: un repuesto se vende
 * por cantidad y un artículo por unidad, y mezclarlos en una sola
 * rejilla obligaría a explicar esa diferencia en cada tarjeta. Pero
 * comparten una sola barra (Repuestos | Equipos, buscador y categoría)
 * para que la pantalla no repita dos veces los mismos controles. Tocar
 * la tarjeta agrega el producto; no hay un botón "Agregar" aparte.
 *
 * Al lado de la lupa hay un botón que abre la cámara y lee el código
 * de barras (o QR) de la etiqueta. Lo leído, igual que un código exacto
 * escrito a mano o tecleado por un lector USB seguido de Enter, va
 * directo al carrito; si no coincide exacto con ningún código, queda
 * como búsqueda normal.
 */
import { useEffect, useState } from "react";
import { Trash2, Plus, Minus, Search, ShoppingCart, Lock, Check, Printer, PlusCircle, ScanBarcode } from "lucide-react";
import { FotoProducto } from "@/componentes/ui/foto-producto";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { PanelCobro } from "@/componentes/cobro/panel-cobro";
import { useTurnoAbierto, AvisoTurnoCerrado } from "@/componentes/caja/aviso-turno";
import { LectorCodigoBarras } from "@/componentes/lector-codigos/lector-codigo-barras";

interface LineaRepuesto {
  kind: "repuesto";
  repuestoId: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

interface LineaArticulo {
  kind: "articulo";
  articuloId: string;
  codigo: string;
  descripcion: string;
  precioUnit: number;
}

type Linea = LineaRepuesto | LineaArticulo;

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  precioVenta: number;
  imagenUrl: string | null;
  existenciaAqui: number;
}

interface Articulo {
  id: string;
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  precio_venta: number;
  imagen_url: string | null;
}

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
}

interface Categoria {
  id: string;
  nombre: string;
}

/** Lo que imprimen las etiquetas (Code 128) y lo que traen los productos de fábrica. */
const FORMATOS_ESCANEO = ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"];

const mismoCodigo = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaVender() {
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [imprimir, setImprimir] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const [ventaResultado, setVentaResultado] = useState<{ id: string; numero: number } | null>(null);
  const turnoAbierto = useTurnoAbierto();

  const [buscarRepuesto, setBuscarRepuesto] = useState("");
  const [resultadosRepuesto, setResultadosRepuesto] = useState<Repuesto[]>([]);
  const [buscarArticulo, setBuscarArticulo] = useState("");
  const [resultadosArticulo, setResultadosArticulo] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [vista, setVista] = useState<Linea["kind"]>("repuesto");
  const [escaneando, setEscaneando] = useState(false);
  const [avisoCodigo, setAvisoCodigo] = useState<{ texto: string; fallo: boolean } | null>(null);

  const total = carrito.reduce((s, l) => s + (l.kind === "repuesto" ? l.cantidad : 1) * l.precioUnit, 0);
  const unidades = carrito.reduce((s, l) => s + (l.kind === "repuesto" ? l.cantidad : 1), 0);
  const metodo = metodos.find((m) => m.id === metodoPagoId);
  const cambio = montoRecibido - total;

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

  useEffect(() => {
    setMontoRecibido(0);
  }, [metodoPagoId]);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    buscarRepuestos();
    buscarArticulos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaId]);

  function conCategoria(url: string) {
    return categoriaId ? `${url}&categoriaId=${categoriaId}` : url;
  }

  async function buscarRepuestos(texto = buscarRepuesto): Promise<Repuesto[]> {
    const res = await fetch(conCategoria(`/api/repuestos?venta=1&buscar=${encodeURIComponent(texto)}`));
    const data = await res.json();
    const lista: Repuesto[] = res.ok && Array.isArray(data) ? data : [];
    setResultadosRepuesto(lista);
    return lista;
  }

  async function buscarArticulos(texto = buscarArticulo): Promise<Articulo[]> {
    const res = await fetch(
      conCategoria(`/api/inventario/articulos?disponibles=1&buscar=${encodeURIComponent(texto)}`),
    );
    const data = await res.json();
    const lista: Articulo[] = res.ok && Array.isArray(data) ? data : [];
    setResultadosArticulo(lista);
    return lista;
  }

  /**
   * Busca el texto como de costumbre y, si alguno de los resultados
   * tiene exactamente ese código, lo agrega al carrito y limpia el
   * campo -- así un lector USB (que teclea el código y Enter) o la
   * cámara cobran de una vez. Si no hay coincidencia exacta, la
   * búsqueda queda en pantalla para elegir a mano.
   */
  async function buscarOAgregar(kind: Linea["kind"], texto: string, desdeCamara = false) {
    const codigo = texto.trim();
    setAvisoCodigo(null);
    if (kind === "repuesto") {
      setBuscarRepuesto(codigo);
      const exacto = codigo ? (await buscarRepuestos(codigo)).find((r) => mismoCodigo(r.codigo, codigo)) : undefined;
      if (exacto) {
        agregarRepuesto(exacto);
        setBuscarRepuesto("");
        setAvisoCodigo({ texto: `Agregado: ${exacto.descripcion}`, fallo: false });
        return;
      }
    } else {
      setBuscarArticulo(codigo);
      const exacto = codigo ? (await buscarArticulos(codigo)).find((a) => mismoCodigo(a.codigo, codigo)) : undefined;
      if (exacto) {
        agregarArticulo(exacto);
        setBuscarArticulo("");
        setAvisoCodigo({
          texto: `Agregado: ${[exacto.marca, exacto.modelo].filter(Boolean).join(" ") || exacto.tipo}`,
          fallo: false,
        });
        return;
      }
    }
    if (desdeCamara) {
      setAvisoCodigo({ texto: `Ningún producto disponible tiene el código ${codigo}.`, fallo: true });
    }
  }

  /**
   * Lo leído por cámara se clasifica por su forma, no por la pestaña
   * abierta: los artículos siempre llevan ART-000123 en la etiqueta;
   * cualquier otro código es de un repuesto. La pestaña se cambia a la
   * del código leído, para que quien cobra vea lo que se agregó.
   */
  async function codigoLeido(valor: string) {
    setEscaneando(false);
    const kind = /^ART-?\d+$/i.test(valor.trim()) ? "articulo" : "repuesto";
    setVista(kind);
    await buscarOAgregar(kind, valor, true);
  }

  function cambiarVista(kind: Linea["kind"]) {
    setVista(kind);
    setAvisoCodigo(null);
  }

  function agregarRepuesto(r: Repuesto) {
    setCarrito((c) => {
      const existe = c.find((l) => l.kind === "repuesto" && l.repuestoId === r.id) as LineaRepuesto | undefined;
      if (existe) {
        return c.map((l) => (l === existe ? { ...existe, cantidad: existe.cantidad + 1 } : l));
      }
      return [...c, { kind: "repuesto", repuestoId: r.id, descripcion: r.descripcion, cantidad: 1, precioUnit: r.precioVenta }];
    });
  }

  function agregarArticulo(a: Articulo) {
    setCarrito((c) => {
      if (c.some((l) => l.kind === "articulo" && l.articuloId === a.id)) return c;
      const descripcion = [a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo;
      return [...c, { kind: "articulo", articuloId: a.id, codigo: a.codigo, descripcion, precioUnit: a.precio_venta }];
    });
  }

  /**
   * Solo para repuestos: un artículo es una unidad concreta, no una
   * cantidad -- por eso su fila no tiene los botones de más y menos.
   * Bajar de 1 quita la línea, que es lo que espera quien se equivocó
   * al agregar y toca el menos sin pensar.
   */
  function cambiarCantidad(i: number, delta: number) {
    setCarrito((c) =>
      c.flatMap((l, idx) => {
        if (idx !== i || l.kind !== "repuesto") return [l];
        const cantidad = l.cantidad + delta;
        return cantidad < 1 ? [] : [{ ...l, cantidad }];
      }),
    );
  }

  function quitar(i: number) {
    setCarrito((c) => c.filter((_, idx) => idx !== i));
  }

  function estaEnCarrito(kind: Linea["kind"], id: string) {
    return carrito.some((l) => (l.kind === "repuesto" ? l.repuestoId : l.articuloId) === id && l.kind === kind);
  }

  async function confirmarVenta() {
    setEnviando(true);
    setMensaje(null);
    setFallo(false);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: carrito.map((l) =>
            l.kind === "repuesto"
              ? { repuestoId: l.repuestoId, descripcion: l.descripcion, cantidad: l.cantidad, precioUnit: l.precioUnit }
              : { articuloId: l.articuloId, descripcion: `${l.codigo} ${l.descripcion}`, cantidad: 1, precioUnit: l.precioUnit },
          ),
          metodoPagoId,
          montoRecibido: metodo?.es_efectivo ? montoRecibido : undefined,
          imprimir,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setCarrito([]);
      setMontoRecibido(0);
      setVentaResultado({ id: data.ventaId, numero: data.numero });
      // Un artículo vendido deja de estar disponible: la rejilla que
      // quedó en pantalla ya no dice la verdad hasta volver a pedirla.
      buscarArticulos();
      buscarRepuestos();
    } catch (e) {
      setFallo(true);
      setMensaje(e instanceof Error ? e.message : "No se pudo registrar la venta");
    } finally {
      setEnviando(false);
    }
  }

  async function reimprimirRecibo() {
    if (!ventaResultado) return;
    try {
      await fetch(`/api/ventas/${ventaResultado.id}/reimprimir`, { method: "POST" });
      setMensaje("Reimprimiendo recibo…");
      setFallo(false);
    } catch {
      setMensaje("No se pudo reimprimir");
      setFallo(true);
    }
  }

  function nuevaVenta() {
    setVentaResultado(null);
    setMensaje(null);
    setFallo(false);
  }

  return (
    <div>
      <style>{`
        .pos{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start;}
        .pos-carrito{position:sticky;top:20px;}
        @media (max-width:1000px){
          .pos{grid-template-columns:minmax(0,1fr);}
          .pos-catalogo{order:2;}
          .pos-carrito{order:1;position:static;}
        }
        .pos-categoria{width:auto;max-width:240px;flex:0 1 auto;}
        /* La tarjeta entera agrega al carrito: es un botón, sin otro
           botón "Agregar" adentro. Marcada en color si ya está. */
        .producto{display:flex;flex-direction:column;gap:6px;padding:8px;text-align:left;font:inherit;color:inherit;cursor:pointer;}
        .producto:hover:not(:disabled){border-color:var(--accent);}
        .producto:disabled{cursor:default;opacity:.55;}
        .producto-en-carrito,.producto-en-carrito:disabled{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent);opacity:1;}
        .producto-nombre{font-size:12px;font-weight:700;line-height:1.2;}
        .producto-precio{display:flex;justify-content:space-between;align-items:baseline;gap:6px;font-size:14px;font-weight:800;}
        .producto-precio>span+span{font-size:11px;font-weight:600;}
      `}</style>

      <TituloPantalla
        icono={<ShoppingCart size={24} strokeWidth={2} />}
        titulo="Vender"
      />

      <div className="pos">
        <div className="pos-catalogo pila" style={{ gap: 12 }}>
          {/* Una sola barra: qué se vende (repuestos a granel o equipos
              de a una unidad), qué se busca y en qué categoría. */}
          <div className="fila" style={{ gap: 8 }}>
            <div className="fila" style={{ gap: 6, flexWrap: "nowrap" }} role="group" aria-label="Qué vender">
              {(["repuesto", "articulo"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => cambiarVista(k)}
                  aria-pressed={vista === k}
                  className={`pastilla${vista === k ? " pastilla-activa" : ""}`}
                >
                  {k === "repuesto" ? "Repuestos" : "Equipos"}
                </button>
              ))}
            </div>
            {categorias.length > 0 && (
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(e.target.value)}
                aria-label="Categoría"
                className="pos-categoria"
              >
                <option value="">Categoría: Todas</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            )}
          </div>

          <form
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap" }}
            onSubmit={(e) => {
              e.preventDefault();
              buscarOAgregar(vista, vista === "repuesto" ? buscarRepuesto : buscarArticulo);
            }}
          >
            {vista === "repuesto" ? (
              <input
                placeholder="Buscar repuesto o accesorio por código o nombre"
                value={buscarRepuesto}
                onChange={(e) => setBuscarRepuesto(e.target.value)}
                aria-label="Buscar repuesto o accesorio"
              />
            ) : (
              <input
                placeholder="Buscar equipo por código (ART-000123), marca o modelo"
                value={buscarArticulo}
                onChange={(e) => setBuscarArticulo(e.target.value)}
                aria-label="Buscar equipo"
              />
            )}
            <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} aria-label="Buscar" />
            <Boton
              type="button"
              variante={escaneando ? "primario" : "contorno"}
              icono={<ScanBarcode size={17} strokeWidth={2} />}
              onClick={() => {
                setAvisoCodigo(null);
                setEscaneando((e) => !e);
              }}
              aria-label="Escanear código de barras con la cámara"
              title="Escanear con la cámara"
            />
          </form>

          {escaneando && (
            <LectorCodigoBarras
              formats={FORMATOS_ESCANEO}
              etiqueta="Ubica el código de barras del producto"
              onDetectado={codigoLeido}
              onCerrar={() => setEscaneando(false)}
            />
          )}
          {avisoCodigo && !escaneando && (
            <Aviso
              tono={avisoCodigo.fallo ? "peligro" : "ok"}
              icono={avisoCodigo.fallo ? undefined : <Check size={17} strokeWidth={2.4} />}
            >
              {avisoCodigo.texto}
            </Aviso>
          )}

          {vista === "repuesto" ? (
            resultadosRepuesto.length === 0 ? (
              <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Ningún repuesto coincide con esa búsqueda.
              </Tarjeta>
            ) : (
              <div className="rejilla-catalogo">
                {resultadosRepuesto.map((r) => {
                  const agotado = r.existenciaAqui <= 0;
                  const enCarrito = estaEnCarrito("repuesto", r.id);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`tarjeta producto${enCarrito ? " producto-en-carrito" : ""}`}
                      onClick={() => agregarRepuesto(r)}
                      disabled={agotado}
                      aria-label={`Agregar ${r.descripcion} al carrito`}
                    >
                      <FotoProducto tipo="repuesto" id={r.id} imagenUrl={r.imagenUrl} editable={false} />
                      <span className="producto-nombre">{r.descripcion}</span>
                      <span className="producto-precio">
                        <span className="cifra">{fmt(r.precioVenta)}</span>
                        <span
                          className="cifra"
                          style={{ color: agotado ? "var(--ink-3)" : r.existenciaAqui <= 3 ? "var(--aviso)" : "var(--ink-3)" }}
                          title="Unidades en esta sede"
                        >
                          {agotado ? "Agotado" : r.existenciaAqui}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )
          ) : resultadosArticulo.length === 0 ? (
            <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              Ningún equipo disponible coincide con esa búsqueda.
            </Tarjeta>
          ) : (
            <div className="rejilla-catalogo">
              {resultadosArticulo.map((a) => {
                const enCarrito = estaEnCarrito("articulo", a.id);
                const nombre = [a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo;
                return (
                  <button
                    key={a.id}
                    type="button"
                    className={`tarjeta producto${enCarrito ? " producto-en-carrito" : ""}`}
                    onClick={() => agregarArticulo(a)}
                    disabled={enCarrito}
                    aria-label={enCarrito ? `${nombre} ya está en el carrito` : `Agregar ${nombre} al carrito`}
                  >
                    <FotoProducto tipo="articulo" id={a.id} imagenUrl={a.imagen_url} editable={false} />
                    <span className="producto-nombre">{nombre}</span>
                    <span className="producto-precio">
                      <span className="cifra">{fmt(a.precio_venta)}</span>
                      <span className="cifra" style={{ color: "var(--ink-3)" }}>
                        {a.codigo}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="pos-carrito">
          <Tarjeta relleno={false} style={{ overflow: "hidden" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "14px 16px",
                borderBottom: "1px solid var(--rule)",
              }}
            >
              <h2 style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <ShoppingCart size={20} strokeWidth={2} color="var(--accent)" aria-hidden />
                Carrito
              </h2>
              {carrito.length > 0 && (
                <Boton
                  variante="peligro"
                  tamano="sm"
                  icono={<Trash2 size={15} strokeWidth={2} />}
                  onClick={() => setCarrito([])}
                >
                  Vaciar
                </Boton>
              )}
            </div>

            {carrito.length === 0 ? (
              <div style={{ padding: "30px 20px", textAlign: "center", color: "var(--ink-3)" }}>
                <ShoppingCart size={30} strokeWidth={1.6} aria-hidden />
                <p style={{ margin: "10px 0 0", fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                  El carrito está vacío
                </p>
                <p style={{ margin: "5px 0 0", fontSize: 13 }}>
                  Toca un producto del catálogo para empezar la venta.
                </p>
              </div>
            ) : (
              <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {carrito.map((l, i) => {
                  const cantidad = l.kind === "repuesto" ? l.cantidad : 1;
                  return (
                    <div
                      key={l.kind === "repuesto" ? `r${l.repuestoId}` : `a${l.articuloId}`}
                      className="linea-carrito"
                      style={{
                        padding: 9,
                        border: "1px solid var(--rule)",
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      <div className="linea-carrito-nombre">
                        <div style={{ fontSize: 13, fontWeight: 700 }}>{l.descripcion}</div>
                        <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)" }}>
                          {l.kind === "articulo" ? `${l.codigo} · ` : ""}
                          {fmt(l.precioUnit)}
                        </div>
                      </div>

                      {l.kind === "repuesto" ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 28,
                            border: "1px solid var(--rule-fuerte)",
                            borderRadius: "var(--r-sm)",
                            overflow: "hidden",
                            flexShrink: 0,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(i, -1)}
                            aria-label={`Quitar una unidad de ${l.descripcion}`}
                            style={{ display: "flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", border: "none", background: "var(--surface)", cursor: "pointer" }}
                          >
                            <Minus size={12} strokeWidth={2.4} />
                          </button>
                          <span
                            className="cifra"
                            style={{ width: 28, textAlign: "center", fontSize: 12, fontWeight: 700, borderLeft: "1px solid var(--rule)", borderRight: "1px solid var(--rule)", lineHeight: "26px" }}
                          >
                            {l.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(i, 1)}
                            aria-label={`Agregar una unidad de ${l.descripcion}`}
                            style={{ display: "flex", width: 26, height: 26, alignItems: "center", justifyContent: "center", border: "none", background: "var(--surface)", cursor: "pointer" }}
                          >
                            <Plus size={12} strokeWidth={2.4} />
                          </button>
                        </div>
                      ) : (
                        <Etiqueta tono="neutro">1 unidad</Etiqueta>
                      )}

                      <span className="cifra" style={{ marginLeft: "auto", minWidth: 76, textAlign: "right", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                        {fmt(cantidad * l.precioUnit)}
                      </span>

                      <Boton
                        variante="peligro"
                        tamano="sm"
                        icono={<Trash2 size={15} strokeWidth={2} />}
                        onClick={() => quitar(i)}
                        aria-label={`Quitar ${l.descripcion} del carrito`}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            <div style={{ padding: "14px 16px", borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 12 }}>
              {ventaResultado ? (
                <div style={{ textAlign: "center", padding: "8px 0" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 44,
                      height: 44,
                      borderRadius: "var(--r-lg)",
                      background: "var(--ok-fondo)",
                      color: "var(--ok)",
                      marginBottom: 10,
                    }}
                  >
                    <Check size={22} strokeWidth={2.4} />
                  </span>
                  <p className="cifra" style={{ margin: "0 0 14px", fontWeight: 800, fontSize: 15 }}>
                    Venta #{ventaResultado.numero} registrada
                  </p>
                  <div className="fila" style={{ justifyContent: "center", gap: 8 }}>
                    <Boton variante="contorno" icono={<Printer size={16} strokeWidth={2} />} onClick={reimprimirRecibo}>
                      Imprimir recibo
                    </Boton>
                    <Boton variante="primario" icono={<PlusCircle size={16} strokeWidth={2} />} onClick={nuevaVenta}>
                      Nueva venta
                    </Boton>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                      <span className="cifra">{unidades}</span> {unidades === 1 ? "unidad" : "unidades"}
                    </span>
                    <span className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
                      {fmt(total)}
                    </span>
                  </div>

                  {turnoAbierto === false && <AvisoTurnoCerrado />}

                  <PanelCobro
                    total={total}
                    metodos={metodos}
                    metodoPagoId={metodoPagoId}
                    onCambiarMetodo={setMetodoPagoId}
                    montoRecibido={montoRecibido}
                    onCambiarMontoRecibido={setMontoRecibido}
                    imprimir={imprimir}
                    onCambiarImprimir={setImprimir}
                    ocultarImprimir
                  />

                  <Boton
                    variante="primario"
                    tamano="xl"
                    ancho
                    icono={<Lock size={19} strokeWidth={2} />}
                    disabled={
                      carrito.length === 0 ||
                      enviando ||
                      !metodoPagoId ||
                      turnoAbierto === false ||
                      (metodo?.es_efectivo && cambio < 0)
                    }
                    onClick={confirmarVenta}
                  >
                    <span className="cifra">{enviando ? "Cobrando…" : `Cobrar ${fmt(total)}`}</span>
                  </Boton>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)", cursor: "pointer" }}>
                    <input type="checkbox" checked={imprimir} onChange={(e) => setImprimir(e.target.checked)} />
                    Imprimir recibo
                  </label>
                </>
              )}

              {mensaje && (
                <Aviso
                  tono={fallo ? "peligro" : "ok"}
                  icono={fallo ? undefined : <Check size={17} strokeWidth={2.4} />}
                >
                  {mensaje}
                </Aviso>
              )}
            </div>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
