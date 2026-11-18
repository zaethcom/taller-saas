"use client";

/**
 * Configuración → Taller → Tipos de equipo: la lista del desplegable de
 * Recibir equipo. Se agrega, se renombra y se quita; cada cambio guarda
 * la lista entera en /api/configuracion, que le pone valor a los nuevos.
 *
 * Renombrar no toca lo ya recibido (ver lib/tipos-equipo.ts) y quitar
 * pide confirmar: el tipo deja de ofrecerse pero los equipos que lo
 * tienen lo conservan.
 */
import { useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { MAX_LARGO_ETIQUETA, MAX_TIPOS_EQUIPO, type TipoEquipo } from "@/lib/tipos-equipo";

export function TiposEquipo({
  tipos,
  onGuardado,
  onError,
}: {
  tipos: TipoEquipo[];
  onGuardado: (tipos: TipoEquipo[]) => void;
  onError: (mensaje: string) => void;
}) {
  const [nuevo, setNuevo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nombreEditado, setNombreEditado] = useState("");
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(lista: { valor?: string; etiqueta: string }[]): Promise<boolean> {
    setGuardando(true);
    try {
      const res = await fetch("/api/configuracion", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiposEquipo: lista }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "No se pudo guardar");
      onGuardado(j.tiposEquipo ?? lista);
      return true;
    } catch (e) {
      onError(e instanceof Error ? e.message : "No se pudo guardar");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function repetido(nombre: string, menos?: string) {
    const clave = nombre.trim().toLocaleLowerCase("es");
    return tipos.some((t) => t.valor !== menos && t.etiqueta.toLocaleLowerCase("es") === clave);
  }

  async function agregar() {
    const nombre = nuevo.trim();
    if (!nombre) return;
    if (repetido(nombre)) return onError(`"${nombre}" ya está en la lista`);
    if (await guardar([...tipos, { etiqueta: nombre }])) setNuevo("");
  }

  async function renombrar(valor: string) {
    const nombre = nombreEditado.trim();
    if (!nombre) return;
    if (repetido(nombre, valor)) return onError(`"${nombre}" ya está en la lista`);
    if (await guardar(tipos.map((t) => (t.valor === valor ? { ...t, etiqueta: nombre } : t)))) setEditando(null);
  }

  async function quitar(valor: string) {
    if (await guardar(tipos.filter((t) => t.valor !== valor))) setConfirmando(null);
  }

  return (
    <Tarjeta>
      <h2 style={{ marginBottom: 4 }}>Tipos de equipo</h2>
      <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 12 }}>
        Las opciones de Recibir equipo. Renombrar o quitar uno no cambia los equipos ya recibidos.
      </p>

      <div className="pila" style={{ gap: 2 }}>
        {tipos.map((t) => (
          <div key={t.valor} className="fila" style={{ gap: 6, flexWrap: "nowrap", minHeight: 40 }}>
            {editando === t.valor ? (
              <form
                className="fila"
                style={{ gap: 6, flexWrap: "nowrap", flex: 1 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  renombrar(t.valor);
                }}
              >
                <input
                  autoFocus
                  aria-label="Nuevo nombre"
                  value={nombreEditado}
                  maxLength={MAX_LARGO_ETIQUETA}
                  onChange={(e) => setNombreEditado(e.target.value)}
                />
                <Boton
                  type="submit"
                  variante="fantasma"
                  tamano="sm"
                  icono={<Check size={15} strokeWidth={2.2} />}
                  disabled={guardando || !nombreEditado.trim()}
                  aria-label="Guardar"
                />
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<X size={15} strokeWidth={2} />}
                  onClick={() => setEditando(null)}
                  aria-label="Cancelar"
                />
              </form>
            ) : confirmando === t.valor ? (
              <>
                <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>
                  ¿Quitar <strong>{t.etiqueta}</strong>?
                </span>
                <Boton variante="peligro" tamano="sm" onClick={() => quitar(t.valor)} disabled={guardando}>
                  {guardando ? "Quitando…" : "Sí, quitar"}
                </Boton>
                <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmando(null)}>
                  Cancelar
                </Boton>
              </>
            ) : (
              <>
                <span style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{t.etiqueta}</span>
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Pencil size={14} strokeWidth={2} />}
                  onClick={() => {
                    setConfirmando(null);
                    setEditando(t.valor);
                    setNombreEditado(t.etiqueta);
                  }}
                  aria-label={`Renombrar ${t.etiqueta}`}
                />
                <Boton
                  variante="fantasma"
                  tamano="sm"
                  icono={<Trash2 size={14} strokeWidth={2} />}
                  onClick={() => {
                    setEditando(null);
                    setConfirmando(t.valor);
                  }}
                  disabled={tipos.length <= 1}
                  title={tipos.length <= 1 ? "Debe quedar al menos un tipo" : undefined}
                  aria-label={`Quitar ${t.etiqueta}`}
                />
              </>
            )}
          </div>
        ))}
      </div>

      {tipos.length < MAX_TIPOS_EQUIPO && (
        <form
          className="fila"
          style={{ gap: 8, flexWrap: "nowrap", marginTop: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            agregar();
          }}
        >
          <input
            aria-label="Nuevo tipo de equipo"
            placeholder="Ej. Tablet, Consola, Bicicleta…"
            value={nuevo}
            maxLength={MAX_LARGO_ETIQUETA}
            onChange={(e) => setNuevo(e.target.value)}
          />
          <Boton type="submit" variante="primario" icono={<Plus size={17} strokeWidth={2.2} />} disabled={guardando || !nuevo.trim()}>
            Agregar
          </Boton>
        </form>
      )}
    </Tarjeta>
  );
}
