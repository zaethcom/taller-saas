/**
 * Cliente de Supabase para código que corre en el navegador: Client
 * Components. Usa la anon key -- la seguridad real la da RLS en la base,
 * no el hecho de que esta key sea pública.
 */
import { createBrowserClient } from "@supabase/ssr";

export function clienteNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
