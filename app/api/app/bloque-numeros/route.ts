/**
 * POST /api/app/bloque-numeros   Body: { equipo }
 *
 * Los números de orden que este equipo tiene apartados y libres para
 * recibir sin internet (plan sin internet, fase 4; migración 0071). Si
 * le quedan menos de MINIMO_LIBRES, aparta un bloque nuevo de
 * TAMANO_BLOQUE con reservar_bloque_orden(). Lo llama la app cada vez
 * que sincroniza (componentes/sin-conexion/sincronizar-copia.tsx).
 *
 * Sin la migración 0071 responde { libres: [], sinMigracion: true }: la
 * app sigue funcionando, solo que no puede recibir sin conexión.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";

export const dynamic = "force-dynamic";

const TAMANO_BLOQUE = 10;
const MINIMO_LIBRES = 3;
const EQUIPO_VALIDO = /^[A-Za-z0-9_-]{8,64}$/;

/** Tabla o función que no existen todavía (migración sin correr). */
function faltaMigracion(error: { code?: string } | null | undefined): boolean {
  return ["42P01", "PGRST205", "42883", "PGRST202"].includes(error?.code ?? "");
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { equipo?: unknown };
  const equipo = typeof body.equipo === "string" && EQUIPO_VALIDO.test(body.equipo) ? body.equipo : null;
  if (!equipo) return NextResponse.json({ error: "falta el identificador del equipo" }, { status: 400 });

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return NextResponse.json({ error: "no autenticado" }, { status: 401 });

  const { data: bloques, error } = await supabase
    .from("orden_numero_bloque")
    .select("desde, hasta")
    .eq("empresa_id", perfil.empresaId)
    .eq("equipo", equipo)
    .order("creado_en", { ascending: false })
    .limit(3);
  if (faltaMigracion(error)) return NextResponse.json({ libres: [], sinMigracion: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const libres = await libresDe(supabase, perfil.empresaId, bloques ?? []);
  if (libres.length >= MINIMO_LIBRES) return NextResponse.json({ libres });

  const { data: nuevo, error: errNuevo } = await supabase.rpc("reservar_bloque_orden", {
    p_equipo: equipo,
    p_sede: perfil.sedeId,
    p_cantidad: TAMANO_BLOQUE,
  });
  if (faltaMigracion(errNuevo)) return NextResponse.json({ libres, sinMigracion: true });
  if (errNuevo || !nuevo) return NextResponse.json({ error: errNuevo?.message ?? "no se pudo apartar números" }, { status: 500 });

  const bloque = nuevo as { desde: number; hasta: number };
  return NextResponse.json({ libres: [...libres, ...rango(bloque.desde, bloque.hasta)] });
}

function rango(desde: number, hasta: number): number[] {
  return Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i);
}

/** Los números de esos bloques que ninguna orden de la empresa tiene todavía. */
async function libresDe(
  supabase: Awaited<ReturnType<typeof clienteServidor>>,
  empresaId: string,
  bloques: { desde: number; hasta: number }[],
): Promise<number[]> {
  if (bloques.length === 0) return [];
  const desde = Math.min(...bloques.map((b) => b.desde));
  const hasta = Math.max(...bloques.map((b) => b.hasta));
  const { data: usadas } = await supabase
    .from("orden")
    .select("numero")
    .eq("empresa_id", empresaId)
    .gte("numero", desde)
    .lte("numero", hasta);
  const usados = new Set((usadas ?? []).map((o) => o.numero as number));
  const libres = new Set<number>();
  for (const b of bloques) for (const n of rango(b.desde, b.hasta)) if (!usados.has(n)) libres.add(n);
  return [...libres].sort((a, b) => a - b);
}
