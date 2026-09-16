"use client";

/**
 * La pantalla de la orden desde la app del técnico: la fase actual y
 * nada más. Muestra el historial completo del equipo -- esta pantalla,
 * llegada por el QR, es donde se cumple la primera de las dos promesas
 * del proyecto.
 *
 * Los tres accesos (evidencia, diagnóstico, repuestos) son tarjetas y
 * no enlaces de texto: se tocan con guantes, con una sola mano.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Camera, Wrench, Package, ChevronRight, ArrowRight } from "lucide-react";
import { ETIQUETA_ESTADO, siguientesEstados, type Estado } from "@/lib/estados";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Aviso } from "@/componentes/ui/campo";
import { EstadoOrden } from "@/componentes/ui/estado-orden";

interface OrdenTecnico {
  id: string;
  numero: number;
  estado: Estado;
  motivo: string;
  serial: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  cliente_nombre: string;
}

function Acceso({ href, icono, titulo, descripcion }: { href: string; icono: React.ReactNode; titulo: string; descripcion: string }) {
  return (
    <Link
      href={href}
      className="tarjeta"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 13,
        padding: 14,
        color: "var(--ink)",
        textDecoration: "none",
      }}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          borderRadius: "var(--r-md)",
          background: "var(--accent-suave)",
          color: "var(--accent)",
          flexShrink: 0,
        }}
      >
        {icono}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{titulo}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--ink-2)" }}>{descripcion}</span>
      </span>
      <ChevronRight size={19} strokeWidth={2} color="var(--ink-3)" aria-hidden />
    </Link>
  );
}

export default function PaginaOrdenTecnico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [orden, setOrden] = useState<OrdenTecnico | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ordenes/${id}`)
      .then((r) => r.json())
      .then(setOrden)
      .catch(() => setError("No se pudo cargar la orden"));
  }, [id]);

  async function avanzar(aEstado: Estado) {
    setCambiando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/transicion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aEstado }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.refresh();
      setOrden((prev) => (prev ? { ...prev, estado: aEstado } : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado");
    } finally {
      setCambiando(false);
    }
  }

  if (!orden) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div className="pila">
      <Tarjeta>
        <div className="fila" style={{ justifyContent: "space-between", marginBottom: 12 }}>
          <h1 className="cifra">Orden #{orden.numero}</h1>
          <EstadoOrden estado={orden.estado} />
        </div>
        <h2 style={{ fontSize: 17 }}>
          {orden.marca} {orden.modelo}
        </h2>
        <p className="cifra" style={{ margin: "4px 0 14px", fontSize: 13, color: "var(--ink-2)" }}>
          {orden.tipo} · {orden.serial}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div>
            <span style={{ color: "var(--ink-3)" }}>Cliente · </span>
            <strong>{orden.cliente_nombre}</strong>
          </div>
          <div>
            <span style={{ color: "var(--ink-3)" }}>Motivo · </span>
            {orden.motivo}
          </div>
        </div>
      </Tarjeta>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Acceso
          href={`/orden/${id}/evidencia`}
          icono={<Camera size={21} strokeWidth={2} />}
          titulo="Evidencia"
          descripcion="Fotos y videos del equipo"
        />
        <Acceso
          href={`/orden/${id}/diagnostico`}
          icono={<Wrench size={21} strokeWidth={2} />}
          titulo="Diagnóstico"
          descripcion="Qué se encontró, y de ahí a la cotización"
        />
        <Acceso
          href={`/orden/${id}/repuestos`}
          icono={<Package size={21} strokeWidth={2} />}
          titulo="Repuestos"
          descripcion="Consumir del inventario o marcar faltante"
        />
      </div>

      {siguientesEstados(orden.estado).length > 0 && (
        <Tarjeta>
          <div className="campo-etiqueta">Avanzar a</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {siguientesEstados(orden.estado).map((e) => (
              <Boton
                key={e}
                variante="primario"
                tamano="lg"
                ancho
                icono={<ArrowRight size={19} strokeWidth={2} />}
                disabled={cambiando}
                onClick={() => avanzar(e)}
              >
                {ETIQUETA_ESTADO[e]}
              </Boton>
            ))}
          </div>
        </Tarjeta>
      )}

      {error && <Aviso tono="peligro">{error}</Aviso>}
    </div>
  );
}
