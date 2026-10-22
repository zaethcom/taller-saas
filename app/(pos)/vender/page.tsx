/**
 * Vender. La pantalla es de cliente (vender.tsx); aquí solo se arma la
 * clave con que se guarda el carrito en curso -- empresa, sede y
 * usuario, ver lib/carrito-guardado.ts.
 */
import { redirect } from "next/navigation";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";
import { claveCarrito } from "@/lib/carrito-guardado";
import PaginaVender from "./vender";

export default async function Page() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) redirect("/login");
  return <PaginaVender claveCarrito={claveCarrito(perfil.empresaId, perfil.sedeId, perfil.id)} />;
}
