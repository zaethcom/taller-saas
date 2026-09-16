import { redirect } from "next/navigation";
import { Package, Boxes } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { FotoProducto } from "@/componentes/ui/foto-producto";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { FormularioRecepcion } from "@/componentes/inventario/formulario-recepcion";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** El encabezado de cada uno de los dos catálogos de esta pantalla. */
function Seccion({ icono, titulo, aclaracion }: { icono: React.ReactNode; titulo: string; aclaracion?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
      <h2 style={{ display: "flex", alignItems: "center", gap: 9 }}>
        {icono}
        {titulo}
      </h2>
      {aclaracion && <span style={{ fontSize: 13, color: "var(--ink-3)" }}>{aclaracion}</span>}
    </div>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
      {children}
    </Tarjeta>
  );
}

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
      <TituloPantalla
        icono={<Package size={24} strokeWidth={2} />}
        titulo="Inventario"
        descripcion="Lo que hay en cada sede, a granel y por unidad."
      />

      <section style={{ marginBottom: 32 }}>
        <Seccion icono={<Boxes size={19} strokeWidth={2} color="var(--ink-2)" />} titulo="Repuestos y accesorios a granel" />
        {editable && <FormularioRecepcion sedeIdDefault={perfil.sedeId} />}
        {(existencias ?? []).length === 0 ? (
          <Vacio>No hay repuestos en el catálogo.</Vacio>
        ) : (
          <div className="rejilla-catalogo">
            {(existencias ?? []).map((e, i) => {
              // @ts-expect-error -- join inferido como array
              const repuesto = e.repuesto as { id: string; codigo: string; descripcion: string; precio_venta: number; imagen_url: string | null };
              if (!repuesto) return null;
              const bajo = e.cantidad <= 2;
              return (
                <Tarjeta key={i} relleno={false} style={{ padding: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                  <FotoProducto
                    tipo="repuesto"
                    id={repuesto.id}
                    empresaId={perfil.empresaId}
                    imagenUrl={repuesto.imagen_url}
                    editable={editable}
                  />
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{repuesto.descripcion}</div>
                  <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                    {repuesto.codigo}
                    {/* @ts-expect-error -- join inferido como array */}
                    {e.sede?.nombre ? ` · ${e.sede.nombre}` : ""}
                  </div>
                  <div className="fila" style={{ justifyContent: "space-between", gap: 6 }}>
                    <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                      {fmt(repuesto.precio_venta)}
                    </span>
                    <Etiqueta tono={e.cantidad <= 0 ? "neutro" : bajo ? "aviso" : "ok"}>
                      <span className="cifra">{e.cantidad <= 0 ? "Agotado" : e.cantidad}</span>
                    </Etiqueta>
                  </div>
                </Tarjeta>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <Seccion
          icono={<Package size={19} strokeWidth={2} color="var(--ink-2)" />}
          titulo="Artículos individualizados"
          aclaracion="patinetas, teléfonos… cada unidad con su etiqueta"
        />
        {(articulos ?? []).length === 0 ? (
          <Vacio>Todavía no se ha recibido ningún artículo individualizado.</Vacio>
        ) : (
          <div className="rejilla-catalogo">
            {(articulos ?? []).map((a) => (
              <Tarjeta key={a.id} relleno={false} style={{ padding: 11, display: "flex", flexDirection: "column", gap: 8 }}>
                <FotoProducto
                  tipo="articulo"
                  id={a.id}
                  empresaId={perfil.empresaId}
                  imagenUrl={a.imagen_url}
                  editable={editable}
                />
                <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                  {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
                </div>
                <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                  ART-{String(a.numero).padStart(6, "0")}
                  {/* @ts-expect-error -- join inferido como array */}
                  {a.sede?.nombre ? ` · ${a.sede.nombre}` : ""}
                </div>
                <div className="fila" style={{ justifyContent: "space-between", gap: 6 }}>
                  <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                    {fmt(a.precio_venta ?? 0)}
                  </span>
                  <Etiqueta tono={a.estado === "disponible" ? "ok" : "neutro"}>
                    <span style={{ textTransform: "capitalize" }}>{a.estado}</span>
                  </Etiqueta>
                </div>
              </Tarjeta>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
