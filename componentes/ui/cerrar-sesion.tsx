"use client";

import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";

export function CerrarSesion() {
  const router = useRouter();

  async function salir() {
    await clienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={salir} style={{ background: "none", border: "none", cursor: "pointer" }}>
      Cerrar sesión
    </button>
  );
}
