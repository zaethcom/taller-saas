/**
 * Refresca la sesión de Supabase en cada request. Sin esto, un usuario
 * cuya sesión expira a mitad de uso se queda con cookies vencidas que
 * ninguna página refresca por su cuenta -- las rutas de servidor
 * (clienteServidor()) leen esas cookies pero no pueden reescribirlas
 * fuera de una respuesta de middleware o de Route Handler.
 *
 * Patrón estándar de @supabase/ssr para Next.js App Router.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

interface CookieParaEscribir {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaEscribir: CookieParaEscribir[]) {
          cookiesParaEscribir.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesParaEscribir.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Solo refresca -- las decisiones de "puede entrar aquí" viven en el
  // layout de cada puerta (lib/permisos.ts), no en el middleware, para
  // que el mensaje de error sea específico ("este rol no entra al POS")
  // y no un redirect genérico sin explicación.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Corre en todo excepto archivos estáticos y de imagen -- ahí no
     * hay sesión que refrescar y solo se sumaría latencia.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
