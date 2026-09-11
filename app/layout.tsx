import type { Metadata, Viewport } from "next";
import "./globals.css";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion, CONFIG_POR_DEFECTO } from "@/lib/configuracion";

export const metadata: Metadata = {
  title: "Taller SaaS",
  description: "POS y servicio técnico trazable por QR",
  // El manifest es lo que hace que Chrome/Android ofrezca "Agregar a
  // pantalla de inicio" y abra la app en pantalla completa, sin la
  // barra del navegador -- sin esto, técnicamente es una web que se ve
  // bien en el celular, pero no se "instala" como una app de verdad.
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Taller" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b6c78",
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
    <html lang="es" data-tema={config.tema} style={{ "--accent": config.colorPrincipal } as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
