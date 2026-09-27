"use client";

/**
 * Catálogo de servicios del taller (punto 7 del documento de
 * requerimientos): diagnóstico, cambio de pastillas, mantenimiento
 * general... para que el técnico elija de una lista al cotizar en vez
 * de escribir cada línea a mano. Mismo patrón de editar/eliminar que
 * /categorias, con los campos propios de un servicio.
 */
import { useEffect, useState } from "react";
import { Wrench, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Servicio {
  id: string;
  codigo: string | null;
  nombre: string;
  descripcion: string | null;
  precio: number;
  costo_estimado: number | null;
  tiempo_estimado_minutos: number | null;
  activo: boolean;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

interface Form {
  codigo: string;
  nombre: string;
  descripcion: string;
  precio: string;
  costoEstimado: string;
  tiempoEstimadoMinutos: string;
}

const FORM_VACIO: Form = { codigo: "", nombre: "", descripcion: "", precio: "", costoEstimado: "", tiempoEstimadoMinutos: "" };

export default function PaginaServicios() {
  const [servicios, setServicios] = useState<Servicio[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nuevo, setNuevo] = useState<Form>(FORM_VACIO);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editado, setEditado] = useState<Form>(FORM_VACIO);
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/servicios?todos=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setServicios(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los servicios");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!nuevo.nombre.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: nuevo.codigo.trim() || undefined,
          nombre: nuevo.nombre.trim(),
          descripcion: nuevo.descripcion.trim() || undefined,
          precio: nuevo.precio ? Number(nuevo.precio) : undefined,
          costoEstimado: nuevo.costoEstimado ? Number(nuevo.costoEstimado) : undefined,
          tiempoEstimadoMinutos: nuevo.tiempoEstimadoMinutos ? Number(nuevo.tiempoEstimadoMinutos) : undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNuevo(FORM_VACIO);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el servicio");
    }
  }

  function iniciarEdicion(s: Servicio) {
    setEditandoId(s.id);
    setEditado({
      codigo: s.codigo ?? "",
      nombre: s.nombre,
      descripcion: s.descripcion ?? "",
      precio: String(s.precio),
      costoEstimado: s.costo_estimado != null ? String(s.costo_estimado) : "",
      tiempoEstimadoMinutos: s.tiempo_estimado_minutos != null ? String(s.tiempo_estimado_minutos) : "",
    });
    setError(null);
  }

  async function guardarEdicion(id: string) {
    if (!editado.nombre.trim()) return;
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/servicios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          codigo: editado.codigo.trim() || null,
          nombre: editado.nombre.trim(),
          descripcion: editado.descripcion.trim() || null,
          precio: Number(editado.precio) || 0,
          costoEstimado: editado.costoEstimado ? Number(editado.costoEstimado) : null,
          tiempoEstimadoMinutos: editado.tiempoEstimadoMinutos ? Number(editado.tiempoEstimadoMinutos) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el servicio");
    } finally {
      setProcesando(null);
    }
  }

  async function alternarActivo(s: Servicio) {
    await fetch(`/api/servicios/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !s.activo }),
    });
    await cargar();
  }

  async function eliminar(id: string) {
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/servicios/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setConfirmandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el servicio");
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<Wrench size={24} strokeWidth={2} />}
        titulo="Servicios"
        descripcion="El catálogo de trabajos que ofrece el taller, para elegir al cotizar en vez de escribirlos a mano."
      />

      <div className="pila">
        {servicios.length === 0 ? (
          <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)", borderStyle: "dashed" }}>
            Todavía no hay servicios en el catálogo.
          </Tarjeta>
        ) : (
          <TarjetaTabla>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Código</th>
                  <th>Precio</th>
                  <th>Tiempo est.</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {servicios.map((s) =>
                  editandoId === s.id ? (
                    <tr key={s.id}>
                      <td>
                        <input
                          value={editado.nombre}
                          onChange={(e) => setEditado({ ...editado, nombre: e.target.value })}
                          autoFocus
                          style={{ maxWidth: 220 }}
                        />
                      </td>
                      <td>
                        <input
                          value={editado.codigo}
                          onChange={(e) => setEditado({ ...editado, codigo: e.target.value })}
                          className="cifra"
                          style={{ maxWidth: 100 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editado.precio}
                          onChange={(e) => setEditado({ ...editado, precio: e.target.value })}
                          className="cifra"
                          style={{ maxWidth: 110 }}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={editado.tiempoEstimadoMinutos}
                          onChange={(e) => setEditado({ ...editado, tiempoEstimadoMinutos: e.target.value })}
                          className="cifra"
                          placeholder="min"
                          style={{ maxWidth: 90 }}
                        />
                      </td>
                      <td>
                        <Etiqueta tono={s.activo ? "ok" : "neutro"} punto>
                          {s.activo ? "Activo" : "Inactivo"}
                        </Etiqueta>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Check size={15} strokeWidth={2.2} />}
                          onClick={() => guardarEdicion(s.id)}
                          disabled={procesando === s.id || !editado.nombre.trim()}
                          aria-label="Guardar"
                        />
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<X size={15} strokeWidth={2} />}
                          onClick={() => setEditandoId(null)}
                          aria-label="Cancelar"
                        />
                      </td>
                    </tr>
                  ) : confirmandoId === s.id ? (
                    <tr key={s.id}>
                      <td colSpan={5} style={{ color: "var(--ink-2)", fontSize: 13 }}>
                        ¿Eliminar <strong>{s.nombre}</strong>?
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Boton variante="peligro" tamano="sm" onClick={() => eliminar(s.id)} disabled={procesando === s.id}>
                          {procesando === s.id ? "Eliminando…" : "Sí, eliminar"}
                        </Boton>
                        <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmandoId(null)}>
                          Cancelar
                        </Boton>
                      </td>
                    </tr>
                  ) : (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>
                        {s.nombre}
                        {s.descripcion && (
                          <div style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 400 }}>{s.descripcion}</div>
                        )}
                      </td>
                      <td className="cifra" style={{ color: "var(--ink-2)" }}>
                        {s.codigo ?? "—"}
                      </td>
                      <td className="cifra">{fmt(s.precio)}</td>
                      <td className="cifra" style={{ color: "var(--ink-2)" }}>
                        {s.tiempo_estimado_minutos ? `${s.tiempo_estimado_minutos} min` : "—"}
                      </td>
                      <td>
                        <Etiqueta tono={s.activo ? "ok" : "neutro"} punto>
                          {s.activo ? "Activo" : "Inactivo"}
                        </Etiqueta>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Pencil size={14} strokeWidth={2} />}
                          onClick={() => iniciarEdicion(s)}
                          aria-label="Editar"
                        />
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Trash2 size={14} strokeWidth={2} />}
                          onClick={() => setConfirmandoId(s.id)}
                          aria-label="Eliminar"
                        />
                        <Boton variante={s.activo ? "contorno" : "primario"} tamano="sm" onClick={() => alternarActivo(s)}>
                          {s.activo ? "Desactivar" : "Activar"}
                        </Boton>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </TarjetaTabla>
        )}

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Agregar servicio</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
            className="pila"
            style={{ gap: 12 }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Nombre">
                <input
                  placeholder="Ej. Cambio de pastillas"
                  value={nuevo.nombre}
                  onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Código">
                <input
                  placeholder="Opcional"
                  value={nuevo.codigo}
                  onChange={(e) => setNuevo({ ...nuevo, codigo: e.target.value })}
                  className="cifra"
                />
              </Campo>
            </div>
            <Campo etiqueta="Descripción">
              <input
                placeholder="Opcional"
                value={nuevo.descripcion}
                onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })}
              />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Precio">
                <input
                  type="number"
                  placeholder="0"
                  value={nuevo.precio}
                  onChange={(e) => setNuevo({ ...nuevo, precio: e.target.value })}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Costo estimado">
                <input
                  type="number"
                  placeholder="Opcional"
                  value={nuevo.costoEstimado}
                  onChange={(e) => setNuevo({ ...nuevo, costoEstimado: e.target.value })}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Tiempo estimado (min)">
                <input
                  type="number"
                  placeholder="Opcional"
                  value={nuevo.tiempoEstimadoMinutos}
                  onChange={(e) => setNuevo({ ...nuevo, tiempoEstimadoMinutos: e.target.value })}
                  className="cifra"
                />
              </Campo>
            </div>
            <div>
              <Boton type="submit" variante="primario" icono={<Plus size={17} strokeWidth={2.2} />} disabled={!nuevo.nombre.trim()}>
                Agregar
              </Boton>
            </div>
          </form>
        </Tarjeta>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
