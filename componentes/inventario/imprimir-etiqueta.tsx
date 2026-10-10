"use client";

/**
 * "Imprimir etiqueta" en la tarjeta de un repuesto o artículo de
 * /inventario: vuelve a sacar su código de barras (o lo saca por primera
 * vez) por la etiquetadora de la sede, con las copias que se pidan. Ver
 * /api/inventario/etiqueta.
 */
import { useState } from "react";
import { Printer } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

type Producto = { repuestoId: string } | { articuloId: string };

export function ImprimirEtiqueta(props: Producto) {
  const [abierto, setAbierto] = useState(false);
  const [copias, setCopias] = useState("1");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);

  async function imprimir(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/inventario/etiqueta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...props, copias: Number(copias) }),
      });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "no se pudo imprimir");
      setMensaje({ tono: "ok", texto: `Enviada: ${datos.copias} × ${datos.codigo}` });
      setAbierto(false);
      setCopias("1");
    } catch (err) {
      setMensaje({ tono: "error", texto: err instanceof Error ? err.message : "No se pudo imprimir" });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      {abierto ? (
        <form onSubmit={imprimir} className="fila" style={{ gap: 6 }}>
          <input
            type="number"
            min={1}
            max={100}
            value={copias}
            onChange={(e) => setCopias(e.target.value)}
            className="cifra"
            aria-label="Copias"
            title="Copias"
            style={{ width: 56 }}
            autoFocus
          />
          <Boton type="submit" variante="primario" tamano="sm" disabled={enviando}>
            {enviando ? "Enviando…" : "Imprimir"}
          </Boton>
          <Boton type="button" variante="fantasma" tamano="sm" onClick={() => setAbierto(false)}>
            Cancelar
          </Boton>
        </form>
      ) : (
        <Boton
          type="button"
          variante="contorno"
          tamano="sm"
          icono={<Printer size={14} strokeWidth={2} />}
          onClick={() => {
            setAbierto(true);
            setMensaje(null);
          }}
        >
          Imprimir etiqueta
        </Boton>
      )}
      {mensaje && (
        <div
          className="cifra"
          style={{ fontSize: 11, marginTop: 4, color: mensaje.tono === "ok" ? "var(--ink-3)" : "var(--peligro)" }}
        >
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}
