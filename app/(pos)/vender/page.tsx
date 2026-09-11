"use client";

/**
 * Venta de mostrador. Dos maneras de agregar algo al carrito: un
 * repuesto/accesorio a granel (con cantidad) o un artículo
 * individualizado -- patineta, teléfono -- que se vende de a una unidad
 * y, al confirmar, queda 'vendido' para siempre (no una cantidad que
 * baja, una unidad concreta que sale del inventario).
 */
import { useState } from "react";

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
  existenciaAqui: number;
}

interface Articulo {
  id: string;
  codigo: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  precio_venta: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaVender() {
  const [carrito, setCarrito] = useState<Linea[]>([]);
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const [buscarRepuesto, setBuscarRepuesto] = useState("");
  const [resultadosRepuesto, setResultadosRepuesto] = useState<Repuesto[]>([]);
  const [buscarArticulo, setBuscarArticulo] = useState("");
  const [resultadosArticulo, setResultadosArticulo] = useState<Articulo[]>([]);

  const total = carrito.reduce((s, l) => s + (l.kind === "repuesto" ? l.cantidad : 1) * l.precioUnit, 0);

  async function buscarRepuestos() {
    const res = await fetch(`/api/repuestos?buscar=${encodeURIComponent(buscarRepuesto)}`);
    setResultadosRepuesto(await res.json());
  }

  async function buscarArticulos() {
    const res = await fetch(`/api/inventario/articulos?disponibles=1&buscar=${encodeURIComponent(buscarArticulo)}`);
    setResultadosArticulo(await res.json());
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
          medioPago,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setCarrito([]);
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
        {resultadosRepuesto.map((r) => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <div>
              {r.descripcion} <span style={{ opacity: 0.6, fontSize: 12 }}>({r.existenciaAqui} en esta sede)</span>
            </div>
            <button onClick={() => agregarRepuesto(r)} disabled={r.existenciaAqui <= 0}>
              Agregar
            </button>
          </div>
        ))}
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
        {resultadosArticulo.map((a) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
            <div>
              <span style={{ fontFamily: "monospace" }}>{a.codigo}</span>{" "}
              {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo} · {fmt(a.precio_venta)}
            </div>
            <button onClick={() => agregarArticulo(a)}>Agregar</button>
          </div>
        ))}
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
        {(["efectivo", "transferencia", "tarjeta"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMedioPago(m)}
            style={{ fontWeight: medioPago === m ? 700 : 400 }}
          >
            {m}
          </button>
        ))}
      </div>

      <button disabled={carrito.length === 0 || enviando} onClick={confirmarVenta}>
        Cobrar {fmt(total)}
      </button>
      {mensaje && <p>{mensaje}</p>}
    </div>
  );
}
