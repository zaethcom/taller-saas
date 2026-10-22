/**
 * Puerta de administración. Solo entran admin, recepción y compras --
 * ver lib/permisos.ts, ROLES_POR_PUERTA.admin. Nótese que "recepción"
 * entra aquí para ver el tablero de órdenes, pero no a /usuarios --
 * esa distinción más fina (por página, no por puerta completa) queda
 * pendiente de lib/permisos.ts Accion cuando se construyan los botones
 * de escritura de cada pantalla.
 */
import { redirect } from "next/navigation";
import { ClipboardList, Package, Tags, ShoppingBag, Users, Contact, CreditCard, Settings, BarChart3 } from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { BarraSuperior } from "@/componentes/ui/barra-superior";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
import { PestanasSeccion, type PestanaSeccion } from "@/componentes/ui/pestanas-seccion";
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

  // Con varias sedes permitidas, nadie trabaja sin decir en cuál está
  // (lib/sede-activa.ts) -- si no, la venta o el turno caerían en una
  // sede adivinada.
  if (!perfil.sedeId && perfil.sedesPermitidas.length > 1) redirect("/elegir-sede");

  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const veConfiguracion = puede(perfil.rol, "personalizar_empresa");

  // Las pantallas de administración se agrupan en pocas entradas del
  // menú; las demás quedan como pestañas dentro de cada una
  // (componentes/ui/pestanas-seccion.tsx). Las direcciones no cambian.
  const secciones: PestanaSeccion[][] = [
    [
      { href: "/inventario", etiqueta: "Existencias" },
      { href: "/recepcion-mercancia", etiqueta: "Recibir mercancía" },
      { href: "/traslados", etiqueta: "Traslados" },
      ...(puede(perfil.rol, "gestionar_inventario") ? [{ href: "/importar-catalogo", etiqueta: "Importar" }] : []),
    ],
    [
      { href: "/categorias", etiqueta: "Categorías" },
      { href: "/servicios", etiqueta: "Servicios" },
      { href: "/mano-obra", etiqueta: "Mano de obra" },
    ],
    [
      { href: "/clientes", etiqueta: "Clientes" },
      { href: "/equipos", etiqueta: "Equipos" },
    ],
    [
      { href: "/usuarios", etiqueta: "Usuarios" },
      ...(puede(perfil.rol, "gestionar_sedes") ? [{ href: "/sedes", etiqueta: "Sedes" }] : []),
    ],
    veConfiguracion
      ? [
          { href: "/configuracion", etiqueta: "General" },
          { href: "/metodos-pago", etiqueta: "Pagos" },
        ]
      : [],
  ];
  const incluye = (href: string) => secciones.find((s) => s[0]?.href === href)?.slice(1).map((p) => p.href);

  const items: ItemNavLateral[] = [
    { href: "/ordenes", etiqueta: "Órdenes", icono: <ClipboardList size={18} strokeWidth={2} /> },
    { href: "/compras", etiqueta: "Compras", icono: <ShoppingBag size={18} strokeWidth={2} /> },
    { href: "/inventario", etiqueta: "Inventario", icono: <Package size={18} strokeWidth={2} />, incluye: incluye("/inventario") },
    { href: "/categorias", etiqueta: "Catálogo", icono: <Tags size={18} strokeWidth={2} />, incluye: incluye("/categorias") },
    { href: "/clientes", etiqueta: "Clientes", icono: <Contact size={18} strokeWidth={2} />, incluye: incluye("/clientes") },
    ...(puede(perfil.rol, "ver_reportes")
      ? [{ href: "/reportes", etiqueta: "Reportes", icono: <BarChart3 size={18} strokeWidth={2} /> }]
      : []),
    {
      href: "/usuarios",
      etiqueta: puede(perfil.rol, "gestionar_sedes") ? "Usuarios y sedes" : "Usuarios",
      icono: <Users size={18} strokeWidth={2} />,
      incluye: incluye("/usuarios"),
      grupo: "Ajustes",
    },
    veConfiguracion
      ? { href: "/configuracion", etiqueta: "Configuración", icono: <Settings size={18} strokeWidth={2} />, incluye: incluye("/configuracion") }
      : { href: "/metodos-pago", etiqueta: "Métodos de pago", icono: <CreditCard size={18} strokeWidth={2} /> },
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
        <BarraSuperior nombre={perfil.nombre} rol={perfil.rol} sedeNombre={perfil.sedeNombre} puedeCambiarSede={perfil.sedesPermitidas.length > 1} puerta="admin" />
        <main style={{ padding: 20, maxWidth: 1180, margin: "0 auto" }}>
          <PestanasSeccion secciones={secciones} />
          {children}
        </main>
      </div>
    </div>
  );
}
