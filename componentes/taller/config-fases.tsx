"use client";

/**
 * La sección «Fases de las órdenes» de /configuracion
 * (0050_fase_orden.sql): las fases que la empresa usa DENTRO de cada
 * estado de lib/estados.ts. Los estados no se configuran -- son los
 * mismos siete para todas las empresas --; las fases sí.
 *
 * Desactivar es la forma normal de quitar una fase: las órdenes que ya
 * la tienen la conservan, solo deja de ofrecerse en el hub. Las dos
 * plantillas se pueden cargar más de una vez sin duplicar nada.
 */
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { moverFase, PLANTILLAS, type FaseOrden, type NombrePlantilla } from "@/lib/fases";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Aviso } from "@/componentes/ui/campo";
import { Etiqueta } from "@/componentes/ui/etiqueta";

const ESTADOS = Object.keys(ETIQUETA_ESTADO) as Estado[];

export function ConfigFases() {
  const [fases, setFases] = useState<FaseOrden[]>([]);
  const [nuevas, setNuevas] = useState<Partial<Record<Estado, string>>>({});
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/fases");
    const datos = await res.json();
    if (!res.ok) {
      setError(datos.error ?? "No se pudieron cargar las fases");
      return;
    }
    setFases(datos);
  }

  useEffect(() => {
    cargar();
  }, []);

  /** Una o varias llamadas seguidas, y recargar la lista al final. */
  async function pedir(llamadas: { url: string; init: RequestInit }[], exito: string | null) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      for (const { url, init } of llamadas) {
        const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
        const datos = await res.json();
        if (!res.ok) throw new Error(datos.error ?? "No se pudo completar");
        if (datos.agregadas !== undefined) {
          exito = datos.agregadas === 0 ? "La plantilla ya estaba cargada completa." : `Se agregaron ${datos.agregadas} fases.`;
        }
      }
      if (exito) setMensaje(exito);
      await cargar();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  function patch(id: string, cambios: Partial<Pick<FaseOrden, "nombre" | "posicion" | "activo">>) {
    return { url: `/api/fases/${id}`, init: { method: "PATCH", body: JSON.stringify(cambios) } };
  }

  async function agregar(estado: Estado) {
    const nombre = nuevas[estado]?.trim();
    if (!nombre) return;
    const ok = await pedir(
      [{ url: "/api/fases", init: { method: "POST", body: JSON.stringify({ estado, nombre }) } }],
      `Fase "${nombre}" agregada.`,
    );
    if (ok) setNuevas({ ...nuevas, [estado]: "" });
  }

  function cargarPlantilla(plantilla: NombrePlantilla) {
    pedir([{ url: "/api/fases/plantilla", init: { method: "POST", body: JSON.stringify({ plantilla }) } }], null);
  }

  function mover(id: string, direccion: "arriba" | "abajo") {
    const cambios = moverFase(fases, id, direccion);
    if (cambios.length > 0) pedir(cambios.map((c) => patch(c.id, { posicion: c.posicion })), null);
  }

  return (
    <Tarjeta>
      <h2 style={{ marginBottom: 6 }}>Fases de las órdenes</h2>
      <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 14 }}>
        Pasos más finos dentro de cada estado, como «Microsoldadura» o «Prueba de ruta». Al entrar a un estado, la orden
        arranca en su primera fase activa; el técnico la cambia desde la orden. Los estados y sus reglas no cambian.
      </p>

      <div className="fila" style={{ gap: 8, marginBottom: 16 }}>
        {(Object.keys(PLANTILLAS) as NombrePlantilla[]).map((p) => (
          <Boton key={p} tamano="sm" disabled={ocupado} onClick={() => cargarPlantilla(p)}>
            Cargar plantilla: {PLANTILLAS[p].etiqueta}
          </Boton>
        ))}
      </div>

      <div className="pila" style={{ gap: 16 }}>
        {ESTADOS.map((estado) => {
          const delEstado = fases.filter((f) => f.estado === estado).sort((a, b) => a.posicion - b.posicion);
          return (
            <div key={estado}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{ETIQUETA_ESTADO[estado]}</div>
              {delEstado.length === 0 && (
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 2 }}>Sin fases.</div>
              )}
              {delEstado.map((f, i) => (
                <div
                  key={f.id}
                  className="fila"
                  style={{ padding: "6px 0", borderBottom: "1px solid var(--rule)", gap: 6, flexWrap: "nowrap" }}
                >
                  <input
                    key={`${f.id}-${f.nombre}`}
                    defaultValue={f.nombre}
                    aria-label={`Nombre de la fase ${f.nombre}`}
                    disabled={ocupado}
                    onBlur={(e) => {
                      const nombre = e.target.value.trim();
                      if (!nombre) e.target.value = f.nombre;
                      else if (nombre !== f.nombre) pedir([patch(f.id, { nombre })], "Fase renombrada.");
                    }}
                    style={{ flex: 1, minWidth: 0, opacity: f.activo ? 1 : 0.55 }}
                  />
                  {!f.activo && <Etiqueta tono="neutro">Inactiva</Etiqueta>}
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    icono={<ArrowUp size={16} />}
                    aria-label="Subir"
                    disabled={ocupado || i === 0}
                    onClick={() => mover(f.id, "arriba")}
                  />
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    icono={<ArrowDown size={16} />}
                    aria-label="Bajar"
                    disabled={ocupado || i === delEstado.length - 1}
                    onClick={() => mover(f.id, "abajo")}
                  />
                  <Boton
                    tamano="sm"
                    variante="fantasma"
                    disabled={ocupado}
                    onClick={() =>
                      pedir([patch(f.id, { activo: !f.activo })], f.activo ? `"${f.nombre}" desactivada.` : `"${f.nombre}" activada.`)
                    }
                  >
                    {f.activo ? "Desactivar" : "Activar"}
                  </Boton>
                </div>
              ))}
              <div className="fila" style={{ gap: 6, marginTop: 8, flexWrap: "nowrap" }}>
                <input
                  placeholder="Nueva fase"
                  aria-label={`Nueva fase en ${ETIQUETA_ESTADO[estado]}`}
                  value={nuevas[estado] ?? ""}
                  onChange={(e) => setNuevas({ ...nuevas, [estado]: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") agregar(estado);
                  }}
                  style={{ flex: 1, minWidth: 0 }}
                />
                <Boton
                  tamano="sm"
                  icono={<Plus size={16} />}
                  disabled={ocupado || !nuevas[estado]?.trim()}
                  onClick={() => agregar(estado)}
                >
                  Agregar
                </Boton>
              </div>
            </div>
          );
        })}
      </div>

      {(mensaje || error) && (
        <div style={{ marginTop: 14 }}>
          {mensaje && <Aviso tono="ok">{mensaje}</Aviso>}
          {error && <Aviso tono="peligro">{error}</Aviso>}
        </div>
      )}
    </Tarjeta>
  );
}
