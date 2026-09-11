"use client";

/**
 * Recepción de mercancía individualizada: patinetas, teléfonos y demás
 * artículos que llegan de un proveedor para vender -- no un equipo de
 * cliente (eso es /recibir) ni un repuesto a granel (eso es /inventario).
 *
 * El flujo es un bucle a propósito: se registra un artículo, su etiqueta
 * sale a imprimir de inmediato (sin un botón "imprimir" aparte que
 * alguien pueda saltarse), el formulario se limpia y el foco vuelve al
 * primer campo -- listo para el siguiente artículo de la caja, sin tener
 * que tocar el mouse. La lista de "esta sesión" queda visible para que
 * quien recibe pueda contar contra la caja física y notar de inmediato
 * si algo quedó sin registrar.
 */
import { useRef, useState } from "react";

interface ArticuloRegistrado {
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
}

export default function PaginaRecepcionMercancia() {
  const [tipo, setTipo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");

  const [sesion, setSesion] = useState<ArticuloRegistrado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputTipoRef = useRef<HTMLInputElement>(null);

  async function registrar(e: React.FormEvent) {
    e.preventDefault();
    if (!tipo.trim()) return;

    setEnviando(true);
    setError(null);
    try {
      const res = await fetch("/api/inventario/articulos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: tipo.trim(),
          marca: marca.trim() || undefined,
          modelo: modelo.trim() || undefined,
          numeroSerie: numeroSerie.trim() || undefined,
          costo: costo ? Number(costo) : undefined,
          precioVenta: precioVenta ? Number(precioVenta) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const { articulo } = await res.json();

      setSesion((s) => [{ codigo: articulo.codigo, tipo: tipo.trim(), marca: marca.trim(), modelo: modelo.trim() }, ...s]);

      // Limpiar y volver el foco al primer campo -- listo para el
      // siguiente artículo de la caja sin tocar el mouse.
      setTipo("");
      setMarca("");
      setModelo("");
      setNumeroSerie("");
      setCosto("");
      setPrecioVenta("");
      inputTipoRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el artículo");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div>
      <h1>Recepción de mercancía</h1>
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        Un artículo a la vez: al registrar, la etiqueta sale a imprimir sola. Pégala en el
        artículo y sigue con el siguiente -- el foco vuelve aquí solo.
      </p>

      <form onSubmit={registrar} style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 420 }}>
        <input
          ref={inputTipoRef}
          placeholder="Tipo (patineta, celular, accesorio…)"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          style={{ padding: 8 }}
          autoFocus
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} style={{ padding: 8, flex: 1 }} />
          <input placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} style={{ padding: 8, flex: 1 }} />
        </div>
        <input
          placeholder="Número de serie / IMEI (opcional)"
          value={numeroSerie}
          onChange={(e) => setNumeroSerie(e.target.value)}
          style={{ padding: 8 }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="number"
            placeholder="Costo"
            value={costo}
            onChange={(e) => setCosto(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
          <input
            type="number"
            placeholder="Precio de venta"
            value={precioVenta}
            onChange={(e) => setPrecioVenta(e.target.value)}
            style={{ padding: 8, flex: 1 }}
          />
        </div>
        <button type="submit" disabled={enviando || !tipo.trim()}>
          {enviando ? "Registrando…" : "Registrar e imprimir etiqueta"}
        </button>
      </form>

      {error && <p style={{ color: "#ff8080", marginTop: 12 }}>{error}</p>}

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 16 }}>
          Recibido en esta sesión: {sesion.length} {sesion.length === 1 ? "unidad" : "unidades"}
        </h2>
        {sesion.length === 0 ? (
          <p style={{ opacity: 0.6 }}>Todavía no has registrado nada.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {sesion.map((a) => (
                <tr key={a.codigo} style={{ borderBottom: "1px solid #223038" }}>
                  <td style={{ fontFamily: "monospace" }}>{a.codigo}</td>
                  <td>{[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
