/**
 * PATCH /api/usuarios/<id>
 * Body: { codigo: string }
 *
 * El código corto de un cajero o técnico ("C001", "T002") -- lo que se
 * muestra en recibos y reportes en vez de un nombre completo o un uuid.
 * No es una contraseña ni un mecanismo de sesión: la única manera de
 * autenticarse sigue siendo Supabase Auth.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { codigo?: string };

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_usuarios")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const codigo = body.codigo?.trim() || null;

  const { error } = await supabase.from("perfil").update({ codigo }).eq("id", id);

  if (error) {
    const mensaje = error.code === "23505" ? "ese código ya está en uso" : error.message;
    return NextResponse.json({ error: mensaje }, { status: error.code === "23505" ? 409 : 500 });
  }

  return NextResponse.json({ ok: true, codigo });
}
