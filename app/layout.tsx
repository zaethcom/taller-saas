import type { Metadata, Viewport } from "next";
import { Archivo, Saira_Condensed } from "next/font/google";
import "./globals.css";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion, CONFIG_POR_DEFECTO } from "@/lib/configuracion";
import { RegistroServiceWorker } from "@/componentes/registro-service-worker";
import { cookies } from "next/headers";
import { COOKIE_CODIGO_EMPRESA, parametrosEmpresa } from "@/lib/icono-app";

/**
 * Las dos familias del sistema, autoalojadas por next/font: se
 * descargan en el build y se sirven desde el mismo dominio, así que no
 * hay petición a Google desde el navegador de nadie (ni el dato de
 * quién usa la app saliendo hacia allá) ni salto de fuente al cargar.
 *
 * Archivo es la interfaz entera. Saira Condensed es solo la voz de
 * marca -- lemas y rótulos, con la clase .marca -- y por eso carga un
 * único grosor: cargar más sería peso muerto.
 */
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--fuente-archivo",
  display: "swap",
});

const saira = Saira_Condensed({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--fuente-saira",
  display: "swap",
});

/**
 * El manifest es lo que hace que Chrome/Android ofrezca "Agregar a
 * pantalla de inicio" y abra la app en pantalla completa, sin la barra
 * del navegador. Lo sirve /api/app/manifest con la empresa en la URL
 * (sesión, o la cookie del código que dejó /login) para que la app
 * quede instalada con el logo de esa empresa -- ver lib/icono-app.ts.
 */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  const codigo = (await cookies()).get(COOKIE_CODIGO_EMPRESA)?.value ?? null;
  const p = parametrosEmpresa({ empresaId: perfil?.empresaId, codigo });

  return {
    title: "Taller 360",
    description: "POS y servicio técnico trazable por QR",
    manifest: p ? `/api/app/manifest?${p}` : "/api/app/manifest",
    icons: p ? { apple: `/api/app/icono?${p}&tam=180` } : undefined,
    appleWebApp: { capable: true, statusBarStyle: "default", title: "Taller 360" },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // El negro de la plataforma, no el color de una empresa: esto pinta
  // la barra del sistema en Android y se resuelve antes de saber de
  // qué empresa es quien abre.
  themeColor: "#0b0b0c",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // El layout raíz cubre /login y /seguimiento/[token] también -- ahí
  // no hay perfil (nadie ha iniciado sesión, o es un cliente sin
  // cuenta) y se queda en los valores por defecto. El color y el tema
  // de una empresa solo importan una vez que se sabe de cuál empresa
  // se trata.
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  const config = perfil ? await obtenerConfiguracion(supabase, perfil.empresaId) : CONFIG_POR_DEFECTO;

  return (
    <html
      lang="es"
      data-tema={config.tema}
      className={`${archivo.variable} ${saira.variable}`}
      style={{ "--accent": config.colorPrincipal } as React.CSSProperties}
    >
      <body>
        <RegistroServiceWorker />
        {children}
      </body>
    </html>
  );
}
