/**
 * El tablero de todas las órdenes de la empresa. Server Component: la
 * consulta corre en el servidor con la sesión del usuario, así que RLS
 * filtra por empresa_actual() sin que esta página tenga que acordarse
 * de agregar un .eq("empresa_id", ...) en ningún lado.
 */
import Link from "next/link";
import { ClipboardList, Inbox } from "lucide-react";
import { type Estado } from "@/lib/estados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { Aviso } from "@/componentes/ui/campo";
import { BotonEnlace } from "@/componentes/ui/boton";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

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
    return <Aviso tono="peligro">No se pudo cargar el tablero: {error.message}</Aviso>;
  }

  const filas = ordenes ?? [];

  return (
    <div>
      <TituloPantalla
        icono={<ClipboardList size={24} strokeWidth={2} />}
        titulo="Órdenes"
        descripcion="Las últimas 50 órdenes de las dos sedes."
        acciones={
          <BotonEnlace href="/recibir" variante="primario" icono={<Inbox size={18} strokeWidth={2} />}>
            Recibir equipo
          </BotonEnlace>
        }
      />

      {filas.length === 0 ? (
        <Tarjeta style={{ textAlign: "center", padding: 36, borderStyle: "dashed" }}>
          <ClipboardList size={30} strokeWidth={1.6} color="var(--ink-3)" aria-hidden />
          <p style={{ margin: "10px 0 0", fontWeight: 700 }}>No hay órdenes todavía</p>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            La primera nace al recibir un equipo en caja.
          </p>
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Equipo</th>
                <th>Sede</th>
                <th>Estado</th>
                <th>Motivo</th>
                <th>Abierta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orden/${o.id}`} className="cifra" style={{ fontWeight: 800 }}>
                      #{o.numero}
                    </Link>
                  </td>
                  <td>
                    {/* @ts-expect-error -- join inferido como array por el tipado genérico de supabase-js */}
                    <div style={{ fontWeight: 600 }}>{o.producto?.marca} {o.producto?.modelo}</div>
                    {/* @ts-expect-error -- idem */}
                    <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>{o.producto?.serial}</div>
                  </td>
                  {/* @ts-expect-error -- idem */}
                  <td>{o.sede?.nombre}</td>
                  <td>
                    <EstadoOrden estado={o.estado as Estado} />
                  </td>
                  <td style={{ color: "var(--ink-2)" }}>{o.motivo}</td>
                  <td className="cifra" style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                    {new Date(o.abierta_en).toLocaleDateString("es-CO")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
