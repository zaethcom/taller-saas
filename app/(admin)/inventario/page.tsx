import { clienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaInventario() {
  const supabase = await clienteServidor();

  const [{ data: existencias }, { data: articulos }] = await Promise.all([
    supabase
      .from("existencia")
      .select("cantidad, repuesto:repuesto_id ( codigo, descripcion, precio_venta ), sede:sede_id ( nombre )")
      .order("cantidad", { ascending: true }),
    supabase
      .from("articulo")
      .select("numero, tipo, marca, modelo, precio_venta, estado, sede:sede_id ( nombre )")
      .order("numero", { ascending: false }),
  ]);

  return (
    <div>
      <h1>Inventario</h1>

      <h2 style={{ fontSize: 16 }}>Repuestos y accesorios a granel</h2>
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 32 }}>
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

      <h2 style={{ fontSize: 16 }}>
        Artículos individualizados{" "}
        <span style={{ fontWeight: 400, opacity: 0.6 }}>(patinetas, teléfonos… cada unidad con su etiqueta)</span>
      </h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Código</th>
            <th>Artículo</th>
            <th>Sede</th>
            <th>Estado</th>
            <th>Precio</th>
          </tr>
        </thead>
        <tbody>
          {(articulos ?? []).map((a, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ fontFamily: "monospace" }}>ART-{String(a.numero).padStart(6, "0")}</td>
              <td>{[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}</td>
              {/* @ts-expect-error -- join inferido como array */}
              <td>{a.sede?.nombre}</td>
              <td>{a.estado}</td>
              <td>${Math.round(a.precio_venta ?? 0).toLocaleString("es-CO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(articulos ?? []).length === 0 && (
        <p style={{ opacity: 0.6 }}>Todavía no se ha recibido ningún artículo individualizado.</p>
      )}
    </div>
  );
}
