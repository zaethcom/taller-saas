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
 * Lo recibido sale de la lista apenas se confirma (no se borra: el
 * técnico todavía lo ve en su orden para consumirlo); "Mostrar
 * recibidos" lo trae de vuelta para consultar.
 *
 * Arriba de la lista hay una segunda bandeja: lo que el otro local me
 * está pidiendo del almacén. Se despacha como traslado si lo hay, o se
 * pasa a faltante si no -- y entonces cae en la lista de abajo, que es el
 * flujo que ya existía. Esa bifurcación la decide una persona mirando el
 * estante, no la existencia registrada: un inventario desactualizado
 * mandaría a comprar algo que sí está.
 *
 * WhatsApp: se marcan con check los faltantes que van en el pedido y se
 * elige a qué contacto va (mensajero, almacén, proveedor... los que la
 * empresa configure abajo). Arma un enlace wa.me con el texto ya
 * escrito -- sin backend, sin cuenta de negocio de Meta.
 */
import { Fragment, useEffect, useState } from "react";
import { ShoppingBag, PackageCheck, MessageCircle, Truck, X, Plus, Trash2 } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { enlaceWhatsapp, mensajePedido } from "@/lib/compras/whatsapp";

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

interface Contacto {
  id: string;
  nombre: string;
  telefono: string;
}

interface Sede {
  id: string;
  nombre: string;
}

/** Urgente grita, normal no: si todo se ve igual, nada se atiende primero. */
/** Lo que otra sede me pide del almacén. Trae más campos que un faltante:
 *  quién lo pide y contra qué repuesto del catálogo, que en un faltante
 *  (descripción libre del técnico) todavía no se sabe. */
interface Solicitud {
  id: string;
  descripcion: string;
  cantidad: number;
  prioridad: string;
  estado: string;
  creada_en: string;
  orden: { numero: number } | null;
  solicitante: { id: string; nombre: string } | null;
  repuesto: { id: string; codigo: string } | null;
}

const TONO_PRIORIDAD: Record<string, TonoEtiqueta> = {
  urgente: "peligro",
  alta: "aviso",
  normal: "neutro",
};

const CASILLA = { width: 18, height: 18, padding: 0, accentColor: "var(--accent)", cursor: "pointer" } as const;

export default function PaginaCompras() {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [pedidos, setPedidos] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sedeIdDefault, setSedeIdDefault] = useState<string | null>(null);

  const [mostrarRecibidos, setMostrarRecibidos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [contactoId, setContactoId] = useState("");
  const [nombreContacto, setNombreContacto] = useState("");
  const [telefonoContacto, setTelefonoContacto] = useState("");
  const [errorContacto, setErrorContacto] = useState<string | null>(null);

  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<RepuestoResultado[]>([]);
  const [repuestoSeleccionado, setRepuestoSeleccionado] = useState<RepuestoResultado | null>(null);
  const [cantidad, setCantidad] = useState("");
  const [sedeId, setSedeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar(conRecibidos = mostrarRecibidos) {
    // La bandeja de pedidos va por la API y no por el cliente del
    // navegador: filtra por la sede activa, que el servidor conoce.
    fetch("/api/repuesto-solicitud?bandeja=recibidas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPedidos(Array.isArray(d) ? d : []))
      .catch(() => setPedidos([]));

    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, prioridad, estado, creada_en, orden:orden_id ( numero )")
      .in("estado", conRecibidos ? ["faltante", "recibido"] : ["faltante"])
      .order("creada_en", { ascending: true });
    const lista = (data as Faltante[]) ?? [];
    setFaltantes(lista);
    // Lo que ya no está como faltante no puede seguir marcado para enviar.
    setSeleccionados((prev) => new Set(lista.filter((f) => f.estado === "faltante" && prev.has(f.id)).map((f) => f.id)));
    setCargando(false);
  }

  async function accionSobrePedido(id: string, accion: "despachar" | "sin-existencia") {
    setProcesando(id);
    setAviso(null);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${id}/${accion}`, { method: "POST" });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      setAviso(
        accion === "despachar"
          ? `Despachado como traslado #${cuerpo.traslado?.numero}. Falta que lo reciban allá.`
          : "Marcado sin existencia. Pasa a la lista de compras.",
      );
      await cargar();
    } catch (e) {
      setAviso(e instanceof Error ? e.message : "No se pudo procesar el pedido");
    } finally {
      setProcesando(null);
    }
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
    Promise.all([fetch("/api/perfil"), fetch("/api/sedes")])
      .then(async ([resPerfil, resSedes]) => {
        const perfil = await resPerfil.json();
        const listaSedes = await resSedes.json();
        setSedeIdDefault(perfil.sedeId ?? null);
        setSedes(Array.isArray(listaSedes) ? listaSedes : []);
      })
      .catch(() => {});
    // cargar lee mostrarRecibidos; aquí solo interesa la carga inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  async function confirmarRecibido(f: Faltante) {
    const id = f.id;
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
      setAviso(`${f.descripcion} quedó recibido y salió de la lista.`);
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
        ordenNumero: numeroOrden(f.orden) as number | undefined,
        prioridad: f.prioridad,
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
        icono={<ShoppingBag size={24} strokeWidth={2} />}
        titulo="Compras"
        descripcion="Lo que el taller pidió y todavía no llega, en orden de antigüedad."
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

        {pedidos.length > 0 && (
          <section>
            <h2 style={{ fontSize: 15, margin: "0 0 10px" }}>Te piden del almacén</h2>
            <TarjetaTabla>
              <table>
                <thead>
                  <tr>
                    <th>Repuesto</th>
                    <th>Lo pide</th>
                    <th>Cantidad</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>
                        {p.descripcion}
                        {p.repuesto && (
                          <span className="cifra" style={{ color: "var(--ink-3)", fontWeight: 400 }}>
                            {" "}
                            · {p.repuesto.codigo}
                          </span>
                        )}
                      </td>
                      <td>{p.solicitante?.nombre ?? "—"}</td>
                      <td className="cifra">{p.cantidad}</td>
                      <td>
                        <Etiqueta tono={p.estado === "pedido_a_sede" ? "aviso" : "info"}>
                          {p.estado === "pedido_a_sede" ? "te lo piden" : "en camino"}
                        </Etiqueta>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {p.estado === "pedido_a_sede" && (
                          <span style={{ display: "inline-flex", gap: 8 }}>
                            <Boton
                              variante="primario"
                              tamano="sm"
                              icono={<Truck size={15} strokeWidth={2} />}
                              onClick={() => accionSobrePedido(p.id, "despachar")}
                              disabled={procesando === p.id}
                            >
                              Despachar
                            </Boton>
                            <Boton
                              variante="contorno"
                              tamano="sm"
                              onClick={() => accionSobrePedido(p.id, "sin-existencia")}
                              disabled={procesando === p.id}
                            >
                              No tengo
                            </Boton>
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TarjetaTabla>
          </section>
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
                    Agrega un contacto de WhatsApp abajo (mensajero, almacén…).
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
              {mostrarRecibidos ? "No hay faltantes ni recibidos sin consumir" : "No hay faltantes pendientes"}
            </p>
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              Aparecen aquí solos cuando un técnico marca un repuesto como faltante.
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
                        <td colSpan={8} style={{ background: "var(--surface-2)" }}>
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
                                    onClick={() => confirmarRecibido(f)}
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

        <Tarjeta>
          <h2 style={{ marginBottom: 4 }}>Contactos de WhatsApp</h2>
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
        </Tarjeta>
      </div>
    </div>
  );
}
