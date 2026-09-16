"use client";

/**
 * La lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad. Marcar
 * recibido ahora sí ingresa al inventario de verdad: quien recibe
 * confirma contra qué repuesto real del catálogo corresponde la
 * descripción libre del técnico y en qué sede entró (la solicitud no
 * guarda ni lo uno ni lo otro), y eso pasa por mover_existencia --
 * auditado y relacionado con la orden que lo pidió.
 *
 * El botón de WhatsApp arma un enlace wa.me con la lista de faltantes
 * actuales -- sin backend, sin cuenta de negocio de Meta -- al número
 * que el admin configuró en /configuracion.
 */
import { Fragment, useEffect, useState } from "react";
import { ShoppingBag, PackageCheck, MessageCircle, X } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Faltante {
  id: string;
  descripcion: string;
  cantidad: number;
  prioridad: string;
  estado: string;
  creada_en: string;
  orden: { numero: number } | { numero: number }[] | null;
}

interface RepuestoResultado {
  id: string;
  codigo: string;
  descripcion: string;
}

interface Sede {
  id: string;
  nombre: string;
}

/** Urgente grita, normal no: si todo se ve igual, nada se atiende primero. */
const TONO_PRIORIDAD: Record<string, TonoEtiqueta> = {
  urgente: "peligro",
  alta: "aviso",
  normal: "neutro",
};

export default function PaginaCompras() {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeIdDefault, setSedeIdDefault] = useState<string | null>(null);
  const [whatsappProveedor, setWhatsappProveedor] = useState<string | null>(null);

  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<RepuestoResultado[]>([]);
  const [repuestoSeleccionado, setRepuestoSeleccionado] = useState<RepuestoResultado | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, prioridad, estado, creada_en, orden:orden_id ( numero )")
      .neq("estado", "consumido")
      .order("creada_en", { ascending: true });
    setFaltantes((data as Faltante[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
    Promise.all([fetch("/api/perfil"), fetch("/api/sedes"), fetch("/api/configuracion")])
      .then(async ([resPerfil, resSedes, resConfig]) => {
        const perfil = await resPerfil.json();
        const listaSedes = await resSedes.json();
        const config = await resConfig.json();
        setSedeIdDefault(perfil.sedeId ?? null);
        setSedes(Array.isArray(listaSedes) ? listaSedes : []);
        setWhatsappProveedor(config.whatsappProveedor ?? null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!abiertoId || repuestoSeleccionado) return;
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
  }, [buscar, abiertoId, repuestoSeleccionado]);

  function abrirFormulario(f: Faltante) {
    setAbiertoId(f.id);
    setBuscar(f.descripcion);
    setResultados([]);
    setRepuestoSeleccionado(null);
    setCantidad(String(f.cantidad));
    setSedeId(sedeIdDefault ?? "");
    setError(null);
  }

  function cerrarFormulario() {
    setAbiertoId(null);
    setRepuestoSeleccionado(null);
    setError(null);
  }

  async function confirmarRecibido(id: string) {
    if (!repuestoSeleccionado) {
      setError("Elige a qué repuesto del catálogo corresponde");
      return;
    }
    if (!sedeId) {
      setError("Falta elegir la sede");
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }

    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${id}/recibir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repuestoId: repuestoSeleccionado.id, sedeId, cantidad: cantidadNum }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      cerrarFormulario();
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como recibido");
    } finally {
      setProcesando(null);
    }
  }

  function numeroOrden(orden: Faltante["orden"]) {
    if (!orden) return "—";
    return Array.isArray(orden) ? orden[0]?.numero : orden.numero;
  }

  const pendientes = faltantes.filter((f) => f.estado === "faltante");

  function enviarPorWhatsapp() {
    if (!whatsappProveedor) return;
    const lineas = pendientes.map(
      (f) => `• ${f.descripcion} x${f.cantidad} (orden #${numeroOrden(f.orden)}, prioridad ${f.prioridad})`,
    );
    const texto = `Lista de repuestos faltantes:\n${lineas.join("\n")}`;
    const numero = whatsappProveedor.replace(/\D/g, "");
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank");
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<ShoppingBag size={24} strokeWidth={2} />}
        titulo="Compras"
        descripcion="Lo que el taller pidió y todavía no llega, en orden de antigüedad."
        acciones={
          whatsappProveedor && pendientes.length > 0 ? (
            <Boton
              variante="contorno"
              icono={<MessageCircle size={17} strokeWidth={2} />}
              onClick={enviarPorWhatsapp}
            >
              Enviar lista por WhatsApp
            </Boton>
          ) : undefined
        }
      />

      {faltantes.length === 0 ? (
        <Tarjeta style={{ textAlign: "center", padding: 36, borderStyle: "dashed" }}>
          <PackageCheck size={30} strokeWidth={1.6} color="var(--ok)" aria-hidden />
          <p style={{ margin: "10px 0 0", fontWeight: 700 }}>No hay faltantes pendientes</p>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            Aparecen aquí solos cuando un técnico marca un repuesto como faltante.
          </p>
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Repuesto</th>
                <th>Orden</th>
                <th>Cantidad</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faltantes.map((f) => (
                <Fragment key={f.id}>
                  <tr>
                    <td style={{ fontWeight: 600 }}>{f.descripcion}</td>
                    <td className="cifra">#{numeroOrden(f.orden)}</td>
                    <td className="cifra">{f.cantidad}</td>
                    <td>
                      <Etiqueta tono={TONO_PRIORIDAD[f.prioridad] ?? "neutro"} punto>
                        <span style={{ textTransform: "capitalize" }}>{f.prioridad}</span>
                      </Etiqueta>
                    </td>
                    <td>
                      <Etiqueta tono={f.estado === "faltante" ? "aviso" : "info"}>
                        <span style={{ textTransform: "capitalize" }}>{f.estado}</span>
                      </Etiqueta>
                    </td>
                    <td className="cifra" style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                      {new Date(f.creada_en).toLocaleDateString("es-CO")}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {f.estado === "faltante" && abiertoId !== f.id && (
                        <Boton
                          variante="primario"
                          tamano="sm"
                          icono={<PackageCheck size={15} strokeWidth={2} />}
                          onClick={() => abrirFormulario(f)}
                        >
                          Marcar recibido
                        </Boton>
                      )}
                      {f.estado === "faltante" && abiertoId === f.id && (
                        <Boton variante="fantasma" tamano="sm" icono={<X size={15} strokeWidth={2} />} onClick={cerrarFormulario} />
                      )}
                    </td>
                  </tr>
                  {abiertoId === f.id && (
                    <tr>
                      <td colSpan={7} style={{ background: "var(--surface-2)" }}>
                        <div className="pila" style={{ gap: 10, padding: "12px 4px" }}>
                          {!repuestoSeleccionado ? (
                            <>
                              <Campo etiqueta="¿A qué repuesto del catálogo corresponde?">
                                <input value={buscar} onChange={(e) => setBuscar(e.target.value)} autoFocus />
                              </Campo>
                              {resultados.length > 0 && (
                                <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
                                  {resultados.map((r) => (
                                    <li key={r.id}>
                                      <button
                                        type="button"
                                        onClick={() => setRepuestoSeleccionado(r)}
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
                                </ul>
                              )}
                              {buscar.trim() && resultados.length === 0 && (
                                <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
                                  No se encontró nada. Si el repuesto no existe en el catálogo, créalo primero
                                  desde /inventario y vuelve aquí.
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <Aviso tono="ok">
                                Recibiendo como: <strong>{repuestoSeleccionado.descripcion}</strong> (
                                {repuestoSeleccionado.codigo}){" "}
                                <button
                                  type="button"
                                  onClick={() => setRepuestoSeleccionado(null)}
                                  style={{ border: "none", background: "transparent", color: "var(--accent)", textDecoration: "underline", cursor: "pointer" }}
                                >
                                  cambiar
                                </button>
                              </Aviso>
                              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                                <Campo etiqueta="Cantidad recibida">
                                  <input
                                    type="number"
                                    value={cantidad}
                                    onChange={(e) => setCantidad(e.target.value)}
                                    className="cifra"
                                  />
                                </Campo>
                                <Campo etiqueta="Sede donde ingresó">
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
                              <div>
                                <Boton
                                  variante="primario"
                                  tamano="sm"
                                  icono={<PackageCheck size={15} strokeWidth={2} />}
                                  onClick={() => confirmarRecibido(f.id)}
                                  disabled={procesando === f.id}
                                >
                                  {procesando === f.id ? "Guardando…" : "Confirmar recepción"}
                                </Boton>
                              </div>
                            </>
                          )}
                          {error && (
                            <Aviso tono="peligro">
                              <span style={{ fontSize: 12 }}>{error}</span>
                            </Aviso>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
