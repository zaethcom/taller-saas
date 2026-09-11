/**
 * GET /api/metodos-pago -- catálogo de métodos activos de la empresa,
 * para los botones de pago en /vender y /entregar. Reemplaza los tres
 * valores fijos que antes vivían en un check constraint: cada empresa
 * puede agregar Nequi, DaviPlata, Bre-B... sin tocar código.
 *
 * POST /api/metodos-pago -- crear un método nuevo (solo gestionar_usuarios,
 * la misma acción que ya gobierna /usuarios -- es configuración de la
 * empresa, no una operación de venta).
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function GET(req: NextRequest) {
  const todos = req.nextUrl.searchParams.get("todos") === "1";

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  // ?todos=1 es para la pantalla de administración (ver también los
  // desactivados, para poder reactivarlos) -- el POS y /entregar solo
  // necesitan los activos, así que ese sigue siendo el default.
  if (todos && !puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  let consulta = supabase.from("metodo_pago").select("id, nombre, es_efectivo, activo, orden").order("orden");
  if (!todos) {
    consulta = consulta.eq("activo", true);
  }

  const { data, error } = await consulta;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { nombre?: string; esEfectivo?: boolean };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (!body.nombre?.trim()) {
    return NextResponse.json({ error: "falta el nombre del método" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("metodo_pago")
    .insert({ empresa_id: perfil.empresaId, nombre: body.nombre.trim(), es_efectivo: body.esEfectivo ?? false, orden: 99 })
    .select("id, nombre, es_efectivo, activo, orden")
    .single();

  if (error) {
    const mensaje = error.code === "23505" ? "ya existe un método con ese nombre" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json(data);
}
