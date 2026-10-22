/**
 * GET /api/ordenes/recientes
 * Las últimas 5 órdenes recibidas en la sede activa, para reimprimir
 * su comprobante o corregirlas desde Recibir equipo sin ir a buscarlas.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import { puede } from "@/lib/permisos";

export async function GET() {
  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase.from("perfil").select("empresa_id, rol").eq("id", user.id).single();
  if (!perfil || !puede(perfil.rol, "recibir_equipo")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  const sedeActivaId = await obtenerSedeActivaId(supabase);
  if (!sedeActivaId) {
    return NextResponse.json({ ordenes: [] });
  }

  const { data, error } = await supabase
    .from("orden")
    .select("id, numero, estado, abierta_en, producto:producto_id ( tipo, marca, modelo, cliente:cliente_id ( nombre ) )")
    .eq("empresa_id", perfil.empresa_id)
    .eq("sede_id", sedeActivaId)
    .order("abierta_en", { ascending: false })
    .limit(5);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ordenes = (data ?? []).map((o) => {
    // El join de Supabase infiere las relaciones 1:1 como arreglos.
    const p = o.producto as unknown as {
      tipo: string;
      marca: string | null;
      modelo: string | null;
      cliente: { nombre: string } | null;
    } | null;
    return {
      id: o.id,
      numero: o.numero,
      estado: o.estado,
      abiertaEn: o.abierta_en,
      cliente: p?.cliente?.nombre ?? "",
      equipo: [p?.marca, p?.modelo].filter(Boolean).join(" ") || p?.tipo || "",
    };
  });
  return NextResponse.json({ ordenes });
}
