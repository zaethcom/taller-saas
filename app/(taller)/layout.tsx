/**
 * Puerta del técnico. Botones grandes, una tarea por pantalla -- se usa
 * con guantes y con una sola mano mientras se sostiene el equipo.
 *
 * Solo entran admin y técnico -- ver lib/permisos.ts, ROLES_POR_PUERTA.taller.
 */
import { redirect } from "next/navigation";
import { ScanLine } from "lucide-react";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { BarraSuperior } from "@/componentes/ui/barra-superior";
import { BarraLateral, type ItemNavLateral } from "@/componentes/ui/barra-lateral";
import { BloqueMarca } from "@/componentes/ui/bloque-marca";
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
      <main className="puerta-oscura"
        style={{ padding: 40, minHeight: "100vh" }}>
        <p>Tu rol ({perfil.rol}) no tiene acceso a la app del taller.</p>
        <CerrarSesion oscuro={false} />
      </main>
    );
  }

  // La puerta del taller es siempre oscura a propósito -- visibilidad y
  // batería en un celular usado con una mano, sin importar el tema
  // claro/oscuro/alto contraste que la empresa haya elegido para el
  // resto de la aplicación. Lo que sí toma de la empresa es su marca.
  const config = await obtenerConfiguracion(supabase, perfil.empresaId);

  const items: ItemNavLateral[] = [
    { href: "/escanear", etiqueta: "Escanear", icono: <ScanLine size={18} strokeWidth={2} /> },
  ];

  return (
    <div className="puerta-oscura" style={{ minHeight: "100vh", display: "flex" }}>
      <BarraLateral
        items={items}
        logoUrl={config.logoUrl}
        nombreEmpresa={perfil.empresaNombre}
        etiquetaPuerta="Taller"
        pie={<BloqueMarca imagenUrl={config.imagenMarcaUrl} eslogan={config.eslogan} />}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <BarraSuperior nombre={perfil.nombre} rol={perfil.rol} puerta="taller" />
        <main style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>{children}</main>
      </div>
    </div>
  );
}
