/**
 * Cliente de Supabase para código que corre en el servidor: Server
 * Components, Route Handlers y Server Actions.
 *
 * Usa la cookie de sesión del usuario -- por eso las consultas hechas
 * con este cliente respetan las políticas de RLS de 0002_rls.sql como
 * ese usuario, no con privilegios de administrador.
 */
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

interface CookieParaEscribir {
  name: string;
  value: string;
  options?: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
}

export async function clienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesParaEscribir: CookieParaEscribir[]) {
          try {
            cookiesParaEscribir.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Se llama desde un Server Component sin permiso de escritura.
            // El middleware de sesión ya se encarga de refrescar la cookie.
          }
        },
      },
    },
  );
}

/**
 * Cliente con la service role key: se salta RLS por completo.
 *
 * Uso exclusivo de rutas de servidor que necesitan operar fuera del
 * contexto de un usuario -- por ejemplo, el endpoint de seguimiento
 * público, que valida el token a mano en vez de depender de una sesión.
 *
 * Nunca importar esto en un Client Component ni exponer la key al navegador.
 */
export function clienteAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
