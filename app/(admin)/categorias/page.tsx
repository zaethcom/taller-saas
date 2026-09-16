"use client";

/**
 * Categorías de producto, para organizar el catálogo y filtrar en
 * /vender (pestañas "Patinetas", "Repuestos", "Accesorios"…). Una
 * categoría se puede asignar a un repuesto o a un artículo al recibirlo
 * -- esta pantalla solo administra el catálogo de nombres.
 *
 * Editar y eliminar (punto 6 del documento de requerimientos): eliminar
 * pide confirmación porque, a diferencia de renombrar, no se puede
 * deshacer -- y si la categoría está en uso, el servidor la rechaza con
 * un mensaje claro en vez de dejar productos huérfanos.
 */
import { useEffect, useState } from "react";
import { Tags, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
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

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

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

  function iniciarEdicion(c: Categoria) {
    setEditandoId(c.id);
    setNombreEditado(c.nombre);
    setError(null);
  }

  async function guardarEdicion(id: string) {
    if (!nombreEditado.trim()) return;
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/categorias/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreEditado.trim() }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo renombrar la categoría");
    } finally {
      setProcesando(null);
    }
  }

  async function eliminar(id: string) {
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setConfirmandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar la categoría");
    } finally {
      setProcesando(null);
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
            <div className="pila" style={{ gap: 0 }}>
              {categorias.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 0",
                    borderTop: "1px solid var(--rule)",
                  }}
                >
                  {editandoId === c.id ? (
                    <>
                      <input
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        autoFocus
                        style={{ flex: 1, maxWidth: 260 }}
                      />
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<Check size={15} strokeWidth={2.2} />}
                        onClick={() => guardarEdicion(c.id)}
                        disabled={procesando === c.id || !nombreEditado.trim()}
                        aria-label="Guardar"
                      />
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<X size={15} strokeWidth={2} />}
                        onClick={() => setEditandoId(null)}
                        aria-label="Cancelar"
                      />
                    </>
                  ) : confirmandoId === c.id ? (
                    <>
                      <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>
                        ¿Eliminar <strong>{c.nombre}</strong>?
                      </span>
                      <Boton
                        variante="peligro"
                        tamano="sm"
                        onClick={() => eliminar(c.id)}
                        disabled={procesando === c.id}
                      >
                        {procesando === c.id ? "Eliminando…" : "Sí, eliminar"}
                      </Boton>
                      <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoId(null)}>
                        Cancelar
                      </Boton>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{c.nombre}</span>
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<Pencil size={14} strokeWidth={2} />}
                        onClick={() => iniciarEdicion(c)}
                        aria-label="Editar"
                      />
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        icono={<Trash2 size={14} strokeWidth={2} />}
                        onClick={() => setConfirmandoId(c.id)}
                        aria-label="Eliminar"
                      />
                    </>
                  )}
                </div>
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
