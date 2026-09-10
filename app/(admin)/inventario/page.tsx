import { clienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaInventario() {
  const supabase = await clienteServidor();

  const { data: existencias } = await supabase
    .from("existencia")
    .select("cantidad, repuesto:repuesto_id ( codigo, descripcion, precio_venta ), sede:sede_id ( nombre )")
    .order("cantidad", { ascending: true });

  return (
    <div>
      <h1>Inventario</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Código</th>
            <th>Repuesto</th>
            <th>Sede</th>
            <th>Existencia</th>
            <th>Precio</th>
          </tr>
        </thead>
        <tbody>
          {(existencias ?? []).map((e, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              {/* @ts-expect-error -- join inferido como array */}
              <td>{e.repuesto?.codigo}</td>
              {/* @ts-expect-error -- idem */}
              <td>{e.repuesto?.descripcion}</td>
              {/* @ts-expect-error -- idem */}
              <td>{e.sede?.nombre}</td>
              <td style={{ color: e.cantidad <= 2 ? "#c0392b" : undefined, fontWeight: e.cantidad <= 2 ? 700 : 400 }}>
                {e.cantidad}
              </td>
              {/* @ts-expect-error -- idem */}
              <td>${Math.round(e.repuesto?.precio_venta ?? 0).toLocaleString("es-CO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
