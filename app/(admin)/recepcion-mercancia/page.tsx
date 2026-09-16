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
 *
 * Por eso las dos mitades van lado a lado y no una debajo de la otra:
 * el conteo tiene que verse sin desplazar mientras se teclea.
 */
import { useEffect, useRef, useState } from "react";
import { PackagePlus, Printer } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface ArticuloRegistrado {
  codigo: string;
  tipo: string;
  marca: string;
  modelo: string;
}

interface Categoria {
  id: string;
  nombre: string;
}

export default function PaginaRecepcionMercancia() {
  const [tipo, setTipo] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [numeroSerie, setNumeroSerie] = useState("");
  const [costo, setCosto] = useState("");
  const [precioVenta, setPrecioVenta] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");

  const [sesion, setSesion] = useState<ArticuloRegistrado[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputTipoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch(() => setCategorias([]));
  }, []);

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
          categoriaId: categoriaId || undefined,
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
      <style>{`
        .recepcion{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:18px;align-items:start;}
        @media (max-width:900px){.recepcion{grid-template-columns:minmax(0,1fr);}}
      `}</style>

      <TituloPantalla
        icono={<PackagePlus size={24} strokeWidth={2} />}
        titulo="Recepción de mercancía"
        descripcion="Un artículo a la vez: al registrar, la etiqueta sale a imprimir sola y el foco vuelve aquí."
      />

      <div className="recepcion">
        <Tarjeta>
          <form onSubmit={registrar} className="pila" style={{ gap: 12 }}>
            <Campo etiqueta="Tipo">
              <input
                ref={inputTipoRef}
                placeholder="patineta, celular, accesorio…"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                autoFocus
              />
            </Campo>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Marca">
                <input placeholder="Marca" value={marca} onChange={(e) => setMarca(e.target.value)} />
              </Campo>
              <Campo etiqueta="Modelo">
                <input placeholder="Modelo" value={modelo} onChange={(e) => setModelo(e.target.value)} />
              </Campo>
            </div>

            <Campo etiqueta="Número de serie / IMEI" ayuda="Opcional. Si viene, queda impreso en la etiqueta.">
              <input
                placeholder="Opcional"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                className="cifra"
              />
            </Campo>

            <Campo etiqueta="Categoría">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Costo">
                <input
                  type="number"
                  placeholder="0"
                  value={costo}
                  onChange={(e) => setCosto(e.target.value)}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Precio de venta">
                <input
                  type="number"
                  placeholder="0"
                  value={precioVenta}
                  onChange={(e) => setPrecioVenta(e.target.value)}
                  className="cifra"
                />
              </Campo>
            </div>

            <div>
              <Boton
                type="submit"
                variante="primario"
                tamano="lg"
                icono={<Printer size={19} strokeWidth={2} />}
                disabled={enviando || !tipo.trim()}
              >
                {enviando ? "Registrando…" : "Registrar e imprimir etiqueta"}
              </Boton>
            </div>

            {error && <Aviso tono="peligro">{error}</Aviso>}
          </form>
        </Tarjeta>

        <Tarjeta relleno={false} style={{ overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--rule)" }}>
            <div className="campo-etiqueta" style={{ margin: 0 }}>
              Recibido en esta sesión
            </div>
            <div className="cifra" style={{ fontSize: 30, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {sesion.length}
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)" }}>
                {" "}
                {sesion.length === 1 ? "unidad" : "unidades"}
              </span>
            </div>
          </div>

          {sesion.length === 0 ? (
            <p style={{ margin: 0, padding: "18px 16px", fontSize: 13, color: "var(--ink-3)" }}>
              Todavía no has registrado nada.
            </p>
          ) : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 420, overflowY: "auto" }}>
              {sesion.map((a) => (
                <li
                  key={a.codigo}
                  style={{ padding: "11px 16px", borderBottom: "1px solid var(--rule)", fontSize: 13 }}
                >
                  <div className="cifra" style={{ fontWeight: 800 }}>
                    {a.codigo}
                  </div>
                  <div style={{ color: "var(--ink-2)" }}>
                    {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </div>
  );
}
