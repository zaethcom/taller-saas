/**
 * Puerta de administración. Solo entran admin, recepción y compras --
 * ver lib/permisos.ts, ROLES_POR_PUERTA.admin. Nótese que "recepción"
 * entra aquí para ver el tablero de órdenes, pero no a /usuarios --
 * esa distinción más fina (por página, no por puerta completa) queda
 * pendiente de lib/permisos.ts Accion cuando se construyan los botones
 * de escritura de cada pantalla.
 */
import { redirect } from "next/navigation";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { puedeEntrarA } from "@/lib/permisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  if (!perfil) redirect("/login");
  if (!puedeEntrarA(perfil.rol, "admin")) {
    return (
      <main style={{ padding: 40 }}>
        <p>Tu rol ({perfil.rol}) no tiene acceso a esta sección.</p>
        <CerrarSesion />
      </main>
    );
  }

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
        <strong>Admin · {perfil.nombre}</strong>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/ordenes">Órdenes</a>
          <a href="/inventario">Inventario</a>
          <a href="/traslados">Traslados</a>
          <a href="/compras">Compras</a>
          <a href="/usuarios">Usuarios</a>
          <a href="/reportes">Reportes</a>
          <SelectorPuertas rol={perfil.rol} actual="admin" />
          <CerrarSesion />
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
