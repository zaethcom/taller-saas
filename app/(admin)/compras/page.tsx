"use client";

/**
 * Dos bandejas.
 *
 * Arriba, lo que el otro local me está pidiendo del almacén: se despacha
 * como traslado si lo hay, o se pasa a faltante si no. Esa bifurcación la
 * decide una persona mirando el estante, no la existencia registrada --
 * un inventario desactualizado mandaría a comprar algo que sí está.
 *
 * Abajo, la lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad. Marcar
 * recibido es lo que cierra el ciclo: el técnico ya puede volver a
 * consumir ese repuesto desde /orden/[id]/repuestos si vuelve a entrar
 * al inventario (registrarlo en existencia es una acción manual de
 * /inventario, deliberadamente separada de esto -- llegar y consumir
 * son dos hechos distintos en el tiempo).
 */
import { useEffect, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/cliente";

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

interface Faltante {
  id: string;
  descripcion: string;
  cantidad: number;
  prioridad: string;
  estado: string;
  creada_en: string;
  orden: { numero: number } | { numero: number }[] | null;
}

export default function PaginaCompras() {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [pedidos, setPedidos] = useState<Solicitud[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    // La bandeja de pedidos va por la API y no por el cliente del
    // navegador: filtra por la sede del usuario, que el servidor conoce.
    fetch("/api/repuesto-solicitud?bandeja=recibidas")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setPedidos(Array.isArray(d) ? d : []))
      .catch(() => setPedidos([]));

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
  }, []);

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

  async function marcarRecibido(id: string) {
    setProcesando(id);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${id}/recibir`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await cargar();
    } catch {
      // El estado no cambió; el usuario ve la fila igual y puede reintentar.
    } finally {
      setProcesando(null);
    }
  }

  function numeroOrden(orden: Faltante["orden"]) {
    if (!orden) return "—";
    return Array.isArray(orden) ? orden[0]?.numero : orden.numero;
  }

  if (cargando) return <p>Cargando…</p>;

  return (
    <div>
      <h1>Compras</h1>

      {aviso && <p style={{ padding: 8, background: "#eef", borderRadius: 4 }}>{aviso}</p>}

      <section style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 16 }}>Te piden del almacén</h2>
        {pedidos.length === 0 ? (
          <p style={{ opacity: 0.6, fontSize: 14 }}>Nadie está pidiendo nada ahora mismo.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
                <th>Repuesto</th>
                <th>Lo pide</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>
                    {p.descripcion}
                    {p.repuesto && <span style={{ opacity: 0.6 }}> · {p.repuesto.codigo}</span>}
                  </td>
                  <td>{p.solicitante?.nombre ?? "—"}</td>
                  <td>{p.cantidad}</td>
                  <td>{p.estado}</td>
                  <td>
                    {p.estado === "pedido_a_sede" && (
                      <span style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => accionSobrePedido(p.id, "despachar")}
                          disabled={procesando === p.id}
                        >
                          Despachar
                        </button>
                        <button
                          onClick={() => accionSobrePedido(p.id, "sin-existencia")}
                          disabled={procesando === p.id}
                        >
                          No tengo
                        </button>
                      </span>
                    )}
                    {p.estado === "en_traslado" && (
                      <span style={{ opacity: 0.6, fontSize: 12 }}>En camino</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <h2 style={{ fontSize: 16 }}>Faltantes por comprar</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
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
            <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{f.descripcion}</td>
              <td>#{numeroOrden(f.orden)}</td>
              <td>{f.cantidad}</td>
              <td>{f.prioridad}</td>
              <td>{f.estado}</td>
              <td>{new Date(f.creada_en).toLocaleDateString("es-CO")}</td>
              <td>
                {f.estado === "faltante" && (
                  <button onClick={() => marcarRecibido(f.id)} disabled={procesando === f.id}>
                    Marcar recibido
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {faltantes.length === 0 && <p>No hay faltantes pendientes.</p>}
    </div>
  );
}
