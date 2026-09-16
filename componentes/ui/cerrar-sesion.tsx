"use client";

import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";

/**
 * `oscuro` en true (el valor por defecto) porque donde vive este botón
 * es la barra superior negra; las pantallas claras que lo usan -- el
 * mensaje de "tu rol no tiene acceso" de cada layout -- pasan false.
 */
export function CerrarSesion({ icono, oscuro = true }: { icono?: React.ReactNode; oscuro?: boolean }) {
  const router = useRouter();

  async function salir() {
    await clienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Boton
      onClick={salir}
      variante={oscuro ? "oscuro" : "contorno"}
      icono={icono}
      title="Cerrar sesión"
      aria-label="Cerrar sesión"
    >
      {icono ? undefined : "Cerrar sesión"}
    </Boton>
  );
}
