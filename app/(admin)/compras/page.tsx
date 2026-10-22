"use client";

/**
 * La lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad. Lo que
 * se pide aquí es para reparar ese equipo: al marcarlo recibido NO
 * entra al inventario, queda asignado a la orden (decisión de Frank,
 * 2026-10-22). Quien recibe anota el producto que llegó y cuánto costó
 * -- interno, para la contabilidad de la orden --, el historial de la
 * orden lo registra y el técnico recibe el aviso de que puede seguir
 * (lib/compras/recepcion-orden.ts).
 *
 * Lo recibido sale de la lista apenas se confirma (no se borra);
 * "Mostrar recibidos" lo trae de vuelta para consultar.
 *
 * WhatsApp: se marcan con check los faltantes que van en el pedido y se
 * elige a qué contacto va (mensajero, almacén, proveedor... los que la
 * empresa configure abajo). Arma un enlace wa.me con el texto ya
 * escrito -- sin backend, sin cuenta de negocio de Meta.
 */
import { Fragment, useEffect, useState } from "react";
import { PackageCheck, MessageCircle, X, Plus, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { enlaceWhatsapp, equipoTexto, mensajePedido } from "@/lib/compras/whatsapp";
import { comprasAutorizadas, type Estado } from "@/lib/estados";
import { puede, type Rol } from "@/lib/permisos";
import { formatearMoneda } from "@/componentes/cobro/panel-cobro";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface Faltante {
  id: string;
  descripcion: string;
  cantidad: number;
  prioridad: string;
  estado: string;
  creada_en: string;
  producto: string | null;
  costo_compra: number | null;
  orden: OrdenFaltante | OrdenFaltante[] | null;
}

interface OrdenFaltante {
  numero: number;
  estado: Estado;
  motivo: string | null;
  producto: ProductoFaltante | ProductoFaltante[] | null;
}

interface ProductoFaltante {
  tipo: string | null;
  marca: string | null;
  modelo: string | null;
}

interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
}

/** Urgente grita, normal no: si todo se ve igual, nada se atiende primero. */
const TONO_PRIORIDAD: Record<string, TonoEtiqueta> = {
  urgente: "peligro",
  alta: "aviso",
  normal: "neutro",
};

/** El join de Supabase puede traer la relación 1:1 como arreglo. */
function unaOrden(orden: Faltante["orden"]): OrdenFaltante | null {
  return (Array.isArray(orden) ? orden[0] : orden) ?? null;
}

/** El equipo de la orden (tipo, marca y modelo): para qué es el repuesto. */
function equipoOrden(orden: OrdenFaltante | null): string {
  if (!orden) return "";
  return equipoTexto(Array.isArray(orden.producto) ? orden.producto[0] : orden.producto);
}

const CASILLA = { width: 18, height: 18, padding: 0, accentColor: "var(--accent)", cursor: "pointer" } as const;

export default function PaginaCompras() {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  // El costo de compra es interno: lo ve y lo anota quien compra (admin y compras).
  const [veCosto, setVeCosto] = useState(false);

  const [mostrarRecibidos, setMostrarRecibidos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactoId, setContactoId] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [errorContacto, setErrorContacto] = useState<string | null>(null);

  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [producto, setProducto] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costo, setCosto] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar(conRecibidos = mostrarRecibidos) {
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, prioridad, estado, creada_en, producto, costo_compra, orden:orden_id ( numero, estado, motivo, producto:producto_id ( tipo, marca, modelo ) )")
      .in("estado", conRecibidos ? ["faltante", "recibido"] : ["faltante"])
      .order("creada_en", { ascending: true });
    const lista = (data as Faltante[]) ?? [];
    setFaltantes(lista);
    // Lo que ya no está como faltante no puede seguir marcado para enviar.
    setSeleccionados((prev) => new Set(lista.filter((f) => f.estado === "faltante" && prev.has(f.id)).map((f) => f.id)));
    setCargando(false);
  }

  async function cargarContactos() {
    const res = await fetch("/api/contactos-whatsapp");
    const data = await res.json().catch(() => []);
    const lista: Contacto[] = res.ok && Array.isArray(data) ? data : [];
    setContactos(lista);
    setContactoId((actual) => (lista.some((c) => c.id === actual) ? actual : (lista[0]?.id ?? "")));
  }

  useEffect(() => {
    cargar(false);
    cargarContactos().catch(() => {});
    fetch("/api/perfil")
      .then((r) => r.json())
      .then((perfil: { rol?: Rol }) => setVeCosto(Boolean(perfil.rol && puede(perfil.rol, "gestionar_compras"))))
      .catch(() => {});
    // cargar lee mostrarRecibidos; aquí solo interesa la carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirFormulario(f: Faltante) {
    setAbiertoId(f.id);
    setProducto(f.descripcion);
    setCantidad(String(f.cantidad));
    setCosto("");
    setError(null);
  }

  function cerrarFormulario() {
    setAbiertoId(null);
    setError(null);
  }

  async function confirmarRecibido(f: Faltante) {
    const id = f.id;
    if (!producto.trim()) {
      setError("Escribe el nombre del producto que llegó");
      return;
    }
    const cantidadNum = Number(cantidad);
    if (!cantidadNum || cantidadNum <= 0) {
      setError("La cantidad debe ser mayor a cero");
      return;
    }
    if (costo.trim() === "" || !(Number(costo) >= 0)) {
      setError("Escribe cuánto costó la compra");
      return;
    }

    setProcesando(id);
    setError(null);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${id}/recibir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ producto: producto.trim(), cantidad: cantidadNum, costo: Number(costo) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const r = (await res.json()) as { estado?: string | null };
      cerrarFormulario();
      setAviso(
        `${producto.trim()} quedó en la orden #${numeroOrden(f.orden)} y se avisó al técnico` +
          (r.estado === "en_reparacion" ? ": la orden pasó a reparación." : "."),
      );
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo marcar como recibido");
    } finally {
      setProcesando(null);
    }
  }

  function numeroOrden(orden: Faltante["orden"]) {
    return unaOrden(orden)?.numero ?? "—";
  }

  const pendientes = faltantes.filter((f) => f.estado === "faltante");
  const todosSeleccionados = pendientes.length > 0 && pendientes.every((f) => seleccionados.has(f.id));
  const contacto = contactos.find((c) => c.id === contactoId) ?? null;

  function alternarSeleccion(id: string) {
    setSeleccionados((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  function alternarTodos() {
    setSeleccionados(todosSeleccionados ? new Set() : new Set(pendientes.map((f) => f.id)));
  }

  async function alternarRecibidos(valor: boolean) {
    setMostrarRecibidos(valor);
    await cargar(valor);
  }

  function enviarPorWhatsapp() {
    if (!contacto) return;
    const lineas = pendientes
      .filter((f) => seleccionados.has(f.id))
      .map((f) => ({
        descripcion: f.descripcion,
        cantidad: f.cantidad,
        ordenNumero: unaOrden(f.orden)?.numero,
        prioridad: f.prioridad,
        equipo: equipoOrden(unaOrden(f.orden)),
      }));
    if (lineas.length === 0) return;
    window.open(enlaceWhatsapp(contacto.telefono, mensajePedido(lineas, contacto.nombre)), "_blank");
  }

  async function agregarContacto() {
    if (!nombreContacto.trim() || !telefonoContacto.trim()) return;
    setErrorContacto(null);
    try {
      const res = await fetch("/api/contactos-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreContacto.trim(), telefono: telefonoContacto.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setNombreContacto("");
      setTelefonoContacto("");
      await cargarContactos();
      setContactoId(data.id);
    } catch (e) {
      setErrorContacto(e instanceof Error ? e.message : "No se pudo agregar el contacto");
    }
  }

  async function eliminarContacto(c: Contacto) {
    if (!window.confirm(`¿Eliminar el contacto "${c.nombre}"?`)) return;
    setErrorContacto(null);
    const res = await fetch(`/api/contactos-whatsapp/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      setErrorContacto((await res.json().catch(() => ({}))).error ?? "No se pudo eliminar el contacto");
      return;
    }
    await cargarContactos();
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        titulo="Compras"
        acciones={
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={mostrarRecibidos}
              onChange={(e) => alternarRecibidos(e.target.checked)}
              style={CASILLA}
            />
            Mostrar recibidos
          </label>
        }
      />

      <div className="pila">
        {aviso && (
          <Aviso tono="ok">
            <span style={{ fontSize: 13 }}>{aviso}</span>
          </Aviso>
        )}

        {pendientes.length > 0 && (
          <Tarjeta>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
              <Campo etiqueta="Enviar el pedido a">
                {contactos.length > 0 ? (
                  <select value={contactoId} onChange={(e) => setContactoId(e.target.value)} style={{ minWidth: 200 }}>
                    {contactos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} · {c.telefono}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>
                    Agrega un contacto en «Contactos de WhatsApp», abajo.
                  </p>
                )}
              </Campo>
              <Boton
                variante="primario"
                icono={<MessageCircle size={17} strokeWidth={2} />}
                onClick={enviarPorWhatsapp}
                disabled={!contacto || seleccionados.size === 0}
              >
                {seleccionados.size > 0
                  ? `Enviar ${seleccionados.size} por WhatsApp`
                  : "Marca los repuestos a enviar"}
              </Boton>
            </div>
          </Tarjeta>
        )}

        {faltantes.length === 0 ? (
          <Tarjeta style={{ textAlign: "center", padding: 36, borderStyle: "dashed" }}>
            <PackageCheck size={30} strokeWidth={1.6} color="var(--ok)" aria-hidden />
            <p style={{ margin: "10px 0 0", fontWeight: 700 }}>
              {mostrarRecibidos ? "No hay faltantes ni recibidos" : "No hay faltantes pendientes"}
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              Aparecen aquí solos cuando al recibir un equipo no hay el repuesto, o cuando un técnico lo marca como faltante.
            </p>
          </Tarjeta>
        ) : (
          <TarjetaTabla>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    {pendientes.length > 0 && (
                      <input
                        type="checkbox"
                        checked={todosSeleccionados}
                        onChange={alternarTodos}
                        aria-label="Seleccionar todos"
                        style={CASILLA}
                      />
                    )}
                  </th>
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
                      <td>
                        {f.estado === "faltante" && (
                          <input
                            type="checkbox"
                            checked={seleccionados.has(f.id)}
                            onChange={() => alternarSeleccion(f.id)}
                            aria-label={`Incluir ${f.descripcion} en el pedido`}
                            style={CASILLA}
                          />
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{f.descripcion}</div>
                        {f.estado !== "faltante" && f.producto && f.producto !== f.descripcion && (
                          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Llegó: {f.producto}</div>
                        )}
                        {f.estado !== "faltante" && veCosto && f.costo_compra != null && (
                          <div className="cifra" style={{ fontSize: 13, color: "var(--ink-2)" }}>
                            Costó {formatearMoneda(Number(f.costo_compra))}
                          </div>
                        )}
                        {equipoOrden(unaOrden(f.orden)) && (
                          <div style={{ fontSize: 13, color: "var(--ink-2)" }}>Para {equipoOrden(unaOrden(f.orden))}</div>
                        )}
                      </td>
                      <td>
                        <span className="cifra">#{numeroOrden(f.orden)}</span>
                        {unaOrden(f.orden)?.motivo && (
                          <div style={{ fontSize: 12, color: "var(--ink-3)", maxWidth: 240 }}>{unaOrden(f.orden)!.motivo}</div>
                        )}
                        {f.estado === "faltante" && unaOrden(f.orden) && (
                          <div style={{ marginTop: 4 }}>
                            {unaOrden(f.orden)!.estado === "entregada" ? (
                              <Etiqueta tono="neutro">Orden entregada</Etiqueta>
                            ) : !comprasAutorizadas(unaOrden(f.orden)!.estado) ? (
                              <Etiqueta tono="espera">Falta aprobación del cliente</Etiqueta>
                            ) : null}
                          </div>
                        )}
                      </td>
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
                        <td colSpan={8} style={{ background: "var(--surface-2)" }}>
                          <div className="pila" style={{ gap: 10, padding: "12px 4px" }}>
                            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
                              Queda asignado a la orden #{numeroOrden(f.orden)}, no entra al inventario. Se le avisa al
                              técnico que puede seguir.
                            </p>
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                              <div style={{ gridColumn: "1 / -1" }}>
                                <Campo etiqueta="Producto que llegó">
                                  <input value={producto} onChange={(e) => setProducto(e.target.value)} autoFocus />
                                </Campo>
                              </div>
                              <Campo etiqueta="Cantidad">
                                <input
                                  type="number"
                                  min={1}
                                  value={cantidad}
                                  onChange={(e) => setCantidad(e.target.value)}
                                  className="cifra"
                                />
                              </Campo>
                              <Campo etiqueta="Costo de la compra (total)" ayuda="Interno: solo lo ve el administrador.">
                                <input
                                  type="number"
                                  min={0}
                                  inputMode="decimal"
                                  value={costo}
                                  onChange={(e) => setCosto(e.target.value)}
                                  placeholder="0"
                                  className="cifra"
                                />
                              </Campo>
                            </div>
                            <div>
                              <Boton
                                variante="primario"
                                tamano="sm"
                                icono={<PackageCheck size={15} strokeWidth={2} />}
                                onClick={() => confirmarRecibido(f)}
                                disabled={procesando === f.id}
                              >
                                {procesando === f.id ? "Guardando…" : "Confirmar recibido"}
                              </Boton>
                            </div>
                            <VentanaError mensaje={error} onCerrar={() => setError(null)} />
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

        {/* Se configura una vez y casi no se toca: plegado, salvo cuando
            todavía no hay a quién mandarle el pedido. */}
        <details className="mas-opciones" open={contactos.length === 0}>
          <summary>Contactos de WhatsApp ({contactos.length})</summary>
          <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-2)" }}>
            A quién se le puede mandar un pedido. Ponle el nombre del tipo de pedido: Mensajero, Almacén, Proveedor…
          </p>
          {contactos.length > 0 && (
            <ul style={{ listStyle: "none", margin: "0 0 12px", padding: 0, border: "1px solid var(--rule)", borderRadius: "var(--r-md)", overflow: "hidden" }}>
              {contactos.map((c) => (
                <li
                  key={c.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderBottom: "1px solid var(--rule)" }}
                >
                  <span>
                    <span style={{ fontWeight: 700 }}>{c.nombre}</span>{" "}
                    <span className="cifra" style={{ color: "var(--ink-3)" }}>
                      · {c.telefono}
                    </span>
                  </span>
                  <Boton
                    variante="fantasma"
                    tamano="sm"
                    icono={<Trash2 size={15} strokeWidth={2} />}
                    onClick={() => eliminarContacto(c)}
                    aria-label={`Eliminar ${c.nombre}`}
                  />
                </li>
              ))}
            </ul>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              agregarContacto();
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, alignItems: "end" }}>
              <Campo etiqueta="Nombre">
                <input placeholder="Ej. Mensajero" value={nombreContacto} onChange={(e) => setNombreContacto(e.target.value)} />
              </Campo>
              <Campo etiqueta="WhatsApp (con indicativo)">
                <input
                  placeholder="57300000000"
                  value={telefonoContacto}
                  onChange={(e) => setTelefonoContacto(e.target.value)}
                  className="cifra"
                  inputMode="tel"
                />
              </Campo>
              <div>
                <Boton
                  type="submit"
                  variante="contorno"
                  icono={<Plus size={17} strokeWidth={2.2} />}
                  disabled={!nombreContacto.trim() || !telefonoContacto.trim()}
                >
                  Agregar
                </Boton>
              </div>
            </div>
          </form>
          {errorContacto && (
            <div style={{ marginTop: 10 }}>
              <Aviso tono="peligro">
                <span style={{ fontSize: 12 }}>{errorContacto}</span>
              </Aviso>
            </div>
          )}
          </div>
        </details>
      </div>
    </div>
  );
}
