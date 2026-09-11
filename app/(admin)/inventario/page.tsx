import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { FotoProducto } from "@/componentes/ui/foto-producto";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default async function PaginaInventario() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  // El layout de (admin) ya redirige si no hay perfil -- este chequeo es
  // solo para que TypeScript sepa que perfil.empresaId existe más abajo.
  if (!perfil) redirect("/login");
  const editable = puede(perfil.rol, "gestionar_inventario");

  const [{ data: existencias }, { data: articulos }] = await Promise.all([
    supabase
      .from("existencia")
      .select(
        "cantidad, repuesto:repuesto_id ( id, codigo, descripcion, precio_venta, imagen_url ), sede:sede_id ( nombre )",
      )
      .order("cantidad", { ascending: true }),
    supabase
      .from("articulo")
      .select("id, numero, tipo, marca, modelo, precio_venta, imagen_url, estado, sede:sede_id ( nombre )")
      .order("numero", { ascending: false }),
  ]);

  return (
    <div>
      <h1>Inventario</h1>

      <h2 style={{ fontSize: 16 }}>Repuestos y accesorios a granel</h2>
      {(existencias ?? []).length === 0 ? (
        <p style={{ opacity: 0.6 }}>No hay repuestos en el catálogo.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 32,
          }}
        >
          {(existencias ?? []).map((e, i) => {
            // @ts-expect-error -- join inferido como array
            const repuesto = e.repuesto as { id: string; codigo: string; descripcion: string; precio_venta: number; imagen_url: string | null };
            if (!repuesto) return null;
            return (
              <div key={i} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
                <FotoProducto
                  tipo="repuesto"
                  id={repuesto.id}
                  empresaId={perfil.empresaId}
                  imagenUrl={repuesto.imagen_url}
                  editable={editable}
                />
                <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>{repuesto.descripcion}</div>
                <div style={{ fontSize: 11, opacity: 0.6 }}>
                  {repuesto.codigo} ·{" "}
                  {/* @ts-expect-error -- join inferido como array */}
                  {e.sede?.nombre}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    marginTop: 4,
                    color: e.cantidad <= 2 ? "#c0392b" : undefined,
                    fontWeight: e.cantidad <= 2 ? 700 : 400,
                  }}
                >
                  {e.cantidad} en existencia
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmt(repuesto.precio_venta)}</div>
              </div>
            );
          })}
        </div>
      )}

      <h2 style={{ fontSize: 16 }}>
        Artículos individualizados{" "}
        <span style={{ fontWeight: 400, opacity: 0.6 }}>(patinetas, teléfonos… cada unidad con su etiqueta)</span>
      </h2>
      {(articulos ?? []).length === 0 ? (
        <p style={{ opacity: 0.6 }}>Todavía no se ha recibido ningún artículo individualizado.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap: 12,
          }}
        >
          {(articulos ?? []).map((a) => (
            <div key={a.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 10 }}>
              <FotoProducto
                tipo="articulo"
                id={a.id}
                empresaId={perfil.empresaId}
                imagenUrl={a.imagen_url}
                editable={editable}
              />
              <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6, fontFamily: "monospace" }}>
                ART-{String(a.numero).padStart(6, "0")}
              </div>
              <div style={{ fontSize: 11, opacity: 0.6 }}>
                {/* @ts-expect-error -- join inferido como array */}
                {a.sede?.nombre} · {a.estado}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{fmt(a.precio_venta ?? 0)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
