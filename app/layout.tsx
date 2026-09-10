import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taller SaaS",
  description: "POS y servicio técnico trazable por QR",
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
