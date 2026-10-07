/**
 * GET /api/contactos-whatsapp -- a quién se le puede mandar la lista de
 * faltantes desde /compras (mensajero, almacén, proveedor...).
 *
 * POST /api/contactos-whatsapp
 * Body: { nombre, telefono }
 * Lo gestiona quien gestiona compras -- es parte del mismo flujo, no
 * configuración general de la empresa.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { normalizarTelefonoWhatsapp } from "@/lib/compras/whatsapp";

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_compras")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const { data, error } = await supabase.from("contacto_whatsapp").select("id, nombre, telefono").order("nombre");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = (await req.json()) as { nombre?: string; telefono?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_compras")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const nombre = body.nombre?.trim();
  const telefono = normalizarTelefonoWhatsapp(body.telefono ?? "");
  if (!nombre) {
    return NextResponse.json({ error: "falta el nombre del contacto" }, { status: 400 });
  }
  if (!telefono) {
    return NextResponse.json({ error: "el número debe tener al menos 7 dígitos" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contacto_whatsapp")
    .insert({ empresa_id: perfil.empresaId, nombre, telefono })
    .select("id, nombre, telefono")
    .single();

  if (error) {
    const mensaje = error.code === "23505" ? "ya existe un contacto con ese nombre" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json(data);
}
