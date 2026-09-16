"use client";

/**
 * Catálogo de mano de obra del taller (punto 8 del documento de
 * requerimientos): precio fijo por tipo de trabajo, igual que un
 * servicio -- no una tarifa por hora. Mismo patrón que
 * /metodos-pago: listar, crear, editar inline, activar/desactivar.
 */
import { useEffect, useState } from "react";
import { HardHat, Plus, Pencil, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface ManoObra {
  id: string;
  nombre: string;
  precio: number;
  activo: boolean;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaginaManoObra() {
  const [items, setItems] = useState<ManoObra[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [precio, setPrecio] = useState("");

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [precioEditado, setPrecioEditado] = useState("");
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    try {
      const res = await fetch("/api/mano-obra?todos=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la mano de obra");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function crear() {
    if (!nombre.trim()) return;
    setError(null);
    try {
      const res = await fetch("/api/mano-obra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), precio: precio ? Number(precio) : undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNombre("");
      setPrecio("");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el ítem");
    }
  }

  function iniciarEdicion(m: ManoObra) {
    setEditandoId(m.id);
    setNombreEditado(m.nombre);
    setPrecioEditado(String(m.precio));
    setError(null);
  }

  async function guardarEdicion(id: string) {
    if (!nombreEditado.trim()) return;
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/mano-obra/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreEditado.trim(), precio: Number(precioEditado) || 0 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setProcesando(null);
    }
  }

  async function alternarActivo(m: ManoObra) {
    await fetch(`/api/mano-obra/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !m.activo }),
    });
    await cargar();
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<HardHat size={24} strokeWidth={2} />}
        titulo="Mano de obra"
        descripcion="Precio fijo por tipo de trabajo -- se agrega a una orden igual que un servicio."
      />

      <div className="pila">
        {items.length === 0 ? (
          <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)", borderStyle: "dashed" }}>
            Todavía no hay ítems de mano de obra.
          </Tarjeta>
        ) : (
          <TarjetaTabla>
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Precio</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((m) =>
                  editandoId === m.id ? (
                    <tr key={m.id}>
                      <td>
                        <input value={nombreEditado} onChange={(e) => setNombreEditado(e.target.value)} autoFocus style={{ maxWidth: 240 }} />
                      </td>
                      <td>
                        <input
                          type="number"
                          value={precioEditado}
                          onChange={(e) => setPrecioEditado(e.target.value)}
                          className="cifra"
                          style={{ maxWidth: 120 }}
                        />
                      </td>
                      <td>
                        <Etiqueta tono={m.activo ? "ok" : "neutro"} punto>
                          {m.activo ? "Activo" : "Inactivo"}
                        </Etiqueta>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Check size={15} strokeWidth={2.2} />}
                          onClick={() => guardarEdicion(m.id)}
                          disabled={procesando === m.id || !nombreEditado.trim()}
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
                  ) : (
                    <tr key={m.id}>
                      <td style={{ fontWeight: 600 }}>{m.nombre}</td>
                      <td className="cifra">{fmt(m.precio)}</td>
                      <td>
                        <Etiqueta tono={m.activo ? "ok" : "neutro"} punto>
                          {m.activo ? "Activo" : "Inactivo"}
                        </Etiqueta>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Boton
                          variante="fantasma"
                          tamano="sm"
                          icono={<Pencil size={14} strokeWidth={2} />}
                          onClick={() => iniciarEdicion(m)}
                          aria-label="Editar"
                        />
                        <Boton variante={m.activo ? "contorno" : "primario"} tamano="sm" onClick={() => alternarActivo(m)}>
                          {m.activo ? "Desactivar" : "Activar"}
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
          <h2 style={{ marginBottom: 12 }}>Agregar ítem</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "end" }}>
              <Campo etiqueta="Nombre">
                <input
                  placeholder="Ej. Mano de obra reparación de frenos"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </Campo>
              <Campo etiqueta="Precio">
                <input type="number" placeholder="0" value={precio} onChange={(e) => setPrecio(e.target.value)} className="cifra" />
              </Campo>
              <Boton type="submit" variante="primario" icono={<Plus size={17} strokeWidth={2.2} />} disabled={!nombre.trim()}>
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
