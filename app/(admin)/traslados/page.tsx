"use client";

/**
 * Traslados de inventario entre sedes -- la tienda (almacén) manda, el
 * taller recibe, o viceversa. Enviar descuenta el inventario de origen
 * de inmediato (ver POST /api/traslados); recibir es un paso aparte y
 * deliberado, para que el destino nunca sume algo que no tiene en la
 * mano todavía.
 */
import { useEffect, useState } from "react";

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
      <h1>Traslados entre sedes</h1>

      {entrantes.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16 }}>Por recibir en mi sede</h2>
          {entrantes.map((t) => (
            <div
              key={t.id}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #223038" }}
            >
              <div>
                <strong>Traslado #{t.numero}</strong> desde {nombreSede(t.sede_origen)}
                <div style={{ fontSize: 12, opacity: 0.6 }}>
                  {t.items.map((i) => `${i.cantidad} x ${i.descripcion}`).join(", ")}
                </div>
              </div>
              <button onClick={() => marcarRecibido(t.id)} disabled={procesando}>
                Marcar recibido
              </button>
            </div>
          ))}
        </section>
      )}

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16 }}>Enviar mercancía a otra sede</h2>

        <select value={sedeDestinoId} onChange={(e) => setSedeDestinoId(e.target.value)} style={{ padding: 8, marginBottom: 8, width: "100%" }}>
          <option value="">Elegir sede destino…</option>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Buscar repuesto por código o descripción"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarRepuestos}>Buscar</button>
        </div>

        {resultados.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
            <div>
              {r.descripcion} <span style={{ opacity: 0.6, fontSize: 12 }}>({r.existenciaAqui} en mi sede)</span>
            </div>
            <button onClick={() => agregarAlCarrito(r)} disabled={r.existenciaAqui <= 0}>
              Agregar
            </button>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 12, marginBottom: 8 }}>
          <input
            placeholder="Buscar artículo individual por código, marca o modelo"
            value={buscarArt}
            onChange={(e) => setBuscarArt(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarArticulos}>Buscar</button>
        </div>

        {resultadosArt.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0" }}>
            <div>
              <span style={{ fontFamily: "monospace" }}>{a.codigo}</span>{" "}
              {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
            </div>
            <button onClick={() => agregarArticuloAlCarrito(a)}>Agregar</button>
          </div>
        ))}

        {carrito.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
            <tbody>
              {carrito.map((l, i) => (
                <tr key={i}>
                  <td>{l.descripcion}</td>
                  <td>
                    {l.kind === "repuesto" ? (
                      <input
                        type="number"
                        min={1}
                        value={l.cantidad}
                        onChange={(e) => cambiarCantidad(l.repuestoId, Number(e.target.value) || 1)}
                        style={{ width: 60, padding: 4 }}
                      />
                    ) : (
                      1
                    )}
                  </td>
                  <td>
                    <button onClick={() => quitarDelCarrito(i)}>Quitar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <input
          placeholder="Nota (opcional)"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          style={{ padding: 8, width: "100%", marginTop: 8, marginBottom: 8 }}
        />

        <button onClick={enviarTraslado} disabled={procesando || !sedeDestinoId || carrito.length === 0}>
          Enviar traslado
        </button>
      </section>

      <section>
        <h2 style={{ fontSize: 16 }}>Enviados por mi sede</h2>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>#</th>
              <th>Destino</th>
              <th>Items</th>
              <th>Estado</th>
              <th>Enviado</th>
            </tr>
          </thead>
          <tbody>
            {salientes.map((t) => (
              <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>#{t.numero}</td>
                <td>{nombreSede(t.sede_destino)}</td>
                <td>{t.items.map((i) => `${i.cantidad} x ${i.descripcion}`).join(", ")}</td>
                <td>{t.estado}</td>
                <td>{new Date(t.enviado_en).toLocaleDateString("es-CO")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {salientes.length === 0 && <p>Todavía no se ha enviado ningún traslado.</p>}
      </section>

      {mensaje && <p style={{ color: "#4ade80", marginTop: 16 }}>{mensaje}</p>}
      {error && <p style={{ color: "#ff8080", marginTop: 16 }}>{error}</p>}
      {!miSedeId && <p style={{ opacity: 0.6 }}>Cargando sede…</p>}
    </div>
  );
}
