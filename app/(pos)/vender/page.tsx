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
 * rejilla obligaría a explicar esa diferencia en cada tarjeta.
 */
import { useEffect, useState } from "react";
import { Trash2, Plus, Minus, Search, ShoppingCart, Lock, Check, Banknote, RotateCcw, ChevronDown, Tags } from "lucide-react";
import { FotoProducto } from "@/componentes/ui/foto-producto";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

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

const DENOMINACIONES = [2000, 5000, 10000, 20000, 50000, 100000];

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaVender() {
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [metodoPagoId, setMetodoPagoId] = useState("");
  const [montoRecibido, setMontoRecibido] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  const [buscarRepuesto, setBuscarRepuesto] = useState("");
  const [resultadosRepuesto, setResultadosRepuesto] = useState<Repuesto[]>([]);
  const [buscarArticulo, setBuscarArticulo] = useState("");
  const [resultadosArticulo, setResultadosArticulo] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");
  const [categoriasAbiertas, setCategoriasAbiertas] = useState(false);

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

  async function buscarRepuestos() {
    const res = await fetch(conCategoria(`/api/repuestos?buscar=${encodeURIComponent(buscarRepuesto)}`));
    const data = await res.json();
    setResultadosRepuesto(res.ok && Array.isArray(data) ? data : []);
  }

  async function buscarArticulos() {
    const res = await fetch(
      conCategoria(`/api/inventario/articulos?disponibles=1&buscar=${encodeURIComponent(buscarArticulo)}`),
    );
    const data = await res.json();
    setResultadosArticulo(res.ok && Array.isArray(data) ? data : []);
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
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCarrito([]);
      setMontoRecibido(0);
      setMensaje("Venta registrada. Imprimiendo recibo…");
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

  return (
    <div>
      <style>{`
        .pos{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start;}
        .pos-carrito{position:sticky;top:20px;}
        .categorias-movil{display:none;}
        @media (max-width:1000px){
          .pos{grid-template-columns:minmax(0,1fr);}
          .pos-catalogo{order:2;}
          .pos-carrito{order:1;position:static;}
        }
        /* Con 30+ categorías reales, la fila de pastillas envueltas se
           come media pantalla del celular antes de llegar al catálogo --
           por debajo de 640px se cambia por un desplegable con scroll
           propio, del mismo modo que el menú lateral deja de ser un
           riel fijo ahí. */
        @media (max-width:640px){
          .categorias-escritorio{display:none;}
          .categorias-movil{display:block;}
        }
      `}</style>

      <TituloPantalla
        icono={<ShoppingCart size={24} strokeWidth={2} />}
        titulo="Vender"
        descripcion="Busca un repuesto o un artículo y agrégalo al carrito."
      />

      <div className="pos">
        <div className="pos-catalogo pila">
          {categorias.length > 0 && (
            <>
              {/* Escritorio/tablet: la fila envuelta de siempre -- hay
                  espacio de sobra para verlas todas de un vistazo. */}
              <div className="categorias-escritorio fila" style={{ gap: 7 }}>
                <button
                  type="button"
                  onClick={() => setCategoriaId("")}
                  className={`pastilla${categoriaId === "" ? " pastilla-activa" : ""}`}
                >
                  Todos
                </button>
                {categorias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoriaId(c.id)}
                    className={`pastilla${categoriaId === c.id ? " pastilla-activa" : ""}`}
                  >
                    {c.nombre}
                  </button>
                ))}
              </div>

              {/* Móvil: un desplegable -- la lista completa empuja el
                  catálogo fuera de la pantalla si se muestra siempre. */}
              <div className="categorias-movil">
                <button
                  type="button"
                  onClick={() => setCategoriasAbiertas((a) => !a)}
                  aria-expanded={categoriasAbiertas}
                  className="pastilla"
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", justifyContent: "space-between" }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Tags size={15} strokeWidth={2} />
                    {categoriaId ? categorias.find((c) => c.id === categoriaId)?.nombre : "Categorías: Todos"}
                  </span>
                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    style={{ transform: categoriasAbiertas ? "rotate(180deg)" : undefined, transition: "transform .15s ease" }}
                  />
                </button>
                {categoriasAbiertas && (
                  <div
                    className="pila"
                    style={{ gap: 4, marginTop: 8, maxHeight: 260, overflowY: "auto", padding: 4 }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCategoriaId("");
                        setCategoriasAbiertas(false);
                      }}
                      className={`pastilla${categoriaId === "" ? " pastilla-activa" : ""}`}
                      style={{ textAlign: "left" }}
                    >
                      Todos
                    </button>
                    {categorias.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCategoriaId(c.id);
                          setCategoriasAbiertas(false);
                        }}
                        className={`pastilla${categoriaId === c.id ? " pastilla-activa" : ""}`}
                        style={{ textAlign: "left" }}
                      >
                        {c.nombre}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <section>
            <form
              className="fila"
              style={{ gap: 8, marginBottom: 12, flexWrap: "nowrap" }}
              onSubmit={(e) => {
                e.preventDefault();
                buscarRepuestos();
              }}
            >
              <input
                placeholder="Buscar repuesto o accesorio por código o descripción"
                value={buscarRepuesto}
                onChange={(e) => setBuscarRepuesto(e.target.value)}
                aria-label="Buscar repuesto o accesorio"
              />
              <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} />
            </form>

            {resultadosRepuesto.length === 0 ? (
              <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Ningún repuesto coincide con esa búsqueda.
              </Tarjeta>
            ) : (
              <div className="rejilla-catalogo">
                {resultadosRepuesto.map((r) => {
                  const agotado = r.existenciaAqui <= 0;
                  return (
                    <Tarjeta
                      key={r.id}
                      relleno={false}
                      style={{
                        padding: 11,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        opacity: agotado ? 0.55 : 1,
                        borderColor: estaEnCarrito("repuesto", r.id) ? "var(--accent)" : undefined,
                      }}
                    >
                      <FotoProducto tipo="repuesto" id={r.id} imagenUrl={r.imagenUrl} editable={false} />
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{r.descripcion}</div>
                      <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                        {r.codigo}
                      </div>
                      <div className="fila" style={{ justifyContent: "space-between", gap: 6 }}>
                        <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                          {fmt(r.precioVenta)}
                        </span>
                        <Etiqueta tono={agotado ? "neutro" : r.existenciaAqui <= 3 ? "aviso" : "ok"}>
                          <span className="cifra">{agotado ? "Agotado" : r.existenciaAqui}</span>
                        </Etiqueta>
                      </div>
                      <Boton
                        variante="primario"
                        tamano="sm"
                        ancho
                        icono={<Plus size={15} strokeWidth={2.2} />}
                        onClick={() => agregarRepuesto(r)}
                        disabled={agotado}
                      >
                        Agregar
                      </Boton>
                    </Tarjeta>
                  );
                })}
              </div>
            )}
          </section>

          <section>
            <form
              className="fila"
              style={{ gap: 8, marginBottom: 12, flexWrap: "nowrap" }}
              onSubmit={(e) => {
                e.preventDefault();
                buscarArticulos();
              }}
            >
              <input
                placeholder="Buscar artículo por código (ART-000123), marca o modelo"
                value={buscarArticulo}
                onChange={(e) => setBuscarArticulo(e.target.value)}
                aria-label="Buscar artículo"
              />
              <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} />
            </form>

            {resultadosArticulo.length === 0 ? (
              <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                Ningún artículo disponible coincide con esa búsqueda.
              </Tarjeta>
            ) : (
              <div className="rejilla-catalogo">
                {resultadosArticulo.map((a) => {
                  const enCarrito = estaEnCarrito("articulo", a.id);
                  return (
                    <Tarjeta
                      key={a.id}
                      relleno={false}
                      style={{
                        padding: 11,
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        borderColor: enCarrito ? "var(--accent)" : undefined,
                      }}
                    >
                      <FotoProducto tipo="articulo" id={a.id} imagenUrl={a.imagen_url} editable={false} />
                      <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                        {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
                      </div>
                      <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                        {a.codigo}
                      </div>
                      <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                        {fmt(a.precio_venta)}
                      </span>
                      <Boton
                        variante="primario"
                        tamano="sm"
                        ancho
                        icono={enCarrito ? <Check size={15} strokeWidth={2.6} /> : <Plus size={15} strokeWidth={2.2} />}
                        onClick={() => agregarArticulo(a)}
                        disabled={enCarrito}
                      >
                        {enCarrito ? "En el carrito" : "Agregar"}
                      </Boton>
                    </Tarjeta>
                  );
                })}
              </div>
            )}
          </section>
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
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: 9,
                        border: "1px solid var(--rule)",
                        borderRadius: "var(--r-md)",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
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
                            height: 32,
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
                            style={{ display: "flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", border: "none", background: "var(--surface)", cursor: "pointer" }}
                          >
                            <Minus size={14} strokeWidth={2.4} />
                          </button>
                          <span
                            className="cifra"
                            style={{ width: 32, textAlign: "center", fontSize: 13, fontWeight: 700, borderLeft: "1px solid var(--rule)", borderRight: "1px solid var(--rule)", lineHeight: "30px" }}
                          >
                            {l.cantidad}
                          </span>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(i, 1)}
                            aria-label={`Agregar una unidad de ${l.descripcion}`}
                            style={{ display: "flex", width: 30, height: 30, alignItems: "center", justifyContent: "center", border: "none", background: "var(--surface)", cursor: "pointer" }}
                          >
                            <Plus size={14} strokeWidth={2.4} />
                          </button>
                        </div>
                      ) : (
                        <Etiqueta tono="neutro">1 unidad</Etiqueta>
                      )}

                      <span className="cifra" style={{ width: 86, textAlign: "right", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
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
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                  <span className="cifra">{unidades}</span> {unidades === 1 ? "unidad" : "unidades"}
                </span>
                <span className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
                  {fmt(total)}
                </span>
              </div>

              {metodos.length > 0 && (
                <div>
                  <div className="campo-etiqueta">Forma de pago</div>
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(metodos.length, 3)}, minmax(0, 1fr))`, gap: 8 }}>
                    {metodos.map((m) => (
                      <Boton
                        key={m.id}
                        variante={metodoPagoId === m.id ? "primario" : "contorno"}
                        onClick={() => setMetodoPagoId(m.id)}
                        aria-pressed={metodoPagoId === m.id}
                      >
                        {m.nombre}
                      </Boton>
                    ))}
                  </div>
                </div>
              )}

              {metodo?.es_efectivo && (
                <div>
                  <div className="campo-etiqueta">
                    <Banknote size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden />
                    Toca las denominaciones recibidas
                  </div>
                  <div className="fila" style={{ gap: 7, marginBottom: 10 }}>
                    {DENOMINACIONES.map((d) => (
                      <Boton key={d} variante="contorno" tamano="sm" onClick={() => setMontoRecibido((m) => m + d)}>
                        <span className="cifra">{fmt(d)}</span>
                      </Boton>
                    ))}
                    <Boton
                      variante="fantasma"
                      tamano="sm"
                      icono={<RotateCcw size={14} strokeWidth={2} />}
                      onClick={() => setMontoRecibido(0)}
                    >
                      Reiniciar
                    </Boton>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: "var(--ink-2)" }}>Recibido</span>
                    <span className="cifra" style={{ fontWeight: 700 }}>{fmt(montoRecibido)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
                    <span style={{ color: cambio < 0 ? "var(--peligro)" : "var(--ok)" }}>
                      {cambio < 0 ? "Falta" : "Cambio"}
                    </span>
                    <span className="cifra" style={{ color: cambio < 0 ? "var(--peligro)" : "var(--ok)" }}>
                      {fmt(Math.abs(cambio))}
                    </span>
                  </div>
                </div>
              )}

              <Boton
                variante="primario"
                tamano="xl"
                ancho
                icono={<Lock size={19} strokeWidth={2} />}
                disabled={carrito.length === 0 || enviando || !metodoPagoId || (metodo?.es_efectivo && cambio < 0)}
                onClick={confirmarVenta}
              >
                <span className="cifra">{enviando ? "Cobrando…" : `Cobrar ${fmt(total)}`}</span>
              </Boton>

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
