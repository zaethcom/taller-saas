/**
 * El tablero de todas las órdenes de la empresa. Server Component: la
 * consulta corre en el servidor con la sesión del usuario, así que RLS
 * filtra por empresa_actual() sin que esta página tenga que acordarse
 * de agregar un .eq("empresa_id", ...) en ningún lado.
 */
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaOrdenes() {
  const supabase = await clienteServidor();

  const { data: ordenes, error } = await supabase
    .from("orden")
    .select(
      `
      id, numero, estado, motivo, abierta_en,
      producto:producto_id ( serial, marca, modelo ),
      sede:sede_id ( nombre )
    `,
    )
    .order("abierta_en", { ascending: false })
    .limit(50);

  if (error) {
    return <p>No se pudo cargar el tablero: {error.message}</p>;
  }

  return (
    <div>
      <h1>Órdenes</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>#</th>
            <th>Equipo</th>
            <th>Sede</th>
            <th>Estado</th>
            <th>Motivo</th>
            <th>Abierta</th>
          </tr>
        </thead>
        <tbody>
          {(ordenes ?? []).map((o) => (
            <tr key={o.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>
                <a href={`/orden/${o.id}`}>#{o.numero}</a>
              </td>
              {/* @ts-expect-error -- join inferido como array por el tipado genérico de supabase-js */}
              <td>{o.producto?.marca} {o.producto?.modelo} · {o.producto?.serial}</td>
              {/* @ts-expect-error -- idem */}
              <td>{o.sede?.nombre}</td>
              <td>{ETIQUETA_ESTADO[o.estado as Estado]}</td>
              <td>{o.motivo}</td>
              <td>{new Date(o.abierta_en).toLocaleDateString("es-CO")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(ordenes ?? []).length === 0 && <p>No hay órdenes todavía.</p>}
    </div>
  );
}
