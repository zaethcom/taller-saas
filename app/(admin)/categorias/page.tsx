"use client";

/**
 * Categorías de producto, para organizar el catálogo y filtrar en
 * /vender (pestañas "Patinetas", "Repuestos", "Accesorios"…). Una
 * categoría se puede asignar a un repuesto o a un artículo al recibirlo
 * -- esta pantalla solo administra el catálogo de nombres.
 */
import { useEffect, useState } from "react";

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
      <h1>Categorías</h1>
      <ul>
        {categorias.map((c) => (
          <li key={c.id}>{c.nombre}</li>
        ))}
      </ul>
      {categorias.length === 0 && <p style={{ opacity: 0.6 }}>Todavía no hay categorías.</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input
          placeholder="Ej. Patinetas, Repuestos, Accesorios…"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          style={{ padding: 8 }}
        />
        <button onClick={crear} disabled={!nombre.trim()}>
          Agregar
        </button>
      </div>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
