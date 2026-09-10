/**
 * Puerta del técnico. Botones grandes, una tarea por pantalla -- se usa
 * con guantes y con una sola mano mientras se sostiene el equipo.
 *
 * Solo entran admin y técnico -- ver lib/permisos.ts, ROLES_POR_PUERTA.taller.
 */
import { redirect } from "next/navigation";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { puedeEntrarA } from "@/lib/permisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutTaller({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  if (!perfil) redirect("/login");
  if (!puedeEntrarA(perfil.rol, "taller")) {
    return (
      <main style={{ padding: 40, background: "#0b1418", color: "white", minHeight: "100vh" }}>
        <p>Tu rol ({perfil.rol}) no tiene acceso a la app del taller.</p>
        <CerrarSesion />
      </main>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b1418", color: "white" }}>
      <header
        style={{
          padding: "14px 20px",
          borderBottom: "1px solid #223038",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <strong>Taller · {perfil.nombre}</strong>
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <SelectorPuertas rol={perfil.rol} actual="taller" />
          <CerrarSesion />
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
