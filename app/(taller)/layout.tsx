/**
 * Puerta del técnico. Botones grandes, una tarea por pantalla -- se usa
 * con guantes y con una sola mano mientras se sostiene el equipo.
 *
 * Solo entran admin y técnico -- ver lib/permisos.ts, ROLES_POR_PUERTA.taller.
 */
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
import { puedeEntrarA } from "@/lib/permisos";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion } from "@/lib/configuracion";
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

  // La puerta del taller es siempre oscura a propósito -- visibilidad y
  // batería en un celular usado con una mano, sin importar el tema
  // claro/oscuro/alto contraste que la empresa haya elegido para el
  // resto de la aplicación. Lo que sí toma de la empresa es su marca.
  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const items: ItemNavLateral[] = [{ href: "/escanear", etiqueta: "Escanear", Icono: ScanLine }];

  return (
    <div style={{ minHeight: "100vh", background: "#0b1418", color: "white", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        colorPrincipal={config.colorPrincipal}
        etiquetaPuerta="Taller"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid #223038",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: 16,
          }}
        >
          <SelectorPuertas rol={perfil.rol} actual="taller" />
          <span style={{ opacity: 0.7, fontSize: 14 }}>{perfil.nombre}</span>
          <CerrarSesion />
        </header>
        <div style={{ padding: 20, maxWidth: 480, margin: "0 auto" }}>{children}</div>
      </div>
    </div>
  );
}
