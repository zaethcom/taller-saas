/**
 * Abonos ahora vive dentro de Cobrar y entregar (/entregar), que busca la
 * orden, muestra su cuenta y deja elegir entre abonar o entregar. Esta
 * dirección se conserva para los enlaces y favoritos viejos.
 */
import { redirect } from "next/navigation";

export default async function PaginaAbonos({ searchParams }: { searchParams: Promise<{ numero?: string }> }) {
  const { numero } = await searchParams;
  redirect(`/entregar?modo=abonar${numero ? `&numero=${encodeURIComponent(numero)}` : ""}`);
}
