"use client";

/**
 * Traslados de inventario entre sedes -- la tienda (almacén) manda, el
 * taller recibe, o viceversa. Enviar descuenta el inventario de origen
 * de inmediato (ver POST /api/traslados); recibir es un paso aparte y
 * deliberado, para que el destino nunca sume algo que no tiene en la
 * mano todavía.
 */
import { useEffect, useState } from "react";
import { ArrowLeftRight, Search, Plus, Trash2, Send, PackageCheck, Check } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Sede {
  id: string;
  nombre: string;
  tipo: string;
}

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  existenciaAqui: number;
}

interface Articulo {
  id: string;
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
}

interface LineaRepuesto {
  kind: "repuesto";
  repuestoId: string;
  descripcion: string;
  cantidad: number;
}

interface LineaArticulo {
  kind: "articulo";
  articuloId: string;
  descripcion: string;
}

type LineaTraslado = LineaRepuesto | LineaArticulo;

interface ItemTraslado {
  descripcion: string;
  cantidad: number;
}

interface Traslado {
  id: string;
  numero: number;
  estado: string;
  nota: string | null;
  enviado_en: string;
  recibido_en: string | null;
  sede_origen: { nombre: string } | { nombre: string }[] | null;
  sede_destino: { nombre: string } | { nombre: string }[] | null;
  items: ItemTraslado[];
}

function nombreSede(s: Traslado["sede_origen"]) {
  if (!s) return "—";
  return Array.isArray(s) ? s[0]?.nombre : s.nombre;
}

export default function PaginaTraslados() {
  const [miSedeId, setMiSedeId] = useState<string | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeDestinoId, setSedeDestinoId] = useState("");
  const [nota, setNota] = useState("");

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<Repuesto[]>([]);
  const [buscarArt, setBuscarArt] = useState("");
  const [resultadosArt, setResultadosArt] = useState<Articulo[]>([]);
  const [carrito, setCarrito] = useState<LineaTraslado[]>([]);

  const [entrantes, setEntrantes] = useState<Traslado[]>([]);
  const [salientes, setSalientes] = useState<Traslado[]>([]);

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargarInicial() {
    try {
      const [resPerfil, resSedes] = await Promise.all([fetch("/api/perfil"), fetch("/api/sedes")]);
      const perfil = await resPerfil.json();
      const listaSedes = await resSedes.json();
      if (!resPerfil.ok) throw new Error(perfil.error ?? "No se pudo cargar el perfil");
      if (!resSedes.ok) throw new Error(listaSedes.error ?? "No se pudieron cargar las sedes");
      setMiSedeId(perfil.sedeId ?? null);
      setSedes(Array.isArray(listaSedes) ? listaSedes.filter((s: Sede) => s.id !== perfil.sedeId) : []);
      await cargarTraslados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la pantalla de traslados");
    }
  }

  async function cargarTraslados() {
    try {
      const [resEntrantes, resSalientes] = await Promise.all([
        fetch("/api/traslados?direccion=entrantes&estado=enviado"),
        fetch("/api/traslados?direccion=salientes"),
      ]);
      const entrantes = await resEntrantes.json();
      const salientes = await resSalientes.json();
      if (!resEntrantes.ok) throw new Error(entrantes.error ?? "No se pudieron cargar los traslados entrantes");
      if (!resSalientes.ok) throw new Error(salientes.error ?? "No se pudieron cargar los traslados salientes");
      setEntrantes(Array.isArray(entrantes) ? entrantes : []);
      setSalientes(Array.isArray(salientes) ? salientes : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los traslados");
    }
  }

  useEffect(() => {
    cargarInicial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buscarRepuestos() {
    const res = await fetch(`/api/repuestos?buscar=${encodeURIComponent(buscar)}`);
    const data = await res.json();
    setResultados(res.ok && Array.isArray(data) ? data : []);
  }

  async function buscarArticulos() {
    const res = await fetch(`/api/inventario/articulos?disponibles=1&buscar=${encodeURIComponent(buscarArt)}`);
    const data = await res.json();
    setResultadosArt(res.ok && Array.isArray(data) ? data : []);
  }

  function agregarAlCarrito(r: Repuesto) {
    setCarrito((c) => {
      if (c.some((l) => l.kind === "repuesto" && l.repuestoId === r.id)) return c;
      return [...c, { kind: "repuesto", repuestoId: r.id, descripcion: r.descripcion, cantidad: 1 }];
    });
  }

  function agregarArticuloAlCarrito(a: Articulo) {
    setCarrito((c) => {
      if (c.some((l) => l.kind === "articulo" && l.articuloId === a.id)) return c;
      const descripcion = `${a.codigo} ${[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}`;
      return [...c, { kind: "articulo", articuloId: a.id, descripcion }];
    });
  }

  function cambiarCantidad(repuestoId: string, cantidad: number) {
    setCarrito((c) => c.map((l) => (l.kind === "repuesto" && l.repuestoId === repuestoId ? { ...l, cantidad } : l)));
  }

  function quitarDelCarrito(i: number) {
    setCarrito((c) => c.filter((_, idx) => idx !== i));
  }

  async function enviarTraslado() {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch("/api/traslados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sedeDestinoId,
          items: carrito.map((l) =>
            l.kind === "repuesto"
              ? { repuestoId: l.repuestoId, descripcion: l.descripcion, cantidad: l.cantidad }
              : { articuloId: l.articuloId, descripcion: l.descripcion, cantidad: 1 },
          ),
          nota: nota.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      setMensaje(`Traslado #${data.traslado.numero} enviado. Imprimiendo comprobante…`);
      setCarrito([]);
      setNota("");
      await cargarTraslados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar el traslado");
    } finally {
      setProcesando(false);
    }
  }

  async function marcarRecibido(id: string) {
    setProcesando(true);
    setError(null);
    try {
      const res = await fetch(`/api/traslados/${id}/recibir`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await cargarTraslados();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo confirmar la recepción");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<ArrowLeftRight size={24} strokeWidth={2} />}
        titulo="Traslados entre sedes"
        descripcion="Enviar descuenta el inventario de origen de inmediato; recibir es un paso aparte, en el destino."
      />

      <div className="pila">
        {entrantes.length > 0 && (
          <Tarjeta relleno={false} style={{ overflow: "hidden", borderColor: "var(--accent-linea)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)", background: "var(--accent-suave)" }}>
              <h2 style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <PackageCheck size={19} strokeWidth={2} color="var(--accent)" aria-hidden />
                Por recibir en mi sede
                <span className="pastilla-conteo cifra">{entrantes.length}</span>
              </h2>
            </div>
            {entrantes.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>
                    <span className="cifra">Traslado #{t.numero}</span>{" "}
                    <span style={{ fontWeight: 500, color: "var(--ink-2)" }}>desde {nombreSede(t.sede_origen)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {t.items.map((i) => `${i.cantidad} x ${i.descripcion}`).join(", ")}
                  </div>
                </div>
                <Boton
                  variante="primario"
                  tamano="sm"
                  icono={<Check size={15} strokeWidth={2.4} />}
                  onClick={() => marcarRecibido(t.id)}
                  disabled={procesando}
                >
                  Marcar recibido
                </Boton>
              </div>
            ))}
          </Tarjeta>
        )}

        <Tarjeta>
          <h2 style={{ marginBottom: 14 }}>Enviar mercancía a otra sede</h2>

          <Campo etiqueta="Sede destino">
            <select value={sedeDestinoId} onChange={(e) => setSedeDestinoId(e.target.value)}>
              <option value="">Elegir sede destino…</option>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <div style={{ marginTop: 16 }}>
            <form
              className="fila"
              style={{ gap: 8, flexWrap: "nowrap" }}
              onSubmit={(e) => {
                e.preventDefault();
                buscarRepuestos();
              }}
            >
              <input
                placeholder="Buscar repuesto por código o descripción"
                value={buscar}
                onChange={(e) => setBuscar(e.target.value)}
                aria-label="Buscar repuesto"
              />
              <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} />
            </form>

            {resultados.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{r.descripcion}</div>
                  <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {r.codigo}
                  </div>
                </div>
                <div className="fila" style={{ flexWrap: "nowrap" }}>
                  <Etiqueta tono={r.existenciaAqui <= 0 ? "neutro" : "ok"}>
                    <span className="cifra">{r.existenciaAqui <= 0 ? "Agotado" : `${r.existenciaAqui} aquí`}</span>
                  </Etiqueta>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    icono={<Plus size={15} strokeWidth={2.2} />}
                    onClick={() => agregarAlCarrito(r)}
                    disabled={r.existenciaAqui <= 0}
                  >
                    Agregar
                  </Boton>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20 }}>
            <form
              className="fila"
              style={{ gap: 8, flexWrap: "nowrap" }}
              onSubmit={(e) => {
                e.preventDefault();
                buscarArticulos();
              }}
            >
              <input
                placeholder="Buscar artículo individual por código, marca o modelo"
                value={buscarArt}
                onChange={(e) => setBuscarArt(e.target.value)}
                aria-label="Buscar artículo individual"
              />
              <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} />
            </form>

            {resultadosArt.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--rule)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>
                    {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
                  </div>
                  <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    {a.codigo}
                  </div>
                </div>
                <Boton
                  variante="contorno"
                  tamano="sm"
                  icono={<Plus size={15} strokeWidth={2.2} />}
                  onClick={() => agregarArticuloAlCarrito(a)}
                >
                  Agregar
                </Boton>
              </div>
            ))}
          </div>

          {carrito.length > 0 && (
            <div style={{ marginTop: 18, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {carrito.map((l, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderBottom: i === carrito.length - 1 ? "none" : "1px solid var(--rule)",
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600 }}>{l.descripcion}</span>
                  {l.kind === "repuesto" ? (
                    <input
                      type="number"
                      min={1}
                      value={l.cantidad}
                      onChange={(e) => cambiarCantidad(l.repuestoId, Number(e.target.value) || 1)}
                      aria-label={`Cantidad de ${l.descripcion}`}
                      className="cifra"
                      style={{ width: 74, height: "var(--alto-sm)", textAlign: "center", flexShrink: 0 }}
                    />
                  ) : (
                    <Etiqueta tono="neutro">1 unidad</Etiqueta>
                  )}
                  <Boton
                    variante="peligro"
                    tamano="sm"
                    icono={<Trash2 size={15} strokeWidth={2} />}
                    onClick={() => quitarDelCarrito(i)}
                    aria-label={`Quitar ${l.descripcion}`}
                  />
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 16 }}>
            <Campo etiqueta="Nota" ayuda="Opcional. Sale impresa en el comprobante del traslado.">
              <input placeholder="Nota (opcional)" value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          </div>

          <div style={{ marginTop: 16 }}>
            <Boton
              variante="primario"
              tamano="lg"
              icono={<Send size={19} strokeWidth={2} />}
              onClick={enviarTraslado}
              disabled={procesando || !sedeDestinoId || carrito.length === 0}
            >
              {procesando ? "Enviando…" : "Enviar traslado"}
            </Boton>
          </div>
        </Tarjeta>

        <section>
          <h2 style={{ marginBottom: 12 }}>Enviados por mi sede</h2>
          {salientes.length === 0 ? (
            <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
              Todavía no se ha enviado ningún traslado.
            </Tarjeta>
          ) : (
            <TarjetaTabla>
              <table>
                <thead>
                  <tr>
                    <th>Traslado</th>
                    <th>Destino</th>
                    <th>Items</th>
                    <th>Estado</th>
                    <th>Enviado</th>
                  </tr>
                </thead>
                <tbody>
                  {salientes.map((t) => (
                    <tr key={t.id}>
                      <td className="cifra" style={{ fontWeight: 800 }}>
                        #{t.numero}
                      </td>
                      <td>{nombreSede(t.sede_destino)}</td>
                      <td style={{ color: "var(--ink-2)" }}>
                        {t.items.map((i) => `${i.cantidad} x ${i.descripcion}`).join(", ")}
                      </td>
                      <td>
                        <Etiqueta tono={t.estado === "recibido" ? "ok" : "aviso"} punto>
                          <span style={{ textTransform: "capitalize" }}>{t.estado}</span>
                        </Etiqueta>
                      </td>
                      <td className="cifra" style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                        {new Date(t.enviado_en).toLocaleDateString("es-CO")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TarjetaTabla>
          )}
        </section>

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}
        {!miSedeId && <p style={{ fontSize: 13, color: "var(--ink-3)" }}>Cargando sede…</p>}
      </div>
    </div>
  );
}
