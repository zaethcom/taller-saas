"use client";

/**
 * «Compras» en Vender: el cliente pide algo que no hay y se le encarga.
 * Va a la misma lista de Compras que lo que piden las órdenes, pero con
 * el nombre y el teléfono de a quién hay que traérselo en vez del
 * número de orden (POST /api/repuesto-solicitud, lib/compras/encargo.ts).
 * Si el carrito ya tiene un cliente, se usa ese.
 */
import { useEffect, useState } from "react";
import { Check, ShoppingBag } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { VentanaError } from "@/componentes/ui/ventana-error";
import type { ClienteVenta } from "./cliente-venta";

export function EncargoCompras({ cliente }: { cliente: ClienteVenta | null }) {
  const [descripcion, setDescripcion] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [prioridad, setPrioridad] = useState("normal");
  const [nombre, setNombre] = useState(cliente?.nombre ?? "");
  const [telefono, setTelefono] = useState(cliente?.telefono ?? "");
  const [guardando, setGuardando] = useState(false);
  const [listo, setListo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // El cliente elegido en el carrito llena los datos si están vacíos.
  useEffect(() => {
    if (!cliente) return;
    setNombre((n) => n || cliente.nombre);
    setTelefono((t) => t || cliente.telefono || "");
  }, [cliente]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setListo(null);
    try {
      const res = await fetch("/api/repuesto-solicitud", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion,
          cantidad: Number(cantidad) || 1,
          prioridad,
          clienteId: cliente?.id && cliente.nombre === nombre.trim() ? cliente.id : null,
          clienteNombre: nombre,
          clienteTelefono: telefono,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setListo(`${descripcion.trim()} quedó en Compras para ${nombre.trim()} (${telefono.trim()}).`);
      setDescripcion("");
      setCantidad("1");
      setPrioridad("normal");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo agregar a Compras");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 style={{ fontSize: 16, marginBottom: 4 }}>Encargo para un cliente</h2>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
        Lo que el cliente pide y no hay. Va a Compras con su nombre y teléfono para saber a quién traérselo.
      </p>
      <form
        className="pila"
        style={{ gap: 12 }}
        onSubmit={(e) => {
          e.preventDefault();
          guardar();
        }}
      >
        <Campo etiqueta="Qué hay que traer">
          <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej. Pantalla Samsung A12" autoFocus />
        </Campo>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          <Campo etiqueta="Cantidad">
            <input type="number" min={1} inputMode="numeric" className="cifra" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
          </Campo>
          <Campo etiqueta="Prioridad">
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </Campo>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Campo etiqueta="Nombre del cliente">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" className="cifra" autoComplete="off" />
          </Campo>
        </div>
        <div>
          <Boton
            type="submit"
            variante="primario"
            icono={<ShoppingBag size={17} strokeWidth={2} />}
            disabled={guardando || !descripcion.trim() || !nombre.trim() || !telefono.trim()}
          >
            {guardando ? "Guardando…" : "Agregar a compras"}
          </Boton>
        </div>
        {listo && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {listo}
          </Aviso>
        )}
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </form>
    </Tarjeta>
  );
}
