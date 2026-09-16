/**
 * Directorio de equipos de clientes (`producto`): la patineta o el
 * celular que entra a reparación, no el inventario propio de la tienda
 * (eso es /inventario, tabla `articulo`). El serial es el mismo entre
 * visitas -- esta pantalla es el directorio, el historial vive en cada
 * orden.
 */
import { Tag } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

export default async function PaginaEquipos() {
  const supabase = await clienteServidor();

  const { data: equipos } = await supabase
    .from("producto")
    .select("id, serial, tipo, marca, modelo, cliente:cliente_id ( nombre )")
    .order("creado_en", { ascending: false });

  return (
    <div>
      <TituloPantalla
        icono={<Tag size={24} strokeWidth={2} />}
        titulo="Equipos"
        descripcion="Los aparatos de los clientes, no el inventario propio de la tienda -- eso vive en Inventario."
      />

      {(equipos ?? []).length === 0 ? (
        <p style={{ color: "var(--ink-3)" }}>Todavía no hay equipos registrados.</p>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Serial</th>
                <th>Tipo</th>
                <th>Marca / Modelo</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              {(equipos ?? []).map((e) => (
                <tr key={e.id}>
                  <td className="cifra" style={{ fontWeight: 600 }}>
                    {e.serial}
                  </td>
                  <td style={{ textTransform: "capitalize", color: "var(--ink-2)" }}>{e.tipo}</td>
                  <td style={{ color: "var(--ink-2)" }}>{[e.marca, e.modelo].filter(Boolean).join(" ") || "—"}</td>
                  {/* @ts-expect-error -- join inferido como array */}
                  <td style={{ color: "var(--ink-2)" }}>{e.cliente?.nombre ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
