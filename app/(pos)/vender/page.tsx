"use client";

/**
 * Venta de mostrador. El carrito local se resuelve al confirmar: crea
 * la venta, descuenta inventario (vía consumir_repuesto en la base) y
 * encola el recibo -- que puede o no abrir el cajón, según el medio de
 * pago.
 */
import { useState } from "react";

interface LineaCarrito {
  repuestoId: string;
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaVender() {
  const [carrito, setCarrito] = useState<LineaCarrito[]>([]);
  const [medioPago, setMedioPago] = useState<"efectivo" | "transferencia" | "tarjeta">("efectivo");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const total = carrito.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);

  async function confirmarVenta() {
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: carrito, medioPago }),
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
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        Conectar aquí el lector de códigos: cada lectura agrega la línea al carrito. El lector se
        comporta como un teclado, así que basta con un input enfocado.
      </p>

      {carrito.length === 0 ? (
        <p>El carrito está vacío.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            {carrito.map((l, i) => (
              <tr key={i}>
                <td>{l.descripcion}</td>
                <td>{l.cantidad}</td>
                <td>{fmt(l.precioUnit)}</td>
                <td>{fmt(l.cantidad * l.precioUnit)}</td>
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
