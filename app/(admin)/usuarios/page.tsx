/**
 * Gestión de usuarios: crear, cambiar rol, y sobre todo, desactivar --
 * el requisito de la sección 7 del documento original: al retirar a un
 * trabajador, su usuario debe poder deshabilitarse de inmediato.
 */
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { EditarCodigo } from "@/componentes/ui/editar-codigo";
import { NuevoUsuario } from "@/componentes/usuarios/nuevo-usuario";
import { EditarSedes } from "@/componentes/usuarios/editar-sedes";
import { EliminarUsuario } from "@/componentes/usuarios/eliminar-usuario";
import { TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

export default async function PaginaUsuarios() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) redirect("/login");

  const [{ data: perfiles }, { data: sedes }, { data: accesos }] = await Promise.all([
    // Los desactivados (DELETE /api/usuarios/<id> con historial) ya no
    // se listan: para quien administra, están eliminados.
    supabase.from("perfil").select("id, nombre, rol, codigo, sede_id").eq("activo", true).order("nombre"),
    supabase.from("sede").select("id, nombre").order("nombre"),
    supabase.from("perfil_sede").select("perfil_id, sede_id"),
  ]);
  const gestiona = puede(perfil.rol, "gestionar_usuarios");

  // Las sedes a las que entra cada usuario (0042_perfil_sede.sql): sus
  // filas de perfil_sede más su sede principal, igual que
  // lib/sede-activa.ts. Los admin entran a todas.
  function permitidasDe(p: { id: string; sede_id: string | null }): string[] {
    const ids = new Set((accesos ?? []).filter((a) => a.perfil_id === p.id).map((a) => a.sede_id));
    if (p.sede_id) ids.add(p.sede_id);
    return [...ids];
  }
  function nombresDe(ids: string[]): string {
    const nombres = (sedes ?? []).filter((s) => ids.includes(s.id)).map((s) => s.nombre);
    return nombres.length ? nombres.join(", ") : "—";
  }

  return (
    <div>
      <TituloPantalla
        icono={<Users size={24} strokeWidth={2} />}
        titulo="Usuarios"
        descripcion="El código es un identificador corto para recibos y reportes -- no reemplaza el usuario y contraseña de Supabase, que sigue siendo la única forma de iniciar sesión."
      />

      {gestiona && <NuevoUsuario />}

      <TarjetaTabla>
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Sedes</th>
              <th>Código</th>
              {gestiona && <th />}
            </tr>
          </thead>
          <tbody>
            {(perfiles ?? []).map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.nombre}</td>
                <td style={{ textTransform: "capitalize", color: "var(--ink-2)" }}>{p.rol}</td>
                <td>
                  {p.rol === "admin" ? (
                    <span style={{ color: "var(--ink-2)" }}>Todas</span>
                  ) : gestiona ? (
                    <EditarSedes perfilId={p.id} sedes={sedes ?? []} permitidasIniciales={permitidasDe(p)} />
                  ) : (
                    <span style={{ color: "var(--ink-2)" }}>{nombresDe(permitidasDe(p))}</span>
                  )}
                </td>
                <td>
                  <EditarCodigo perfilId={p.id} codigoInicial={p.codigo} />
                </td>
                {gestiona && (
                  <td>{p.id !== perfil.id && <EliminarUsuario perfilId={p.id} nombre={p.nombre} />}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </TarjetaTabla>
    </div>
  );
}
