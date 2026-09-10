"use client";

/**
 * La lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad. Marcar
 * recibido es lo que cierra el ciclo: el técnico ya puede volver a
 * consumir ese repuesto desde /orden/[id]/repuestos si vuelve a entrar
 * al inventario (registrarlo en existencia es una acción manual de
 * /inventario, deliberadamente separada de esto -- llegar y consumir
 * son dos hechos distintos en el tiempo).
 */
import { useEffect, useState } from "react";
import { clienteNavegador } from "@/lib/supabase/cliente";

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
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

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
  }, []);

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
