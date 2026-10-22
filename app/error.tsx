"use client";

/** Error de una pantalla: el layout (menú, barra) sigue en pie. Ver componentes/ui/pantalla-error.tsx. */
import { PantallaError } from "@/componentes/ui/pantalla-error";

export default function ErrorDePantalla({ error }: { error: Error & { digest?: string } }) {
  return <PantallaError error={error} />;
}
