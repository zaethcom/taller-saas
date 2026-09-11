/**
 * PATCH /api/repuestos/[id]
 * Body: { imagenUrl: string }
 *
 * Lo único editable de un repuesto desde la aplicación: su foto. El
 * resto del catálogo (código, descripción, precio) sigue siendo cosa de
 * seed.sql a propósito -- ver README, "Qué falta". RLS (repuesto está
 * bajo _aplica_rls_empresa) es lo que impide que alguien le cambie la
 * foto a un repuesto de otra empresa; este código no necesita repetir
 * esa comprobación.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { puede } from "@/lib/permisos";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { imagenUrl } = (await req.json()) as { imagenUrl?: string };

  if (!imagenUrl) {
    return NextResponse.json({ error: "falta imagenUrl" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no tienes permiso para editar el inventario" }, { status: 403 });
  }

  const { error } = await supabase.from("repuesto").update({ imagen_url: imagenUrl }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
