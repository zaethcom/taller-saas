/**
 * Recibir mercancía: una sola pantalla con dos pestañas. Repuestos (a
 * granel, se suman a la existencia de una sede) y Equipos (cada unidad
 * con su propia etiqueta: patinetas, teléfonos…). Antes los repuestos
 * se recibían desde un formulario plegado en /inventario.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { FormularioRecepcion } from "@/componentes/inventario/formulario-recepcion";
import { RecepcionArticulos } from "@/componentes/inventario/recepcion-articulos";

export default async function PaginaRecepcionMercancia({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) redirect("/login");
  const equipos = (await searchParams).ver === "equipos";

  return (
    <div>
      <TituloPantalla titulo="Recibir mercancía" />
      <div className="fila" style={{ gap: 6, marginBottom: 16 }}>
        <Link href="/recepcion-mercancia" className={`pastilla${equipos ? "" : " pastilla-activa"}`}>
          Repuestos
        </Link>
        <Link href="/recepcion-mercancia?ver=equipos" className={`pastilla${equipos ? " pastilla-activa" : ""}`}>
          Equipos
        </Link>
      </div>
      {equipos ? <RecepcionArticulos /> : <FormularioRecepcion sedeIdDefault={perfil.sedeId} fijo />}
    </div>
  );
}
