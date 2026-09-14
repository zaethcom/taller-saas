/**
 * Puerta de administración. Solo entran admin, recepción y compras --
 * ver lib/permisos.ts, ROLES_POR_PUERTA.admin. Nótese que "recepción"
 * entra aquí para ver el tablero de órdenes, pero no a /usuarios --
 * esa distinción más fina (por página, no por puerta completa) queda
 * pendiente de lib/permisos.ts Accion cuando se construyan los botones
 * de escritura de cada pantalla.
 */
import { redirect } from "next/navigation";
import {
  ClipboardList,
  PackagePlus,
  Package,
  Tag,
  Tags,
  Building2,
  ArrowLeftRight,
  ShoppingBag,
  Users,
  Contact,
  CreditCard,
  Settings,
  BarChart3,
} from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { BarraSuperior } from "@/componentes/ui/barra-superior";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
import { BloqueMarca } from "@/componentes/ui/bloque-marca";
import { puede, puedeEntrarA } from "@/lib/permisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { clienteServidor } from "@/lib/supabase/servidor";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);

  if (!perfil) redirect("/login");
  if (!puedeEntrarA(perfil.rol, "admin")) {
    return (
      <main style={{ padding: 40 }}>
        <p>Tu rol ({perfil.rol}) no tiene acceso a esta sección.</p>
        <CerrarSesion oscuro={false} />
      </main>
    );
  }

  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const items: ItemNavLateral[] = [
    { href: "/ordenes", etiqueta: "Órdenes", icono: <ClipboardList size={18} strokeWidth={2} /> },
    { href: "/recepcion-mercancia", etiqueta: "Recibir mercancía", icono: <PackagePlus size={18} strokeWidth={2} /> },
    { href: "/inventario", etiqueta: "Inventario", icono: <Package size={18} strokeWidth={2} /> },
    { href: "/equipos", etiqueta: "Equipos", icono: <Tag size={18} strokeWidth={2} /> },
    { href: "/categorias", etiqueta: "Categorías", icono: <Tags size={18} strokeWidth={2} /> },
    ...(puede(perfil.rol, "gestionar_sedes")
      ? [{ href: "/sedes", etiqueta: "Sedes", icono: <Building2 size={18} strokeWidth={2} /> }]
      : []),
    { href: "/traslados", etiqueta: "Traslados", icono: <ArrowLeftRight size={18} strokeWidth={2} /> },
    { href: "/compras", etiqueta: "Compras", icono: <ShoppingBag size={18} strokeWidth={2} /> },
    { href: "/usuarios", etiqueta: "Usuarios", icono: <Users size={18} strokeWidth={2} /> },
    { href: "/metodos-pago", etiqueta: "Métodos de pago", icono: <CreditCard size={18} strokeWidth={2} /> },
    { href: "/clientes", etiqueta: "Clientes (CRM)", icono: <Contact size={18} strokeWidth={2} /> },
    { href: "/reportes", etiqueta: "Reportes", icono: <BarChart3 size={18} strokeWidth={2} /> },
    ...(puede(perfil.rol, "personalizar_empresa")
      ? [{ href: "/configuracion", etiqueta: "Configuración", icono: <Settings size={18} strokeWidth={2} /> }]
      : []),
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        etiquetaPuerta="Admin"
        pie={<BloqueMarca imagenUrl={config.imagenMarcaUrl} eslogan={config.eslogan} />}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <BarraSuperior nombre={perfil.nombre} rol={perfil.rol} puerta="admin" />
        <main style={{ padding: 20, maxWidth: 1180, margin: "0 auto" }}>{children}</main>
      </div>
    </div>
  );
}
