"use client";

/**
 * "En venta" / "No en venta" de un repuesto, en su tarjeta de
 * /inventario. Un repuesto que no está en venta sigue en el catálogo
 * (se consume en órdenes, sale en informes) pero no aparece en /vender.
 * La marca es del repuesto, no de la sede: cambiarla en una tarjeta la
 * cambia en las tarjetas de las otras sedes.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function InterruptorEnVenta({ repuestoId, enVenta }: { repuestoId: string; enVenta: boolean }) {
  const router = useRouter();
  const [valor, setValor] = useState(enVenta);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevo = e.target.checked;
    setValor(nuevo);
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/repuestos/${repuestoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enVenta: nuevo }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "no se pudo guardar");
      router.refresh();
    } catch (err) {
      setValor(!nuevo);
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div>
      <label
        style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)", cursor: "pointer" }}
      >
        <input type="checkbox" checked={valor} onChange={cambiar} disabled={guardando} />
        {valor ? "En venta" : "No en venta"}
      </label>
      {error && <div style={{ fontSize: 11, color: "var(--peligro)", marginTop: 2 }}>{error}</div>}
    </div>
  );
}
