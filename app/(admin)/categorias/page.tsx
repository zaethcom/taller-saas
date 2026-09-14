"use client";

/**
 * Categorías de producto, para organizar el catálogo y filtrar en
 * /vender (pestañas "Patinetas", "Repuestos", "Accesorios"…). Una
 * categoría se puede asignar a un repuesto o a un artículo al recibirlo
 * -- esta pantalla solo administra el catálogo de nombres.
 */
import { useEffect, useState } from "react";
import { Tags, Plus } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Categoria {
  id: string;
  nombre: string;
}

export default function PaginaCategorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch("/api/categorias");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar las categorías");
      setCategorias(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las categorías");
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!nombre.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/categorias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNombre("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la categoría");
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<Tags size={24} strokeWidth={2} />}
        titulo="Categorías"
        descripcion="Son las pestañas con las que caja filtra el catálogo al vender."
      />

      <div className="pila">
        <Tarjeta>
          {categorias.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Todavía no hay categorías.</p>
          ) : (
            <div className="fila" style={{ gap: 8 }}>
              {categorias.map((c) => (
                <Etiqueta key={c.id} tono="neutro">
                  {c.nombre}
                </Etiqueta>
              ))}
            </div>
          )}
        </Tarjeta>

        <Tarjeta>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <Campo etiqueta="Nueva categoría">
              <div className="fila" style={{ gap: 8, flexWrap: "nowrap" }}>
                <input
                  placeholder="Ej. Patinetas, Repuestos, Accesorios…"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
                <Boton type="submit" variante="primario" icono={<Plus size={17} strokeWidth={2.2} />} disabled={!nombre.trim()}>
                  Agregar
                </Boton>
              </div>
            </Campo>
          </form>
        </Tarjeta>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
