/**
 * Gestión de usuarios: crear, cambiar rol, y sobre todo, desactivar --
 * el requisito de la sección 7 del documento original: al retirar a un
 * trabajador, su usuario debe poder deshabilitarse de inmediato.
 */
import { clienteServidor } from "@/lib/supabase/servidor";
import { EditarCodigo } from "@/componentes/ui/editar-codigo";

export default async function PaginaUsuarios() {
  const supabase = await clienteServidor();

  const { data: perfiles } = await supabase
    .from("perfil")
    .select("id, nombre, rol, activo, codigo, sede:sede_id ( nombre )")
    .order("nombre");

  return (
    <div>
      <h1>Usuarios</h1>
      <p style={{ opacity: 0.6, fontSize: 14 }}>
        El código es un identificador corto para recibos y reportes -- no reemplaza el usuario y
        contraseña de Supabase, que sigue siendo la única forma de iniciar sesión.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Sede</th>
            <th>Estado</th>
            <th>Código</th>
          </tr>
        </thead>
        <tbody>
          {(perfiles ?? []).map((p) => (
            <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{p.nombre}</td>
              <td>{p.rol}</td>
              {/* @ts-expect-error -- join inferido como array */}
              <td>{p.sede?.nombre ?? "—"}</td>
              <td>{p.activo ? "Activo" : "Deshabilitado"}</td>
              <td>
                <EditarCodigo perfilId={p.id} codigoInicial={p.codigo} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
