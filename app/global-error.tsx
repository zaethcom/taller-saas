"use client";

/** Error en el layout raíz: reemplaza toda la página, por eso trae su propio <html>. */
import { PantallaError } from "@/componentes/ui/pantalla-error";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>
        <PantallaError error={error} />
      </body>
    </html>
  );
}
