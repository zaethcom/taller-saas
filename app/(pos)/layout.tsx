/**
 * Puerta de caja: denso, de teclado, tablas y atajos. Corre en tablet
 * o computador, en las dos sedes.
 *
 * Solo entran admin, recepción y cajero -- ver lib/permisos.ts,
 * ROLES_POR_PUERTA.pos. Sin sesión, a /login; con sesión pero rol
 * equivocado, un mensaje específico en vez de un redirect mudo.
 */
import { redirect } from "next/navigation";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { Marca } from "@/componentes/ui/marca";
import { puedeEntrarA } from "@/lib/permisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutPos({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  if (!perfil) redirect("/login");
  if (!puedeEntrarA(perfil.rol, "pos")) {
    return (
      <main style={{ padding: 40 }}>
        <p>Tu rol ({perfil.rol}) no tiene acceso al POS.</p>
        <CerrarSesion />
      </main>
    );
  }

  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

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
        <Marca logoUrl={config.logoUrl} nombreEmpresa={perfil.empresaNombre} etiqueta="POS" />
        <nav style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="/vender">Vender</a>
          <a href="/recibir">Recibir equipo</a>
          <a href="/entregar">Entregar</a>
          <a href="/turno">Turno</a>
          <SelectorPuertas rol={perfil.rol} actual="pos" />
          <span style={{ opacity: 0.7, fontSize: 14 }}>{perfil.nombre}</span>
          <CerrarSesion />
        </nav>
      </header>
      <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>{children}</div>
    </div>
  );
}
