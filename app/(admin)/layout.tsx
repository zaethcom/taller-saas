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
  Tags,
  ArrowLeftRight,
  ShoppingBag,
  Users,
  CreditCard,
  Settings,
  BarChart3,
} from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
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
        <CerrarSesion />
      </main>
    );
  }

  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const items: ItemNavLateral[] = [
    { href: "/ordenes", etiqueta: "Órdenes", Icono: ClipboardList },
    { href: "/recepcion-mercancia", etiqueta: "Recibir mercancía", Icono: PackagePlus },
    { href: "/inventario", etiqueta: "Inventario", Icono: Package },
    { href: "/categorias", etiqueta: "Categorías", Icono: Tags },
    { href: "/traslados", etiqueta: "Traslados", Icono: ArrowLeftRight },
    { href: "/compras", etiqueta: "Compras", Icono: ShoppingBag },
    { href: "/usuarios", etiqueta: "Usuarios", Icono: Users },
    { href: "/metodos-pago", etiqueta: "Métodos de pago", Icono: CreditCard },
    ...(puede(perfil.rol, "personalizar_empresa")
      ? [{ href: "/configuracion", etiqueta: "Configuración", Icono: Settings }]
      : []),
    { href: "/reportes", etiqueta: "Reportes", Icono: BarChart3 },
  ];

  return (
    <div style={{ minHeight: "100vh", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        colorPrincipal={config.colorPrincipal}
        etiquetaPuerta="Admin"
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
          <SelectorPuertas rol={perfil.rol} actual="admin" />
          <span style={{ opacity: 0.7, fontSize: 14 }}>{perfil.nombre}</span>
          <CerrarSesion />
        </header>
        <div style={{ padding: 20, maxWidth: 960, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
