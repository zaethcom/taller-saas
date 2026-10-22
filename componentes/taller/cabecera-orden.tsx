"use client";

/**
 * El contexto de la orden en una franja delgada arriba de cada pantalla
 * de etapa (diagnóstico, cotización, evidencia, repuestos): de dónde se
 * viene, número, estado, equipo, cliente y total. Copiar el enlace y
 * WhatsApp viven en la ficha de la orden (/orden/[id]); aquí no se
 * repiten.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import type { Estado } from "@/lib/estados";

interface OrdenContexto {
  numero: number;
  estado: Estado;
  cliente_nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  total: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export function CabeceraOrden({ ordenId, anterior }: { ordenId: string; anterior?: { href: string; etiqueta: string } }) {
  const [orden, setOrden] = useState<OrdenContexto | null>(null);

  useEffect(() => {
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => r.json())
      .then(setOrden)
      .catch(() => {});
  }, [ordenId]);

  return (
    <div
      className="fila"
      style={{
        gap: 10,
        alignItems: "center",
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: "1px solid var(--rule)",
      }}
    >
      {anterior && (
        <Link
          href={anterior.href}
          className="btn btn-contorno btn-sm"
          style={{ textDecoration: "none" }}
          aria-label={`Volver a ${anterior.etiqueta}`}
        >
          <ArrowLeft size={15} strokeWidth={2} />
          <span className="ocultar-movil">{anterior.etiqueta}</span>
        </Link>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fila" style={{ gap: 8, alignItems: "center" }}>
          <Link href={`/orden/${ordenId}`} className="cifra" style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>
            {orden ? `Orden #${orden.numero}` : "Orden"}
          </Link>
          {orden && <EstadoOrden estado={orden.estado} />}
        </div>
        {orden && (
          <p style={{ margin: "2px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            {[orden.marca, orden.modelo].filter(Boolean).join(" ") || orden.tipo} · {orden.cliente_nombre}
          </p>
        )}
      </div>
      {orden && Number(orden.total) > 0 && (
        <span className="cifra" style={{ fontSize: 16, fontWeight: 800, flexShrink: 0 }}>
          {fmt(Number(orden.total))}
        </span>
      )}
    </div>
  );
}
