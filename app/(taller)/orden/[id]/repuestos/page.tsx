"use client";

/**
 * Consumir un repuesto contra el inventario de la sede, agregar un
 * servicio o mano de obra, o pedir a Compras lo que no hay -- lo que
 * crea la fila en repuesto_solicitud que aparece en /compras. Fase 6 del
 * plano de construcción. Todo sale de un solo buscador.
 *
 * También muestra lo que este técnico ya pidió para esta orden y su
 * estado -- antes no había ninguna manera de saber, desde acá, cuando
 * Compras marcaba un faltante como recibido.
 */
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Search, Minus, Check, PackageCheck, Plus, ShoppingBag } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { CabeceraOrden } from "@/componentes/taller/cabecera-orden";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface Solicitud {
  id: string;
  descripcion: string;
  cantidad: number;
  estado: string;
  creada_en: string;
}

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  existenciaAqui: number;
  /** Apartado para órdenes aprobadas (0056); puede incluir esta misma. */
  reservadoAqui?: number;
}

interface ItemCatalogo {
  id: string;
  nombre: string;
  precio: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Un resultado del buscador único: un repuesto del inventario o un
 *  ítem del catálogo de servicios o de mano de obra. */
type Resultado =
  | { clase: "repuesto"; repuesto: Repuesto }
  | { clase: "servicio" | "mano_obra"; item: ItemCatalogo };

export default function PaginaRepuestos() {
  const { id } = useParams<{ id: string }>();

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [buscando, setBuscando] = useState(false);
  const busqueda = useRef(0);

  // «Pedir a Compras» se abre desde el buscador, con lo escrito.
  const [pidiendo, setPidiendo] = useState(false);
  const [faltanteDescripcion, setFaltanteDescripcion] = useState("");
  const [faltanteCantidad, setFaltanteCantidad] = useState("1");
  const [prioridad, setPrioridad] = useState("normal");

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  async function cargarSolicitudes() {
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, estado, creada_en")
      .eq("orden_id", id)
      .order("creada_en", { ascending: false });
    setSolicitudes((data as Solicitud[]) ?? []);
  }

  useEffect(() => {
    cargarSolicitudes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Un solo buscador para repuestos, servicios y mano de obra: antes
  // eran tres tarjetas, cada una con su campo y su botón de buscar.
  async function buscarTodo(texto = buscar) {
    const q = texto.trim();
    const turno = ++busqueda.current;
    if (!q) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    const pedir = (url: string) =>
      fetch(url)
        .then((r) => (r.ok ? r.json() : []))
        .catch(() => []);
    const [repuestos, servicios, manoObra] = await Promise.all([
      pedir(`/api/repuestos?buscar=${encodeURIComponent(q)}`),
      pedir(`/api/servicios?buscar=${encodeURIComponent(q)}`),
      pedir(`/api/mano-obra?buscar=${encodeURIComponent(q)}`),
    ]);
    if (turno !== busqueda.current) return;
    setResultados([
      ...(Array.isArray(repuestos) ? (repuestos as Repuesto[]).map((r) => ({ clase: "repuesto" as const, repuesto: r })) : []),
      ...(Array.isArray(servicios) ? (servicios as ItemCatalogo[]).map((i) => ({ clase: "servicio" as const, item: i })) : []),
      ...(Array.isArray(manoObra) ? (manoObra as ItemCatalogo[]).map((i) => ({ clase: "mano_obra" as const, item: i })) : []),
    ]);
    setBuscando(false);
  }

  useEffect(() => {
    const t = setTimeout(() => buscarTodo(buscar), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscar]);

  async function consumir(repuestoId: string) {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "consumir", repuestoId, cantidad: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Repuesto consumido y descontado del inventario.");
      buscarTodo();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consumir el repuesto");
    } finally {
      setProcesando(false);
    }
  }

  async function agregarItem(tipo: "servicio" | "mano_obra", itemId: string) {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, id: itemId, cantidad: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje(tipo === "servicio" ? "Servicio agregado a la orden." : "Mano de obra agregada a la orden.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar");
    } finally {
      setProcesando(false);
    }
  }

  function abrirPedido() {
    setFaltanteDescripcion(buscar.trim());
    setPidiendo(true);
  }

  async function marcarFaltante() {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "faltante",
          descripcion: faltanteDescripcion.trim(),
          cantidad: Number(faltanteCantidad) || 1,
          prioridad,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Pedido a Compras.");
      setFaltanteDescripcion("");
      setFaltanteCantidad("1");
      setPidiendo(false);
      cargarSolicitudes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar el faltante");
    } finally {
      setProcesando(false);
    }
  }

  const ETIQUETA_CLASE = { servicio: "Servicio", mano_obra: "Mano de obra" } as const;

  return (
    <div>
      <CabeceraOrden ordenId={id} anterior={{ href: `/orden/${id}/cotizacion`, etiqueta: "Cotización" }} />

      <TituloPantalla
        titulo="Repuestos"
        acciones={
          <Boton variante="contorno" icono={<ShoppingBag size={17} strokeWidth={2} />} onClick={abrirPedido}>
            Pedir a Compras
          </Boton>
        }
      />

      <div className="pila">
        <Tarjeta>
          <div style={{ position: "relative" }}>
            <input
              placeholder="Buscar repuesto, servicio o mano de obra"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              aria-label="Buscar repuesto, servicio o mano de obra"
              style={{ paddingRight: 40 }}
            />
            <Search
              size={17}
              strokeWidth={2}
              aria-hidden
              color="var(--ink-3)"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", opacity: buscando ? 0.4 : 1 }}
            />
          </div>

          {resultados.length > 0 && (
            <div style={{ marginTop: 12 }}>
              {resultados.map((r) =>
                r.clase === "repuesto" ? (
                  <div key={`r-${r.repuesto.id}`} className="fila-resultado">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.repuesto.descripcion}</div>
                      <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {r.repuesto.codigo}
                        {r.repuesto.reservadoAqui
                          ? ` · ${r.repuesto.reservadoAqui} reservado${r.repuesto.reservadoAqui > 1 ? "s" : ""}`
                          : ""}
                      </div>
                    </div>
                    <Etiqueta tono={r.repuesto.existenciaAqui <= 0 ? "neutro" : r.repuesto.existenciaAqui <= 3 ? "aviso" : "ok"}>
                      <span className="cifra">{r.repuesto.existenciaAqui <= 0 ? "Agotado" : `${r.repuesto.existenciaAqui} aquí`}</span>
                    </Etiqueta>
                    {r.repuesto.existenciaAqui > 0 ? (
                      <Boton
                        variante="primario"
                        tamano="sm"
                        icono={<Minus size={15} strokeWidth={2.2} />}
                        onClick={() => consumir(r.repuesto.id)}
                        disabled={procesando}
                      >
                        Consumir 1
                      </Boton>
                    ) : (
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        icono={<ShoppingBag size={15} strokeWidth={2} />}
                        onClick={() => {
                          setFaltanteDescripcion(r.repuesto.descripcion);
                          setPidiendo(true);
                        }}
                      >
                        Pedir
                      </Boton>
                    )}
                  </div>
                ) : (
                  <div key={`${r.clase}-${r.item.id}`} className="fila-resultado">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.item.nombre}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{ETIQUETA_CLASE[r.clase]}</div>
                    </div>
                    <span className="cifra" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                      {fmt(r.item.precio)}
                    </span>
                    <Boton
                      variante="primario"
                      tamano="sm"
                      icono={<Plus size={15} strokeWidth={2.2} />}
                      onClick={() => agregarItem(r.clase, r.item.id)}
                      disabled={procesando}
                    >
                      Agregar
                    </Boton>
                  </div>
                ),
              )}
            </div>
          )}

          {resultados.length === 0 && buscar.trim() && !buscando && (
            <div className="fila" style={{ marginTop: 12, justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>No está en el catálogo.</span>
              <Boton variante="contorno" tamano="sm" icono={<ShoppingBag size={15} strokeWidth={2} />} onClick={abrirPedido}>
                Pedir «{buscar.trim()}» a Compras
              </Boton>
            </div>
          )}
        </Tarjeta>

        {pidiendo && (
          <Tarjeta>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>Pedir a Compras</h2>
            <div className="pila" style={{ gap: 12 }}>
              <input
                placeholder="Qué hace falta"
                aria-label="Qué hace falta"
                value={faltanteDescripcion}
                onChange={(e) => setFaltanteDescripcion(e.target.value)}
                autoFocus
              />
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
                <Campo etiqueta="Cantidad">
                  <input
                    type="number"
                    min={1}
                    value={faltanteCantidad}
                    onChange={(e) => setFaltanteCantidad(e.target.value)}
                    className="cifra"
                  />
                </Campo>
                <Campo etiqueta="Prioridad">
                  <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </Campo>
              </div>
              <div className="fila" style={{ gap: 8 }}>
                <Boton
                  variante="primario"
                  icono={<ShoppingBag size={17} strokeWidth={2} />}
                  onClick={marcarFaltante}
                  disabled={procesando || !faltanteDescripcion.trim()}
                >
                  Pedir
                </Boton>
                <Boton variante="fantasma" onClick={() => setPidiendo(false)}>
                  Cancelar
                </Boton>
              </div>
            </div>
          </Tarjeta>
        )}

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />

        {solicitudes.length > 0 && (
          <Tarjeta>
            <h2 style={{ fontSize: 16, marginBottom: 4 }}>Pedido para esta orden</h2>
            <div>
              {solicitudes.map((s) => (
                <div key={s.id} className="fila-resultado">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.descripcion}</div>
                    <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      x{s.cantidad}
                    </div>
                  </div>
                  {s.estado === "recibido" ? (
                    <Etiqueta tono="ok" icono={<PackageCheck size={13} strokeWidth={2} />}>
                      Ya llegó
                    </Etiqueta>
                  ) : (
                    <Etiqueta tono="aviso" punto>
                      <span style={{ textTransform: "capitalize" }}>{s.estado}</span>
                    </Etiqueta>
                  )}
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
