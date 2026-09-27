"use client";

/**
 * Catálogo de métodos de pago de la empresa. Reemplaza los tres valores
 * fijos que antes vivían en un check constraint de la base -- ahora
 * cualquier empresa puede agregar Nequi, DaviPlata, Bre-B... y
 * activar/desactivar los que ya no use, sin tocar código.
 */
import { useEffect, useState } from "react";
import { CreditCard, Plus, Banknote, Pencil, Check, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo: boolean;
  activo: boolean;
}

export default function PaginaMetodosPago() {
  const [metodos, setMetodos] = useState<Metodo[]>([]);
  const [nombre, setNombre] = useState("");
  const [esEfectivo, setEsEfectivo] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [esEfectivoEditado, setEsEfectivoEditado] = useState(false);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch("/api/metodos-pago?todos=1");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudieron cargar los métodos de pago");
      setMetodos(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los métodos de pago");
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
      const res = await fetch("/api/metodos-pago", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), esEfectivo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setNombre("");
      setEsEfectivo(false);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear el método");
    }
  }

  async function alternarActivo(m: Metodo) {
    await fetch(`/api/metodos-pago/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !m.activo }),
    });
    await cargar();
  }

  function iniciarEdicion(m: Metodo) {
    setEditandoId(m.id);
    setNombreEditado(m.nombre);
    setEsEfectivoEditado(m.es_efectivo);
    setError(null);
  }

  async function guardarEdicion(id: string) {
    if (!nombreEditado.trim()) return;
    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/metodos-pago/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreEditado.trim(), esEfectivo: esEfectivoEditado }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditandoId(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el método");
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
        icono={<CreditCard size={24} strokeWidth={2} />}
        titulo="Métodos de pago"
        descripcion="Solo el marcado como efectivo abre el cajón y cuenta en el cierre de caja."
      />

      <div className="pila">
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Es efectivo</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {metodos.map((m) =>
                editandoId === m.id ? (
                  <tr key={m.id}>
                    <td>
                      <input
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        autoFocus
                        style={{ maxWidth: 200 }}
                      />
                    </td>
                    <td>
                      <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", whiteSpace: "nowrap" }}>
                        <input
                          type="checkbox"
                          checked={esEfectivoEditado}
                          onChange={(e) => setEsEfectivoEditado(e.target.checked)}
                          style={{ width: 18, height: 18, padding: 0, accentColor: "var(--accent)" }}
                        />
                        Efectivo
                      </label>
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
                    <td>
                      {m.es_efectivo ? (
                        <Etiqueta tono="marca" icono={<Banknote size={14} strokeWidth={2} />}>
                          Efectivo
                        </Etiqueta>
                      ) : (
                        <span style={{ color: "var(--ink-3)" }}>No</span>
                      )}
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

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Agregar método</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto", gap: 12, alignItems: "end" }}>
              <Campo etiqueta="Nombre">
                <input
                  placeholder="Ej. Nequi, DaviPlata, Bre-B…"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                />
              </Campo>
              <label style={{ display: "flex", alignItems: "center", gap: 9, height: 44, fontSize: 14, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={esEfectivo}
                  onChange={(e) => setEsEfectivo(e.target.checked)}
                  style={{ width: 20, height: 20, padding: 0, accentColor: "var(--accent)" }}
                />
                Es efectivo
              </label>
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
