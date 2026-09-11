/**
 * Puerta de caja: denso, de teclado, tablas y atajos. Corre en tablet
 * o computador, en las dos sedes.
 *
 * Solo entran admin, recepción y cajero -- ver lib/permisos.ts,
 * ROLES_POR_PUERTA.pos. Sin sesión, a /login; con sesión pero rol
 * equivocado, un mensaje específico en vez de un redirect mudo.
 */
import { redirect } from "next/navigation";
import { ShoppingCart, Inbox, PackageCheck, Clock } from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
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

  const items: ItemNavLateral[] = [
    { href: "/vender", etiqueta: "Vender", Icono: ShoppingCart },
    { href: "/recibir", etiqueta: "Recibir equipo", Icono: Inbox },
    { href: "/entregar", etiqueta: "Entregar", Icono: PackageCheck },
    { href: "/turno", etiqueta: "Turno", Icono: Clock },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        colorPrincipal={config.colorPrincipal}
        etiquetaPuerta="POS"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #ddd",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 16,
          }}
        >
          <SelectorPuertas rol={perfil.rol} actual="pos" />
          <span style={{ opacity: 0.7, fontSize: 14 }}>{perfil.nombre}</span>
          <CerrarSesion />
        </header>
        <div style={{ padding: 20, maxWidth: 720, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
