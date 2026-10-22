"use client";

/**
 * «Últimas recepciones» en Recibir equipo: las 5 órdenes más recientes
 * de la sede, cada una con «Reimprimir» y «Corregir». Es para el caso
 * de todos los días: se entrega el comprobante, el cliente dice que el
 * teléfono quedó mal, se corrige y sale el papel de nuevo, sin ir a
 * buscar la orden. Vive en una ventana para no cargar el formulario.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { History, Pencil, Printer } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Ventana } from "@/componentes/ui/ventana";

interface Recepcion {
  id: string;
  numero: number;
  estado: string;
  abiertaEn: string;
  cliente: string;
  equipo: string;
}

/** Encola de nuevo el comprobante de recepción de una orden; lanza con el mensaje del servidor si falla. */
export async function reimprimirComprobante(ordenId: string): Promise<void> {
  const res = await fetch(`/api/ordenes/${ordenId}/comprobante`, { method: "POST" });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error ?? "No se pudo reimprimir el recibo");
  }
}

/** A dónde va «Corregir»: el formulario de edición, que vuelve aquí y ofrece guardar y reimprimir. */
export function rutaCorregir(ordenId: string, volver: string) {
  return `/ordenes/${ordenId}/editar?reimprimir=1&volver=${encodeURIComponent(volver)}`;
}

function cuando(iso: string) {
  const d = new Date(iso);
  const hoy = new Date().toDateString() === d.toDateString();
  return hoy
    ? d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
}

export function UltimasRecepciones() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [lista, setLista] = useState<Recepcion[] | null>(null);
  const [aviso, setAviso] = useState<{ id: string; texto: string } | null>(null);

  function abrir() {
    setAbierta(true);
    setAviso(null);
    fetch("/api/ordenes/recientes")
      .then((r) => (r.ok ? r.json() : { ordenes: [] }))
      .then((j) => setLista(Array.isArray(j.ordenes) ? j.ordenes : []))
      .catch(() => setLista([]));
  }

  async function reimprimir(id: string) {
    setAviso({ id, texto: "Enviando…" });
    try {
      await reimprimirComprobante(id);
      setAviso({ id, texto: "Recibo enviado a la impresora de esta sede." });
    } catch (e) {
      setAviso({ id, texto: e instanceof Error ? e.message : "No se pudo reimprimir el recibo" });
    }
  }

  return (
    <>
      <Boton variante="fantasma" tamano="sm" icono={<History size={16} strokeWidth={2} />} onClick={abrir}>
        Últimas recepciones
      </Boton>

      {abierta && (
        <Ventana titulo="Últimas recepciones" onCerrar={() => setAbierta(false)}>
          {lista === null ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
          ) : lista.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Todavía no hay equipos recibidos en esta sede.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {lista.map((o) => (
                <div key={o.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                        <strong className="cifra">#{o.numero}</strong>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.cliente}</span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {o.equipo} · <span className="cifra">{cuando(o.abiertaEn)}</span>
                      </div>
                    </div>
                    <Boton
                      variante="contorno"
                      tamano="sm"
                      icono={<Printer size={15} strokeWidth={2} />}
                      onClick={() => reimprimir(o.id)}
                      aria-label={`Reimprimir recibo de la orden #${o.numero}`}
                      title="Reimprimir recibo"
                    />
                    {o.estado !== "entregada" && (
                      <Boton
                        variante="contorno"
                        tamano="sm"
                        icono={<Pencil size={15} strokeWidth={2} />}
                        onClick={() => router.push(rutaCorregir(o.id, "/recibir"))}
                        aria-label={`Corregir la orden #${o.numero}`}
                        title="Corregir y reimprimir"
                      />
                    )}
                  </div>
                  {aviso?.id === o.id && (
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-2)" }}>{aviso.texto}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Ventana>
      )}
    </>
  );
}
