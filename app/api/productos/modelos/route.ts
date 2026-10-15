/**
 * GET /api/productos/modelos -- las marcas y modelos de equipo de la
 * empresa, para los desplegables de /recibir. Ver lib/modelos-equipo.ts.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { agruparModelos } from "@/lib/modelos-equipo";

type Par = { marca: string | null; modelo: string | null };

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  // Supabase devuelve máximo 1000 filas por consulta: leer por páginas.
  async function pares(tabla: "repuesto" | "producto") {
    const out: Par[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await supabase
        .from(tabla)
        .select("marca, modelo")
        .eq("empresa_id", perfil!.empresaId)
        .not("marca", "is", null)
        .not("modelo", "is", null)
        .range(desde, desde + 999);
      if (error) throw new Error(error.message);
      out.push(...((data ?? []) as Par[]));
      if (!data || data.length < 1000) return out;
    }
  }

  try {
    const [repuestos, productos] = await Promise.all([pares("repuesto"), pares("producto")]);
    return NextResponse.json({ marcas: agruparModelos([...repuestos, ...productos]) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
