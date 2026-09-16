"use client";

/**
 * Consumir un repuesto contra el inventario de la sede, o marcarlo
 * como faltante si no hay -- lo que crea la fila en repuesto_solicitud
 * que aparece en /compras. Fase 6 del plano de construcción.
 *
 * También muestra lo que este técnico ya pidió para esta orden y su
 * estado -- antes no había ninguna manera de saber, desde acá, cuando
 * Compras marcaba un faltante como recibido.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Package, Search, Minus, AlertTriangle, Check, PackageCheck } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Solicitud {
  id: string;
  descripcion: string;
  cantidad: number;
  estado: string;
  creada_en: string;
}

interface Repuesto {
  id: string;
  codigo: string;
  descripcion: string;
  existenciaAqui: number;
}

export default function PaginaRepuestos() {
  const { id } = useParams<{ id: string }>();

  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<Repuesto[]>([]);
  const [buscando, setBuscando] = useState(false);

  const [faltanteDescripcion, setFaltanteDescripcion] = useState("");
  const [faltanteCantidad, setFaltanteCantidad] = useState("1");
  const [prioridad, setPrioridad] = useState("normal");

  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);

  async function cargarSolicitudes() {
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, estado, creada_en")
      .eq("orden_id", id)
      .order("creada_en", { ascending: false });
    setSolicitudes((data as Solicitud[]) ?? []);
  }

  useEffect(() => {
    cargarSolicitudes();
  }, [id]);

  async function buscarRepuestos() {
    setBuscando(true);
    const res = await fetch(`/api/repuestos?buscar=${encodeURIComponent(buscar)}`);
    setResultados(await res.json());
    setBuscando(false);
  }

  async function consumir(repuestoId: string) {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "consumir", repuestoId, cantidad: 1 }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Repuesto consumido y descontado del inventario.");
      buscarRepuestos();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo consumir el repuesto");
    } finally {
      setProcesando(false);
    }
  }

  async function marcarFaltante() {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/repuestos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accion: "faltante",
          descripcion: faltanteDescripcion.trim(),
          cantidad: Number(faltanteCantidad) || 1,
          prioridad,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje("Faltante registrado. Ya aparece en la lista de compras.");
      setFaltanteDescripcion("");
      setFaltanteCantidad("1");
      cargarSolicitudes();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar el faltante");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<Package size={24} strokeWidth={2} />}
        titulo="Repuestos"
        descripcion="Descuenta del inventario de esta sede, o pide lo que no hay."
      />

      <div className="pila">
        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Consumir del inventario</h2>
          <form
            className="fila"
            style={{ gap: 8, flexWrap: "nowrap", marginBottom: resultados.length ? 14 : 0 }}
            onSubmit={(e) => {
              e.preventDefault();
              buscarRepuestos();
            }}
          >
            <input
              placeholder="Buscar por código o descripción"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              aria-label="Buscar repuesto"
            />
            <Boton type="submit" variante="contorno" icono={<Search size={17} strokeWidth={2} />} disabled={buscando} />
          </form>

          {resultados.map((r) => (
            <div
              key={r.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 0",
                borderTop: "1px solid var(--rule)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{r.descripcion}</div>
                <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  {r.codigo}
                </div>
              </div>
              <Etiqueta tono={r.existenciaAqui <= 0 ? "neutro" : r.existenciaAqui <= 3 ? "aviso" : "ok"}>
                <span className="cifra">{r.existenciaAqui <= 0 ? "Agotado" : `${r.existenciaAqui} aquí`}</span>
              </Etiqueta>
              <Boton
                variante="primario"
                tamano="sm"
                icono={<Minus size={15} strokeWidth={2.2} />}
                onClick={() => consumir(r.id)}
                disabled={procesando || r.existenciaAqui <= 0}
              >
                Consumir 1
              </Boton>
            </div>
          ))}

          {resultados.length === 0 && buscar && !buscando && (
            <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
              Sin resultados. Márcalo como faltante abajo.
            </p>
          )}
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
            <AlertTriangle size={19} strokeWidth={2} color="var(--aviso)" aria-hidden />
            Marcar faltante
          </h2>
          <div className="pila" style={{ gap: 12 }}>
            <Campo etiqueta="Qué hace falta" ayuda="Queda en la lista de compras con la orden a la que pertenece.">
              <input
                placeholder="Descripción del repuesto que hace falta"
                value={faltanteDescripcion}
                onChange={(e) => setFaltanteDescripcion(e.target.value)}
              />
            </Campo>
            <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 12 }}>
              <Campo etiqueta="Cantidad">
                <input
                  type="number"
                  min={1}
                  value={faltanteCantidad}
                  onChange={(e) => setFaltanteCantidad(e.target.value)}
                  className="cifra"
                />
              </Campo>
              <Campo etiqueta="Prioridad">
                <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)}>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
              </Campo>
            </div>
            <div>
              <Boton
                variante="primario"
                icono={<AlertTriangle size={17} strokeWidth={2} />}
                onClick={marcarFaltante}
                disabled={procesando || !faltanteDescripcion.trim()}
              >
                Marcar faltante
              </Boton>
            </div>
          </div>
        </Tarjeta>

        {mensaje && (
          <Aviso tono="ok" icono={<Check size={17} strokeWidth={2.4} />}>
            {mensaje}
          </Aviso>
        )}
        {error && <Aviso tono="peligro">{error}</Aviso>}

        {solicitudes.length > 0 && (
          <Tarjeta>
            <h2 style={{ marginBottom: 12 }}>Lo que pediste para esta orden</h2>
            <div className="pila" style={{ gap: 0 }}>
              {solicitudes.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid var(--rule)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{s.descripcion}</div>
                    <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      x{s.cantidad}
                    </div>
                  </div>
                  {s.estado === "recibido" ? (
                    <Etiqueta tono="ok" icono={<PackageCheck size={13} strokeWidth={2} />}>
                      Ya llegó
                    </Etiqueta>
                  ) : (
                    <Etiqueta tono="aviso" punto>
                      <span style={{ textTransform: "capitalize" }}>{s.estado}</span>
                    </Etiqueta>
                  )}
                </div>
              ))}
            </div>
          </Tarjeta>
        )}
      </div>
    </div>
  );
}
