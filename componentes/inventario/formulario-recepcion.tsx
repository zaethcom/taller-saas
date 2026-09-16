"use client";

/**
 * Recepción de repuestos a granel: lo que faltaba desde que
 * /recepcion-mercancia se limitó a artículos individualizados (ver su
 * comentario de cabecera). Se busca un repuesto existente por código o
 * descripción -- reabastecimiento -- o, si no aparece, se da de alta uno
 * nuevo inline: mismo formulario cubre los dos casos del punto 3 del
 * documento de requerimientos sin un flujo aparte.
 *
 * Colapsado por defecto: esta pantalla la abren sobre todo para mirar
 * existencias, no para recibir -- el formulario no debe competir por
 * espacio con la rejilla de catálogo hasta que alguien lo pide.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PackagePlus, Search, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";

interface ResultadoRepuesto {
  id: string;
  codigo: string;
  descripcion: string;
  precioVenta: number;
}

interface Sede {
  id: string;
  nombre: string;
}

interface Categoria {
  id: string;
  nombre: string;
}

const enlace: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: "var(--accent)",
  textDecoration: "underline",
  cursor: "pointer",
  font: "inherit",
};

export function FormularioRecepcion({ sedeIdDefault }: { sedeIdDefault: string | null }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<ResultadoRepuesto[]>([]);
  const [seleccionado, setSeleccionado] = useState<ResultadoRepuesto | null>(null);
  const [modoNuevo, setModoNuevo] = useState(false);

  const [codigoNuevo, setCodigoNuevo] = useState("");
  const [descripcionNueva, setDescripcionNueva] = useState("");
  const [precioVentaNuevo, setPrecioVentaNuevo] = useState("");
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState("");

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeId, setSedeId] = useState(sedeIdDefault ?? "");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);

  const buscarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!abierto) return;
    fetch("/api/sedes")
      .then((r) => r.json())
      .then((data) => setSedes(Array.isArray(data) ? data : []))
      .catch(() => setSedes([]));
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((data) => setCategorias(Array.isArray(data) ? data : []))
      .catch(() => setCategorias([]));
  }, [abierto]);

  useEffect(() => {
    if (!abierto || modoNuevo || seleccionado) return;
    const texto = buscar.trim();
    if (!texto) {
      setResultados([]);
      return;
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => {
      fetch(`/api/repuestos?buscar=${encodeURIComponent(texto)}`, { signal: controlador.signal })
        .then((r) => r.json())
        .then((data) => setResultados(Array.isArray(data) ? data : []))
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [buscar, abierto, modoNuevo, seleccionado]);

  function limpiar() {
    setBuscar("");
    setResultados([]);
    setSeleccionado(null);
    setModoNuevo(false);
    setCodigoNuevo("");
    setDescripcionNueva("");
    setPrecioVentaNuevo("");
    setCategoriaId("");
    setCantidad("");
    setMotivo("");
    setError(null);
  }

  async function recibir(e: React.FormEvent) {
    e.preventDefault();
    if (!sedeId) {
      setError("Falta elegir la sede");
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    setEnviando(true);
    setError(null);
    setConfirmacion(null);
    try {
      const cuerpo = seleccionado
        ? { repuestoId: seleccionado.id, sedeId, cantidad: cantidadNum, motivo: motivo.trim() || undefined }
        : {
            codigo: codigoNuevo.trim(),
            descripcion: descripcionNueva.trim(),
            precioVenta: precioVentaNuevo ? Number(precioVentaNuevo) : undefined,
            categoriaId: categoriaId || undefined,
            sedeId,
            cantidad: cantidadNum,
            motivo: motivo.trim() || undefined,
          };

      if (!seleccionado && (!codigoNuevo.trim() || !descripcionNueva.trim())) {
        setError("Busca un repuesto existente o completa código y descripción para uno nuevo");
        setEnviando(false);
        return;
      }

      const res = await fetch("/api/inventario/recepcion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      setConfirmacion(`Se recibieron ${cantidadNum} unidades.`);
      limpiar();
      router.refresh();
      buscarRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la recepción");
    } finally {
      setEnviando(false);
    }
  }

  if (!abierto) {
    return (
      <Boton
        variante="primario"
        icono={<PackagePlus size={17} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginBottom: 14 }}
      >
        Recibir mercancía
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginBottom: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <PackagePlus size={17} strokeWidth={2} />
          Recibir mercancía
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={16} strokeWidth={2} />}
          onClick={() => {
            setAbierto(false);
            limpiar();
            setConfirmacion(null);
          }}
        />
      </div>

      <form onSubmit={recibir} className="pila" style={{ gap: 12 }}>
        {!seleccionado && !modoNuevo && (
          <Campo etiqueta="Buscar repuesto por código o descripción">
            <input
              ref={buscarRef}
              placeholder="Ej: pastilla de freno, F-1023…"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              autoFocus
            />
          </Campo>
        )}

        {!seleccionado && !modoNuevo && buscar.trim() && (
          <div className="pila" style={{ gap: 4 }}>
            {resultados.length === 0 ? (
              <Aviso tono="info" icono={<Search size={15} strokeWidth={2} />}>
                No se encontró nada con ese texto.{" "}
                <button
                  type="button"
                  style={enlace}
                  onClick={() => {
                    setModoNuevo(true);
                    setDescripcionNueva(buscar.trim());
                  }}
                >
                  Crear repuesto nuevo
                </button>
              </Aviso>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                {resultados.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSeleccionado(r)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "9px 12px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        borderBottom: "1px solid var(--rule)",
                        fontSize: 13,
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>{r.descripcion}</span>{" "}
                      <span className="cifra" style={{ color: "var(--ink-3)" }}>
                        · {r.codigo}
                      </span>
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    style={{ ...enlace, display: "block", width: "100%", textAlign: "left", padding: "9px 12px" }}
                    onClick={() => {
                      setModoNuevo(true);
                      setDescripcionNueva(buscar.trim());
                    }}
                  >
                    Ninguno de estos: crear repuesto nuevo
                  </button>
                </li>
              </ul>
            )}
          </div>
        )}

        {seleccionado && (
          <Aviso tono="ok">
            Recibiendo: <strong>{seleccionado.descripcion}</strong> ({seleccionado.codigo}){" "}
            <button
              type="button"
              style={enlace}
              onClick={() => {
                setSeleccionado(null);
                setBuscar("");
              }}
            >
              cambiar
            </button>
          </Aviso>
        )}

        {modoNuevo && (
          <>
            <Aviso tono="info">
              Repuesto nuevo en el catálogo.{" "}
              <button
                type="button"
                style={enlace}
                onClick={() => {
                  setModoNuevo(false);
                  setDescripcionNueva("");
                  setCodigoNuevo("");
                }}
              >
                buscar uno existente
              </button>
            </Aviso>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Código">
                <input
                  placeholder="F-1023"
                  value={codigoNuevo}
                  onChange={(e) => setCodigoNuevo(e.target.value)}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Precio de venta">
                <input
                  type="number"
                  placeholder="0"
                  value={precioVentaNuevo}
                  onChange={(e) => setPrecioVentaNuevo(e.target.value)}
                  className="cifra"
                />
              </Campo>
            </div>
            <Campo etiqueta="Descripción">
              <input
                placeholder="Pastilla de freno delantera"
                value={descripcionNueva}
                onChange={(e) => setDescripcionNueva(e.target.value)}
              />
            </Campo>
            <Campo etiqueta="Categoría">
              <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
                <option value="">Sin categoría</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Campo>
          </>
        )}

        {(seleccionado || modoNuevo) && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <Campo etiqueta="Cantidad recibida">
                <input
                  type="number"
                  placeholder="0"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  className="cifra"
                  autoFocus
                />
              </Campo>
              <Campo etiqueta="Sede">
                <select value={sedeId} onChange={(e) => setSedeId(e.target.value)}>
                  <option value="">Elegir…</option>
                  {sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
            </div>
            <Campo etiqueta="Motivo" ayuda="Opcional. Ej: compra a proveedor, factura #123.">
              <input placeholder="Opcional" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            </Campo>

            <div>
              <Boton type="submit" variante="primario" disabled={enviando}>
                {enviando ? "Registrando…" : "Confirmar recepción"}
              </Boton>
            </div>
          </>
        )}

        {error && <Aviso tono="peligro">{error}</Aviso>}
        {confirmacion && <Aviso tono="ok">{confirmacion}</Aviso>}
      </form>
    </Tarjeta>
  );
}
