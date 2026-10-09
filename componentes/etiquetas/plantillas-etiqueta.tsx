"use client";

/**
 * La sección Etiquetas de /configuracion: las plantillas de sticker de
 * la empresa (0046), por uso (equipo recibido, artículo, repuesto).
 * Cada plantilla es una medida de rollo + tipo de código + qué textos
 * lleva + una imagen de fondo opcional; la que está "en uso" es la que
 * imprimen las sedes. Sin ninguna en uso, sale la etiqueta de fábrica.
 *
 * La vista previa la dibuja el servidor (/api/etiquetas/vista-previa)
 * con el mismo código que la impresión real: lo que se ve es lo que sale.
 */
import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { subirFondoEtiqueta } from "@/lib/subir-logo";
import {
  CAMPOS,
  ETIQUETA_DE_FABRICA,
  LIMITES,
  MODELOS,
  USOS,
  type CampoEtiqueta,
  type PlantillaEtiqueta,
  type UsoEtiqueta,
} from "@/lib/etiquetas/plantilla";

/**
 * `usar`: el borrador nace de "Editar" sobre la etiqueta de fábrica --
 * al guardarlo queda en uso de una vez, porque eso es lo que se estaba
 * editando.
 */
type Borrador = Omit<PlantillaEtiqueta, "id" | "activa"> & { id?: string; usar?: boolean };

const CASILLA = { width: 18, height: 18, padding: 0, accentColor: "var(--accent)", cursor: "pointer" } as const;

function borradorDesdeModelo(uso: UsoEtiqueta, modeloId?: string): Borrador {
  const modelo = MODELOS.find((m) => m.id === modeloId) ?? MODELOS.find((m) => m.uso === uso)!;
  return { nombre: "", uso: modelo.uso, ...modelo.diseno, fondoUrl: null, girar: false };
}

function resumen(p: Pick<PlantillaEtiqueta, "anchoMm" | "altoMm" | "codigo">): string {
  return `${p.anchoMm} × ${p.altoMm} mm · ${p.codigo === "qr" ? "QR" : "código de barras"}`;
}

export function PlantillasEtiqueta({ empresaId }: { empresaId: string | null }) {
  const [plantillas, setPlantillas] = useState<PlantillaEtiqueta[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const urlAnterior = useRef<string | null>(null);

  async function cargar() {
    const res = await fetch("/api/etiquetas/plantillas");
    const datos = await res.json();
    if (!res.ok) {
      setError(datos.error ?? "No se pudieron cargar las plantillas");
      return;
    }
    setPlantillas(datos);
  }

  useEffect(() => {
    cargar();
  }, []);

  // Vista previa del borrador, con una pausa corta para no pedir una
  // imagen por cada tecla al escribir las medidas.
  useEffect(() => {
    if (!borrador) return;
    let cancelado = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/etiquetas/vista-previa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(borrador),
        });
        if (cancelado) return;
        if (!res.ok) {
          setAvisos([(await res.json()).error ?? "No se pudo dibujar la vista previa"]);
          return;
        }
        const url = URL.createObjectURL(await res.blob());
        if (urlAnterior.current) URL.revokeObjectURL(urlAnterior.current);
        urlAnterior.current = url;
        setVistaPrevia(url);
        setAvisos(JSON.parse(decodeURIComponent(res.headers.get("X-Avisos") ?? "%5B%5D")));
      } catch {
        if (!cancelado) setAvisos(["No se pudo dibujar la vista previa"]);
      }
    }, 350);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [borrador]);

  async function pedir(url: string, init: RequestInit, exito: string) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo completar");
      setMensaje(exito);
      await cargar();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo completar");
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function guardar() {
    if (!borrador) return;
    const { id, usar, ...datos } = borrador;
    const ok = id
      ? await pedir(`/api/etiquetas/plantillas/${id}`, { method: "PATCH", body: JSON.stringify(datos) }, "Plantilla guardada.")
      : usar
        ? await pedir(
            "/api/etiquetas/plantillas",
            { method: "POST", body: JSON.stringify({ ...datos, activa: true }) },
            "Etiqueta guardada y en uso.",
          )
        : await pedir("/api/etiquetas/plantillas", { method: "POST", body: JSON.stringify(datos) }, "Plantilla creada. Imprima una prueba y póngala en uso.");
    if (ok) setBorrador(null);
  }

  async function subirFondo(archivo: File) {
    if (!empresaId || !borrador) return;
    setSubiendo(true);
    setError(null);
    try {
      const url = await subirFondoEtiqueta(empresaId, archivo);
      setBorrador({ ...borrador, fondoUrl: url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo subir la imagen");
    } finally {
      setSubiendo(false);
    }
  }

  function alternarCampo(campo: CampoEtiqueta, si: boolean) {
    if (!borrador) return;
    const campos = si ? [...borrador.campos, campo] : borrador.campos.filter((c) => c !== campo);
    setBorrador({ ...borrador, campos });
  }

  return (
    <Tarjeta>
      <div className="fila" style={{ justifyContent: "space-between", marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>Etiquetas (stickers)</h2>
        {!borrador && (
          <Boton tamano="sm" icono={<Plus size={16} />} onClick={() => setBorrador(borradorDesdeModelo("orden"))}>
            Nueva plantilla
          </Boton>
        )}
      </div>
      <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 14 }}>
        La medida del sticker, si lleva QR o código de barras y qué textos. La que está en uso es la que imprimen todas las
        sedes; la impresora tiene que estar calibrada para ese mismo rollo.
      </p>

      {!borrador && (
        <div className="pila" style={{ gap: 14 }}>
          {USOS.map((uso) => {
            const delUso = plantillas.filter((p) => p.uso === uso.valor);
            return (
              <div key={uso.valor}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{uso.etiqueta}</div>
                {!delUso.some((p) => p.activa) && (
                  <div
                    className="fila"
                    style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)", justifyContent: "space-between" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="fila" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>De fábrica</span>
                        <Etiqueta tono="ok">En uso</Etiqueta>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{ETIQUETA_DE_FABRICA[uso.valor]}</div>
                    </div>
                    <Boton
                      tamano="sm"
                      variante="contorno"
                      icono={<Pencil size={16} />}
                      disabled={ocupado}
                      onClick={() =>
                        setBorrador({ ...borradorDesdeModelo(uso.valor), nombre: `${uso.etiqueta} (editada)`, usar: true })
                      }
                    >
                      Editar
                    </Boton>
                  </div>
                )}
                {delUso.map((p) => (
                  <div
                    key={p.id}
                    className="fila"
                    style={{ padding: "8px 0", borderBottom: "1px solid var(--rule)", justifyContent: "space-between" }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div className="fila" style={{ gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>{p.nombre}</span>
                        {p.activa && <Etiqueta tono="ok">En uso</Etiqueta>}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--ink-3)" }}>{resumen(p)}</div>
                    </div>
                    <div className="fila" style={{ gap: 6 }}>
                      {p.activa ? (
                        <Boton
                          tamano="sm"
                          variante="fantasma"
                          disabled={ocupado}
                          onClick={() =>
                            pedir(
                              `/api/etiquetas/plantillas/${p.id}`,
                              { method: "PATCH", body: JSON.stringify({ activa: false }) },
                              "Se volvió a la etiqueta de fábrica.",
                            )
                          }
                        >
                          Dejar de usar
                        </Boton>
                      ) : (
                        <Boton
                          tamano="sm"
                          icono={<Check size={16} />}
                          disabled={ocupado}
                          onClick={() =>
                            pedir(
                              `/api/etiquetas/plantillas/${p.id}`,
                              { method: "PATCH", body: JSON.stringify({ activa: true }) },
                              `"${p.nombre}" quedó en uso.`,
                            )
                          }
                        >
                          Usar
                        </Boton>
                      )}
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono={<Printer size={16} />}
                        aria-label="Imprimir prueba"
                        title="Imprimir prueba en la sede actual"
                        disabled={ocupado}
                        onClick={() =>
                          pedir(`/api/etiquetas/plantillas/${p.id}/prueba`, { method: "POST" }, "Prueba enviada a la impresora de etiquetas.")
                        }
                      />
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono={<Pencil size={16} />}
                        disabled={ocupado}
                        onClick={() => {
                          const { activa: _activa, ...resto } = p;
                          void _activa;
                          setBorrador(resto);
                        }}
                      >
                        Editar
                      </Boton>
                      <Boton
                        tamano="sm"
                        variante="fantasma"
                        icono={<Trash2 size={16} />}
                        aria-label="Eliminar"
                        disabled={ocupado}
                        onClick={() => {
                          if (confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) {
                            pedir(`/api/etiquetas/plantillas/${p.id}`, { method: "DELETE" }, "Plantilla eliminada.");
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {borrador && (
        <div className="pila" style={{ gap: 12 }}>
          {!borrador.id && (
            <Campo etiqueta="Empezar desde un modelo">
              <select
                defaultValue=""
                onChange={(e) => {
                  const modelo = MODELOS.find((m) => m.id === e.target.value);
                  if (modelo) setBorrador({ ...borradorDesdeModelo(modelo.uso, modelo.id), nombre: borrador.nombre || modelo.nombre });
                }}
              >
                <option value="" disabled>
                  Elegir medida…
                </option>
                {MODELOS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          )}

          <Campo etiqueta="Nombre">
            <input
              value={borrador.nombre}
              maxLength={60}
              placeholder="Ej. Rollo 50 × 30"
              onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
            />
          </Campo>

          <Campo etiqueta="Para" ayuda={USOS.find((u) => u.valor === borrador.uso)?.ayuda}>
            <select value={borrador.uso} onChange={(e) => setBorrador({ ...borrador, uso: e.target.value as UsoEtiqueta })}>
              {USOS.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.etiqueta}
                </option>
              ))}
            </select>
          </Campo>

          <div className="fila" style={{ gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 110 }}>
              <Campo etiqueta="Ancho (mm)">
                <input
                  type="number"
                  className="cifra"
                  min={LIMITES.anchoMin}
                  max={LIMITES.anchoMax}
                  step={0.5}
                  value={borrador.anchoMm}
                  onChange={(e) => setBorrador({ ...borrador, anchoMm: Number(e.target.value) })}
                />
              </Campo>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <Campo etiqueta="Alto (mm)">
                <input
                  type="number"
                  className="cifra"
                  min={LIMITES.altoMin}
                  max={LIMITES.altoMax}
                  step={0.5}
                  value={borrador.altoMm}
                  onChange={(e) => setBorrador({ ...borrador, altoMm: Number(e.target.value) })}
                />
              </Campo>
            </div>
            <div style={{ flex: 1, minWidth: 110 }}>
              <Campo etiqueta="Impresora">
                <select
                  value={borrador.dpi}
                  onChange={(e) => setBorrador({ ...borrador, dpi: Number(e.target.value) === 300 ? 300 : 203 })}
                >
                  <option value={203}>203 dpi</option>
                  <option value={300}>300 dpi</option>
                </select>
              </Campo>
            </div>
          </div>

          <div>
            <span className="campo-etiqueta">Código</span>
            <div className="fila" style={{ gap: 8 }}>
              {(["qr", "barras"] as const).map((c) => (
                <Boton
                  key={c}
                  variante={borrador.codigo === c ? "primario" : "contorno"}
                  aria-pressed={borrador.codigo === c}
                  onClick={() => setBorrador({ ...borrador, codigo: c })}
                >
                  {c === "qr" ? "QR" : "Código de barras"}
                </Boton>
              ))}
            </div>
          </div>

          <div>
            <span className="campo-etiqueta">Qué lleva</span>
            <div className="pila" style={{ gap: 6 }}>
              {[...CAMPOS, { valor: "marco" as const, etiqueta: "Marco redondeado" }].map((c) => (
                <label key={c.valor} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    style={CASILLA}
                    checked={borrador.campos.includes(c.valor)}
                    onChange={(e) => alternarCampo(c.valor, e.target.checked)}
                  />
                  {c.etiqueta}
                </label>
              ))}
            </div>
          </div>

          <Campo
            etiqueta="Diseño propio (opcional)"
            ayuda={
              subiendo
                ? "Subiendo…"
                : "Una imagen a la medida del sticker (logo, marco, datos fijos). El código y los textos se dibujan encima: deje ese espacio en blanco."
            }
          >
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={subiendo || !empresaId}
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (archivo) subirFondo(archivo);
              }}
              style={{ height: "auto", padding: 10 }}
            />
          </Campo>
          {borrador.fondoUrl && (
            <div>
              <Boton tamano="sm" variante="fantasma" onClick={() => setBorrador({ ...borrador, fondoUrl: null })}>
                Quitar imagen de fondo
              </Boton>
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
            <input
              type="checkbox"
              style={CASILLA}
              checked={borrador.girar}
              onChange={(e) => setBorrador({ ...borrador, girar: e.target.checked })}
            />
            Girar 180° al imprimir (si la prueba sale al revés)
          </label>

          <div>
            <span className="campo-etiqueta">Vista previa (datos de muestra)</span>
            <div
              style={{
                background: "var(--surface-2)",
                borderRadius: "var(--r-md)",
                padding: 16,
                display: "flex",
                justifyContent: "center",
              }}
            >
              {vistaPrevia ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vistaPrevia}
                  alt="Vista previa de la etiqueta"
                  style={{
                    width: Math.min(borrador.anchoMm * 6, 320),
                    maxWidth: "100%",
                    height: "auto",
                    imageRendering: "pixelated",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                    background: "#fff",
                  }}
                />
              ) : (
                <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Dibujando…</span>
              )}
            </div>
            <p className="campo-ayuda">{resumen(borrador)}</p>
          </div>

          {avisos.map((a) => (
            <Aviso key={a} tono="aviso">
              {a}
            </Aviso>
          ))}

          <div className="fila" style={{ gap: 8 }}>
            <Boton variante="primario" disabled={ocupado || subiendo} onClick={guardar}>
              {borrador.id ? "Guardar cambios" : borrador.usar ? "Guardar y usar" : "Crear plantilla"}
            </Boton>
            <Boton variante="fantasma" disabled={ocupado} onClick={() => setBorrador(null)}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}

      {(mensaje || error) && (
        <div style={{ marginTop: 12 }}>
          {mensaje && (
            <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
              {mensaje}
            </Aviso>
          )}
          {error && <Aviso tono="peligro">{error}</Aviso>}
        </div>
      )}
    </Tarjeta>
  );
}
