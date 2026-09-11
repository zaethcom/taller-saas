"use client";

/**
 * Venta de mostrador. Dos maneras de agregar algo al carrito: un
 * repuesto/accesorio a granel (con cantidad) o un artículo
 * individualizado -- patineta, teléfono -- que se vende de a una unidad
 * y, al confirmar, queda 'vendido' para siempre (no una cantidad que
 * baja, una unidad concreta que sale del inventario).
 */
import { useEffect, useState } from "react";
import { FotoProducto } from "@/componentes/ui/foto-producto";

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

  const [buscarRepuesto, setBuscarRepuesto] = useState("");
  const [resultadosRepuesto, setResultadosRepuesto] = useState<Repuesto[]>([]);
  const [buscarArticulo, setBuscarArticulo] = useState("");
  const [resultadosArticulo, setResultadosArticulo] = useState<Articulo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");

  const total = carrito.reduce((s, l) => s + (l.kind === "repuesto" ? l.cantidad : 1) * l.precioUnit, 0);
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

  function quitar(i: number) {
    setCarrito((c) => c.filter((_, idx) => idx !== i));
  }

  async function confirmarVenta() {
    setEnviando(true);
    setMensaje(null);
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
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo registrar la venta");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1>Vender</h1>

      {categorias.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setCategoriaId("")} style={{ fontWeight: categoriaId === "" ? 700 : 400 }}>
            Todos
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaId(c.id)}
              style={{ fontWeight: categoriaId === c.id ? 700 : 400 }}
            >
              {c.nombre}
            </button>
          ))}
        </div>
      )}

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Buscar repuesto o accesorio por código o descripción"
            value={buscarRepuesto}
            onChange={(e) => setBuscarRepuesto(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarRepuestos}>Buscar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {resultadosRepuesto.map((r) => (
            <div key={r.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 8 }}>
              <FotoProducto tipo="repuesto" id={r.id} imagenUrl={r.imagenUrl} alto={80} editable={false} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{r.descripcion}</div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>{r.existenciaAqui} en esta sede</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmt(r.precioVenta)}</div>
              <button
                onClick={() => agregarRepuesto(r)}
                disabled={r.existenciaAqui <= 0}
                style={{ width: "100%", marginTop: 6 }}
              >
                Agregar
              </button>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            placeholder="Buscar artículo por código (ART-000123), marca o modelo"
            value={buscarArticulo}
            onChange={(e) => setBuscarArticulo(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <button onClick={buscarArticulos}>Buscar</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {resultadosArticulo.map((a) => (
            <div key={a.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 8 }}>
              <FotoProducto tipo="articulo" id={a.id} imagenUrl={a.imagen_url} alto={80} editable={false} />
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>
                {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "monospace" }}>{a.codigo}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmt(a.precio_venta)}</div>
              <button onClick={() => agregarArticulo(a)} style={{ width: "100%", marginTop: 6 }}>
                Agregar
              </button>
            </div>
          ))}
        </div>
      </section>

      {carrito.length === 0 ? (
        <p>El carrito está vacío.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {carrito.map((l, i) => (
              <tr key={i}>
                <td>{l.kind === "articulo" ? `${l.codigo} ${l.descripcion}` : l.descripcion}</td>
                <td>{l.kind === "repuesto" ? l.cantidad : 1}</td>
                <td>{fmt(l.precioUnit)}</td>
                <td>{fmt((l.kind === "repuesto" ? l.cantidad : 1) * l.precioUnit)}</td>
                <td>
                  <button onClick={() => quitar(i)}>Quitar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p style={{ fontSize: 22, fontWeight: 700 }}>Total: {fmt(total)}</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {metodos.map((m) => (
          <button
            key={m.id}
            onClick={() => setMetodoPagoId(m.id)}
            style={{ fontWeight: metodoPagoId === m.id ? 700 : 400 }}
          >
            {m.nombre}
          </button>
        ))}
      </div>

      {metodo?.es_efectivo && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Toca las denominaciones recibidas:</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
            {DENOMINACIONES.map((d) => (
              <button key={d} onClick={() => setMontoRecibido((m) => m + d)}>
                {fmt(d)}
              </button>
            ))}
            <button onClick={() => setMontoRecibido(0)}>Reiniciar</button>
          </div>
          <p>Recibido: {fmt(montoRecibido)}</p>
          <p style={{ fontWeight: 700, color: cambio < 0 ? "#c0392b" : "#2e7d32" }}>
            {cambio < 0 ? `Falta ${fmt(-cambio)}` : `Cambio: ${fmt(cambio)}`}
          </p>
        </div>
      )}

      <button
        disabled={carrito.length === 0 || enviando || !metodoPagoId || (metodo?.es_efectivo && cambio < 0)}
        onClick={confirmarVenta}
      >
        Cobrar {fmt(total)}
      </button>
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
}
