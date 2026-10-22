"use client";

/**
 * Los tipos de empresa (0053): los estándares que cambian según el
 * negocio -- tipo de equipo que propone Recibir equipo y categorías
 * iniciales de inventario. Se asignan
 * desde la ficha de cada empresa o al crearla.
 *
 * Editar un tipo no cambia a las empresas que ya lo tienen: lo que se
 * les copió es suyo. Para pasarles lo nuevo se vuelve a aplicar desde
 * su ficha, y eso solo agrega lo que les falte.
 */
import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { TIPOS_EQUIPO, lineas } from "@/lib/tipos-empresa";
import type { TipoNegocio } from "@/lib/configuracion";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface Tipo {
  id: string;
  nombre: string;
  tipo_equipo: TipoNegocio;
  categorias: string[];
  activo: boolean;
  empresas: number;
}

interface Borrador {
  nombre: string;
  tipo_equipo: TipoNegocio;
  categorias: string;
}

const VACIO: Borrador = {
  nombre: "",
  tipo_equipo: "otro",
  categorias: "",
};

function aBorrador(t: Tipo): Borrador {
  return {
    nombre: t.nombre,
    tipo_equipo: t.tipo_equipo,
    categorias: t.categorias.join("\n"),
  };
}

function aCuerpo(b: Borrador) {
  return {
    nombre: b.nombre,
    tipo_equipo: b.tipo_equipo,
    categorias: lineas(b.categorias),
  };
}

async function enviar(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
  return data;
}

function EditorTipo({
  borrador,
  onChange,
}: {
  borrador: Borrador;
  onChange: (b: Borrador) => void;
}) {
  return (
    <div className="pila" style={{ gap: 12 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
        }}
      >
        <Campo etiqueta="Nombre">
          <input
            placeholder="Ej. Consolas"
            value={borrador.nombre}
            onChange={(e) => onChange({ ...borrador, nombre: e.target.value })}
          />
        </Campo>
        <Campo etiqueta="Equipo que propone Recibir equipo">
          <select
            value={borrador.tipo_equipo}
            onChange={(e) =>
              onChange({
                ...borrador,
                tipo_equipo: e.target.value as TipoNegocio,
              })
            }
          >
            {TIPOS_EQUIPO.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo
        etiqueta="Categorías iniciales de inventario"
        ayuda="Una por línea."
      >
        <textarea
          rows={5}
          placeholder="Ej. Pantallas"
          value={borrador.categorias}
          onChange={(e) =>
            onChange({ ...borrador, categorias: e.target.value })
          }
        />
      </Campo>
    </div>
  );
}

export default function PaginaTiposEmpresa() {
  const [tipos, setTipos] = useState<Tipo[]>([]);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [nuevo, setNuevo] = useState<Borrador>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  async function cargar() {
    try {
      const res = await fetch("/api/superadmin/tipos");
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.error ?? "No se pudieron cargar los tipos");
      const lista: Tipo[] = Array.isArray(data) ? data : [];
      setTipos(lista);
      setBorradores(Object.fromEntries(lista.map((t) => [t.id, aBorrador(t)])));
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudieron cargar los tipos",
      );
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
  }, []);

  async function accion(
    clave: string,
    hacer: () => Promise<unknown>,
    exito: string,
  ) {
    setProcesando(clave);
    setError(null);
    setMensaje(null);
    try {
      await hacer();
      setMensaje(exito);
      setConfirmando(null);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setProcesando(null);
    }
  }

  if (cargando) {
    return (
      <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>
        Cargando…
      </Tarjeta>
    );
  }

  return (
    <div>
      <TituloPantalla
        titulo="Tipos de empresa"
        descripcion="Los estándares que cambian según el negocio. Se asignan desde la ficha de cada empresa."
      />

      <div className="pila">
        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        <VentanaError mensaje={error} onCerrar={() => setError(null)} />

        {tipos.map((t) => {
          const borrador = borradores[t.id] ?? aBorrador(t);
          return (
            <Tarjeta key={t.id}>
              <div
                className="fila"
                style={{
                  gap: 8,
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <h2 style={{ margin: 0 }}>{t.nombre}</h2>
                <Etiqueta tono={t.activo ? "ok" : "neutro"} punto>
                  {t.activo ? "Activo" : "Inactivo"}
                </Etiqueta>
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {t.empresas} empresa{t.empresas === 1 ? "" : "s"}
                </span>
              </div>
              <EditorTipo
                borrador={borrador}
                onChange={(b) =>
                  setBorradores((prev) => ({ ...prev, [t.id]: b }))
                }
              />
              <div
                className="fila"
                style={{
                  gap: 8,
                  marginTop: 14,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Boton
                  variante="primario"
                  icono={<Check size={16} strokeWidth={2.2} />}
                  disabled={procesando === t.id || !borrador.nombre.trim()}
                  onClick={() =>
                    accion(
                      t.id,
                      () =>
                        enviar(
                          `/api/superadmin/tipos/${t.id}`,
                          "PATCH",
                          aCuerpo(borrador),
                        ),
                      `Tipo "${borrador.nombre.trim()}" guardado.`,
                    )
                  }
                >
                  {procesando === t.id ? "Guardando…" : "Guardar"}
                </Boton>
                <Boton
                  variante="contorno"
                  disabled={procesando === t.id}
                  onClick={() =>
                    accion(
                      t.id,
                      () =>
                        enviar(`/api/superadmin/tipos/${t.id}`, "PATCH", {
                          activo: !t.activo,
                        }),
                      t.activo
                        ? `"${t.nombre}" ya no se ofrece al crear empresas.`
                        : `"${t.nombre}" activo otra vez.`,
                    )
                  }
                >
                  {t.activo ? "Desactivar" : "Activar"}
                </Boton>
                {t.empresas === 0 &&
                  (confirmando === t.id ? (
                    <>
                      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
                        ¿Eliminar <strong>{t.nombre}</strong>?
                      </span>
                      <Boton
                        variante="peligro"
                        tamano="sm"
                        disabled={procesando === t.id}
                        onClick={() =>
                          accion(
                            t.id,
                            () =>
                              enviar(`/api/superadmin/tipos/${t.id}`, "DELETE"),
                            `"${t.nombre}" eliminado.`,
                          )
                        }
                      >
                        Sí, eliminar
                      </Boton>
                      <Boton
                        variante="fantasma"
                        tamano="sm"
                        onClick={() => setConfirmando(null)}
                      >
                        Cancelar
                      </Boton>
                    </>
                  ) : (
                    <Boton
                      variante="fantasma"
                      icono={<Trash2 size={14} strokeWidth={2} />}
                      onClick={() => setConfirmando(t.id)}
                    >
                      Eliminar
                    </Boton>
                  ))}
              </div>
            </Tarjeta>
          );
        })}

        <Tarjeta>
          <h2 style={{ marginBottom: 14 }}>Crear tipo nuevo</h2>
          <EditorTipo borrador={nuevo} onChange={setNuevo} />
          <div style={{ marginTop: 14 }}>
            <Boton
              variante="primario"
              icono={<Plus size={17} strokeWidth={2.2} />}
              disabled={procesando === "nuevo" || !nuevo.nombre.trim()}
              onClick={() =>
                accion(
                  "nuevo",
                  async () => {
                    await enviar(
                      "/api/superadmin/tipos",
                      "POST",
                      aCuerpo(nuevo),
                    );
                    setNuevo(VACIO);
                  },
                  `Tipo "${nuevo.nombre.trim()}" creado.`,
                )
              }
            >
              {procesando === "nuevo" ? "Creando…" : "Crear tipo"}
            </Boton>
          </div>
        </Tarjeta>
      </div>
    </div>
  );
}
