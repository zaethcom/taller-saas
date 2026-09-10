/**
 * La lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad.
 */
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaCompras() {
  const supabase = await clienteServidor();

  const { data: faltantes } = await supabase
    .from("repuesto_solicitud")
    .select("id, descripcion, cantidad, prioridad, estado, creada_en, orden:orden_id ( numero )")
    .neq("estado", "consumido")
    .order("creada_en", { ascending: true });

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
          </tr>
        </thead>
        <tbody>
          {(faltantes ?? []).map((f) => (
            <tr key={f.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{f.descripcion}</td>
              {/* @ts-expect-error -- join inferido como array */}
              <td>#{f.orden?.numero}</td>
              <td>{f.cantidad}</td>
              <td>{f.prioridad}</td>
              <td>{f.estado}</td>
              <td>{new Date(f.creada_en).toLocaleDateString("es-CO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(faltantes ?? []).length === 0 && <p>No hay faltantes pendientes.</p>}
    </div>
  );
}
