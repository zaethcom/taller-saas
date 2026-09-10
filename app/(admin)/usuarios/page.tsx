/**
 * Gestión de usuarios: crear, cambiar rol, y sobre todo, desactivar --
 * el requisito de la sección 7 del documento original: al retirar a un
 * trabajador, su usuario debe poder deshabilitarse de inmediato.
 */
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function PaginaUsuarios() {
  const supabase = await clienteServidor();

  const { data: perfiles } = await supabase
    .from("perfil")
    .select("id, nombre, rol, activo, sede:sede_id ( nombre )")
    .order("nombre");

  return (
    <div>
      <h1>Usuarios</h1>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>Nombre</th>
            <th>Rol</th>
            <th>Sede</th>
            <th>Estado</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
