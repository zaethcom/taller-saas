"use client";

/**
 * El contexto de la orden, repetido en la cabecera de cada pantalla de
 * etapa (diagnóstico, cotización, evidencia, repuestos) -- antes solo
 * la pantalla-hub (/orden/[id]) mostraba número/estado/cliente/equipo;
 * las demás eran ciegas a ese contexto. No se dibuja un QR gráfico:
 * el que ya va impreso en la etiqueta física cumple ese rol; aquí basta
 * el código de seguimiento copiable.
 *
 * `anterior`/`siguiente` son opcionales: solo los tres pasos
 * secuenciales (diagnóstico → cotización → repuestos) los usan --
 * evidencia queda accesible desde el hub en cualquier momento, no es
 * parte de esa secuencia.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Copy, Check } from "lucide-react";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { Boton } from "@/componentes/ui/boton";
import type { Estado } from "@/lib/estados";

interface OrdenContexto {
  numero: number;
  estado: Estado;
  cliente_nombre: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  token_publico: string;
}

interface Paso {
  href: string;
  etiqueta: string;
}

export function CabeceraOrden({
  ordenId,
  anterior,
  siguiente,
}: {
  ordenId: string;
  anterior?: Paso;
  siguiente?: Paso;
}) {
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenContexto | null>(null);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    fetch(`/api/ordenes/${ordenId}`)
      .then((r) => r.json())
      .then(setOrden)
      .catch(() => {});
  }, [ordenId]);

  async function copiarEnlace() {
    if (!orden) return;
    const url = `${window.location.origin}/seguimiento/${orden.token_publico}`;
    await navigator.clipboard.writeText(url);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <Tarjeta style={{ marginBottom: 16 }}>
      <div className="fila" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div className="fila" style={{ gap: 8, alignItems: "center" }}>
            <span className="cifra" style={{ fontWeight: 800, fontSize: 15 }}>
              {orden ? `Orden #${orden.numero}` : "Orden"}
            </span>
            {orden && <EstadoOrden estado={orden.estado} />}
          </div>
          {orden && (
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              {[orden.marca, orden.modelo].filter(Boolean).join(" ") || orden.tipo} · {orden.cliente_nombre}
            </p>
          )}
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={copiado ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2} />}
          onClick={copiarEnlace}
          disabled={!orden}
        >
          {copiado ? "Copiado" : "Copiar enlace"}
        </Boton>
      </div>

      {(anterior || siguiente) && (
        <div className="fila" style={{ justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--rule)" }}>
          {anterior ? (
            <Link href={anterior.href} className="btn btn-contorno btn-sm" style={{ textDecoration: "none" }}>
              <ArrowLeft size={15} strokeWidth={2} />
              {anterior.etiqueta}
            </Link>
          ) : (
            <span />
          )}
          {siguiente && (
            <Boton
              variante="primario"
              tamano="sm"
              icono={<ArrowRight size={15} strokeWidth={2} />}
              onClick={() => router.push(siguiente.href)}
            >
              {siguiente.etiqueta}
            </Boton>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
