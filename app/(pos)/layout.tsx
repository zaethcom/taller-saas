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
import { BarraSuperior } from "@/componentes/ui/barra-superior";
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
        <CerrarSesion oscuro={false} />
      </main>
    );
  }

  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const items: ItemNavLateral[] = [
    { href: "/vender", etiqueta: "Vender", icono: <ShoppingCart size={18} strokeWidth={2} /> },
    { href: "/recibir", etiqueta: "Recibir equipo", icono: <Inbox size={18} strokeWidth={2} /> },
    { href: "/entregar", etiqueta: "Entregar", icono: <PackageCheck size={18} strokeWidth={2} /> },
    { href: "/turno", etiqueta: "Turno", icono: <Clock size={18} strokeWidth={2} /> },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        etiquetaPuerta="POS"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <BarraSuperior nombre={perfil.nombre} rol={perfil.rol} puerta="pos" />
        <main style={{ padding: 20, maxWidth: 1280, margin: "0 auto" }}>{children}</main>
      </div>
    </div>
  );
}
