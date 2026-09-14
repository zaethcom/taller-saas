/**
 * Gestión de usuarios: crear, cambiar rol, y sobre todo, desactivar --
 * el requisito de la sección 7 del documento original: al retirar a un
 * trabajador, su usuario debe poder deshabilitarse de inmediato.
 */
import { Users } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { EditarCodigo } from "@/componentes/ui/editar-codigo";
import { TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

export default async function PaginaUsuarios() {
  const supabase = await clienteServidor();

  const { data: perfiles } = await supabase
    .from("perfil")
    .select("id, nombre, rol, activo, codigo, sede:sede_id ( nombre )")
    .order("nombre");

  return (
    <div>
      <TituloPantalla
        icono={<Users size={24} strokeWidth={2} />}
        titulo="Usuarios"
        descripcion="El código es un identificador corto para recibos y reportes -- no reemplaza el usuario y contraseña de Supabase, que sigue siendo la única forma de iniciar sesión."
      />

      <TarjetaTabla>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Sede</th>
              <th>Estado</th>
              <th>Código</th>
            </tr>
          </thead>
          <tbody>
            {(perfiles ?? []).map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                <td style={{ textTransform: "capitalize", color: "var(--ink-2)" }}>{p.rol}</td>
                {/* @ts-expect-error -- join inferido como array */}
                <td style={{ color: "var(--ink-2)" }}>{p.sede?.nombre ?? "—"}</td>
                <td>
                  <Etiqueta tono={p.activo ? "ok" : "neutro"} punto>
                    {p.activo ? "Activo" : "Deshabilitado"}
                  </Etiqueta>
                </td>
                <td>
                  <EditarCodigo perfilId={p.id} codigoInicial={p.codigo} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
    </div>
  );
}
