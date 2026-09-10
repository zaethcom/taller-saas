import type { Metadata, Viewport } from "next";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
