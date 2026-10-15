"use client";

/**
 * El lápiz de cada tarjeta de /inventario. Abre una ventana para
 * corregir los datos del producto (código, descripción, precios, marca,
 * modelo, categoría...) y, en un repuesto, también la cantidad en esa
 * sede. Los datos van a PATCH /api/repuestos/[id] o
 * /api/inventario/articulos/[id]; la cantidad sigue yendo por
 * /api/inventario/ajuste con motivo obligatorio (punto 2 del documento
 * de requerimientos), así que solo se pide motivo si la cantidad cambia.
 *
 * Los datos de un repuesto son del catálogo, no de la sede: cambiarlos
 * en una tarjeta los cambia en las tarjetas de las otras sedes.
 */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Campo } from "@/componentes/ui/campo";
import { CONDICIONES_ARTICULO } from "@/lib/edicion-producto";
import { VentanaError } from "@/componentes/ui/ventana-error";

export interface RepuestoEditable {
  id: string;
  codigo: string;
  descripcion: string;
  precio_venta: number;
  costo?: number | null;
  marca?: string | null;
  modelo?: string | null;
  categoria_id?: string | null;
  observacion?: string | null;
}

export interface ArticuloEditable {
  id: string;
  tipo: string;
  marca: string | null;
  modelo: string | null;
  numero_serie: string | null;
  costo: number | null;
  precio_venta: number | null;
  condicion: string | null;
  categoria_id: string | null;
}

type Props =
  | {
      repuesto: RepuestoEditable;
      existencia: { sedeId: string | null; sedeNombre?: string; cantidad: number };
      articulo?: undefined;
    }
  | { articulo: ArticuloEditable; repuesto?: undefined; existencia?: undefined };

interface Categoria {
  id: string;
  nombre: string;
}

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(v));

function datosIniciales(p: Props): Record<string, string> {
  if (p.repuesto) {
    const r = p.repuesto;
    return {
      codigo: r.codigo,
      descripcion: r.descripcion,
      precioVenta: str(r.precio_venta),
      costo: str(r.costo),
      marca: str(r.marca),
      modelo: str(r.modelo),
      categoriaId: str(r.categoria_id),
      observacion: str(r.observacion),
    };
  }
  const a = p.articulo;
  return {
    tipo: a.tipo,
    marca: str(a.marca),
    modelo: str(a.modelo),
    numeroSerie: str(a.numero_serie),
    precioVenta: str(a.precio_venta),
    costo: str(a.costo),
    condicion: str(a.condicion),
    categoriaId: str(a.categoria_id),
  };
}

export function EditarProducto(props: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState<Record<string, string>>(() => datosIniciales(props));
  const [cantidad, setCantidad] = useState(str(props.existencia?.cantidad));
  const [motivo, setMotivo] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch(() => setCategorias([]));
  }, [abierto]);

  function abrir() {
    setDatos(datosIniciales(props));
    setCantidad(str(props.existencia?.cantidad));
    setMotivo("");
    setError(null);
    setAbierto(true);
  }

  const campo = (nombre: string) => ({
    value: datos[nombre] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setDatos((d) => ({ ...d, [nombre]: e.target.value })),
  });

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const iniciales = datosIniciales(props);
    const cambiados = Object.fromEntries(Object.entries(datos).filter(([k, v]) => v !== iniciales[k]));

    const existencia = props.existencia;
    const cantidadNueva = Number(cantidad);
    const cambiaCantidad = !!existencia?.sedeId && cantidad.trim() !== "" && cantidadNueva !== existencia.cantidad;
    if (cambiaCantidad) {
      if (!Number.isInteger(cantidadNueva) || cantidadNueva < 0) {
        setError("La cantidad debe ser un número entero mayor o igual a cero");
        return;
      }
      if (!motivo.trim()) {
        setError("Para cambiar la cantidad, escribe el motivo");
        return;
      }
    }
    if (Object.keys(cambiados).length === 0 && !cambiaCantidad) {
      setAbierto(false);
      return;
    }

    setEnviando(true);
    setError(null);
    try {
      if (Object.keys(cambiados).length > 0) {
        const url = props.repuesto
          ? `/api/repuestos/${props.repuesto.id}`
          : `/api/inventario/articulos/${props.articulo.id}`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cambiados),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "No se pudieron guardar los datos");
      }
      if (cambiaCantidad && props.repuesto && existencia) {
        const res = await fetch("/api/inventario/ajuste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            repuestoId: props.repuesto.id,
            sedeId: existencia.sedeId,
            cantidadNueva,
            motivo: motivo.trim(),
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "No se pudo ajustar la cantidad");
      }
      setAbierto(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={abrir}
        title="Editar producto"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          border: "1px solid var(--rule)",
          background: "var(--surface-2)",
          borderRadius: 999,
          width: 26,
          height: 26,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: "var(--ink-2)",
        }}
      >
        <Pencil size={13} strokeWidth={2} />
      </button>
    );
  }

  const selectorCategoria = (
    <Campo etiqueta="Categoría">
      <select {...campo("categoriaId")}>
        <option value="">Sin categoría</option>
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
        {/* Mientras cargan las categorías, que la actual no se pierda. */}
        {datos.categoriaId && !categorias.some((c) => c.id === datos.categoriaId) && (
          <option value={datos.categoriaId}>…</option>
        )}
      </select>
    </Campo>
  );

  const dos: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Editar producto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !enviando) setAbierto(false);
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 11, 12, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--sombra-2)",
          width: "100%",
          maxWidth: 460,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>{props.repuesto ? "Editar repuesto" : "Editar artículo"}</h3>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            title="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <form onSubmit={guardar} className="pila" style={{ gap: 10 }}>
          {props.repuesto ? (
            <>
              <Campo etiqueta="Descripción">
                <input {...campo("descripcion")} autoFocus />
              </Campo>
              <div style={dos}>
                <Campo etiqueta="Código" ayuda="El del código de barras">
                  <input {...campo("codigo")} className="cifra" />
                </Campo>
                {selectorCategoria}
              </div>
              <div style={dos}>
                <Campo etiqueta="Marca">
                  <input {...campo("marca")} />
                </Campo>
                <Campo etiqueta="Modelo">
                  <input {...campo("modelo")} />
                </Campo>
              </div>
              <div style={dos}>
                <Campo etiqueta="Precio de venta">
                  <input type="number" min={0} step="any" {...campo("precioVenta")} className="cifra" />
                </Campo>
                <Campo etiqueta="Costo">
                  <input type="number" min={0} step="any" {...campo("costo")} className="cifra" />
                </Campo>
              </div>
              <Campo etiqueta="Observación">
                <input {...campo("observacion")} />
              </Campo>

              {props.existencia.sedeId && (
                <div
                  className="pila"
                  style={{ gap: 10, borderTop: "1px solid var(--rule)", paddingTop: 10, marginTop: 2 }}
                >
                  <div style={dos}>
                    <Campo
                      etiqueta={`Cantidad${props.existencia.sedeNombre ? ` en ${props.existencia.sedeNombre}` : ""}`}
                      ayuda={`Actual: ${props.existencia.cantidad}`}
                    >
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        className="cifra"
                      />
                    </Campo>
                    <Campo etiqueta="Motivo del ajuste" ayuda="Solo si cambias la cantidad">
                      <input
                        placeholder="Conteo físico, merma…"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                      />
                    </Campo>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={dos}>
                <Campo etiqueta="Tipo">
                  <input {...campo("tipo")} autoFocus />
                </Campo>
                {selectorCategoria}
              </div>
              <div style={dos}>
                <Campo etiqueta="Marca">
                  <input {...campo("marca")} />
                </Campo>
                <Campo etiqueta="Modelo">
                  <input {...campo("modelo")} />
                </Campo>
              </div>
              <Campo etiqueta="IMEI / serie">
                <input {...campo("numeroSerie")} className="cifra" />
              </Campo>
              <div style={dos}>
                <Campo etiqueta="Precio de venta">
                  <input type="number" min={0} step="any" {...campo("precioVenta")} className="cifra" />
                </Campo>
                <Campo etiqueta="Costo">
                  <input type="number" min={0} step="any" {...campo("costo")} className="cifra" />
                </Campo>
              </div>
              <Campo etiqueta="Condición">
                <select {...campo("condicion")}>
                  <option value="">Sin indicar</option>
                  {CONDICIONES_ARTICULO.map((c) => (
                    <option key={c.valor} value={c.valor}>
                      {c.etiqueta}
                    </option>
                  ))}
                </select>
              </Campo>
            </>
          )}

          <VentanaError mensaje={error} onCerrar={() => setError(null)} />
          <div className="fila" style={{ justifyContent: "flex-end", gap: 8 }}>
            <Boton type="button" variante="fantasma" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="primario" disabled={enviando}>
              {enviando ? "Guardando…" : "Guardar cambios"}
            </Boton>
          </div>
        </form>
      </div>
    </div>
  );
}
