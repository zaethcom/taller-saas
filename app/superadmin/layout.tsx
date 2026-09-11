/**
 * Puerta del superadministrador -- carpeta REAL, no un grupo de rutas:
 * a propósito queda en /superadmin, no escondida como (pos)/(taller)/
 * (admin), porque esto no es una empresa más: es la plataforma. Nadie
 * entra aquí por tener un rol dentro de una empresa -- entra por tener
 * fila propia en la tabla `superadmin` (0020_superadmin.sql).
 */
import { redirect } from "next/navigation";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutSuperadmin({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const superadmin = await obtenerSuperadminActual(supabase);

  if (!superadmin) redirect("/login");

  return (
    <div style={{ minHeight: "100vh" }}>
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #ddd",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong>Superadmin · {superadmin.nombre}</strong>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/superadmin/empresas">Empresas</a>
          <CerrarSesion />
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
