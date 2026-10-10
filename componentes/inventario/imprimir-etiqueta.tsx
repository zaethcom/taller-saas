"use client";

/**
 * Botón de impresora en la tarjeta de un repuesto o artículo de
 * /inventario: vuelve a sacar su código de barras (o lo saca por primera
 * vez) por la etiquetadora de la sede, con las copias que se pidan. Las
 * copias se piden en un panel que tapa la tarjeta, como el ajuste de
 * cantidad, para no robarle espacio a la foto. Ver /api/inventario/etiqueta.
 */
import { useEffect, useState } from "react";
import { Check, Printer, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Campo, Aviso } from "@/componentes/ui/campo";

type Producto = { repuestoId: string } | { articuloId: string };

export function ImprimirEtiqueta(props: Producto) {
  const [abierto, setAbierto] = useState(false);
  const [copias, setCopias] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviada, setEnviada] = useState(false);

  // La palomita de "enviada" se va sola.
  useEffect(() => {
    if (!enviada) return;
    const t = setTimeout(() => setEnviada(false), 2500);
    return () => clearTimeout(t);
  }, [enviada]);

  async function imprimir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/inventario/etiqueta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...props, copias: Number(copias) }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "no se pudo imprimir");
      setAbierto(false);
      setCopias("1");
      setEnviada(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo imprimir");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        className="boton-icono-tarjeta"
        onClick={() => {
          setAbierto(true);
          setError(null);
        }}
        title={enviada ? "Etiqueta enviada a la impresora" : "Imprimir etiqueta"}
        aria-label="Imprimir etiqueta"
        style={enviada ? { color: "var(--ok)", borderColor: "var(--ok)" } : undefined}
      >
        {enviada ? <Check size={13} strokeWidth={2.4} /> : <Printer size={13} strokeWidth={2} />}
      </button>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "var(--surface)",
        borderRadius: "var(--r-md)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700 }}>Imprimir etiqueta</span>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      <form onSubmit={imprimir} className="pila" style={{ gap: 8, flex: 1 }}>
        <Campo etiqueta="Copias">
          <input
            type="number"
            min={1}
            max={100}
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            className="cifra"
            autoFocus
          />
        </Campo>
        {error && (
          <Aviso tono="peligro">
            <span style={{ fontSize: 12 }}>{error}</span>
          </Aviso>
        )}
        <Boton type="submit" variante="primario" tamano="sm" disabled={enviando} icono={<Printer size={14} strokeWidth={2} />}>
          {enviando ? "Enviando…" : "Imprimir"}
        </Boton>
      </form>
    </div>
  );
}
