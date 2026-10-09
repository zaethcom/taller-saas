/**
 * POST /api/sedes/<id>/impresoras/prueba  { destino: "tickets" | "etiquetas" }
 *   Encola una impresión de prueba en la sede, para saber si la estación
 *   y la impresora responden sin tener que hacer una venta o recibir un
 *   equipo de mentira.
 *
 * GET  /api/sedes/<id>/impresoras/prueba?trabajo=<id>
 *   Cómo va ese trabajo: pendiente, impreso o error (con el mensaje que
 *   reportó la estación). La pantalla lo consulta hasta que cambia.
 *
 * La prueba usa tipos que la estación ya conoce (recibo_venta y
 * etiqueta_qr) en vez de uno nuevo: así sirve también con la estación
 * que ya está instalada en el local, sin actualizarla primero -- que es
 * justo cuando más hace falta probar.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { encolarImpresion } from "@/lib/impresion";

async function autorizar(sedeId: string) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return { error: NextResponse.json({ error: "no autenticado" }, { status: 401 }) };
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return { error: NextResponse.json({ error: "no autorizado" }, { status: 403 }) };
  }
  // RLS decide si la sede es de esta empresa: si no la ve, no es suya.
  const { data: sede } = await supabase.from("sede").select("id, nombre").eq("id", sedeId).maybeSingle();
  if (!sede) {
    return { error: NextResponse.json({ error: "la sede no existe" }, { status: 404 }) };
  }
  return { supabase, perfil, sede };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;
  const { supabase, perfil, sede } = auth;

  const body = (await req.json().catch(() => ({}))) as { destino?: string };
  if (body.destino !== "tickets" && body.destino !== "etiquetas") {
    return NextResponse.json({ error: "destino debe ser tickets o etiquetas" }, { status: 400 });
  }

  const ahora = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "short",
    timeStyle: "short",
  });

  // Lo que ya está esperando en la cola sale antes que la prueba: la
  // estación imprime en orden de llegada. La pantalla lo avisa.
  const { count: antes } = await supabase
    .from("trabajo_impresion")
    .select("id", { count: "exact", head: true })
    .eq("sede_id", id)
    .eq("estado", "pendiente");

  try {
    const trabajo =
      body.destino === "tickets"
        ? await encolarImpresion(supabase, {
            empresaId: perfil.empresaId,
            sedeId: id,
            tipo: "recibo_venta",
            carga: {
              numeroVenta: 0,
              items: [
                { descripcion: `PRUEBA DE IMPRESORA - ${sede.nombre}`, cantidad: 1, precioUnit: 0 },
                { descripcion: ahora, cantidad: 1, precioUnit: 0 },
              ],
              total: 0,
              medioPago: "Prueba (no es una venta)",
              abreCajon: false,
              cajero: perfil.nombre,
            },
            creadoPor: perfil.id,
          })
        : await encolarImpresion(supabase, {
            empresaId: perfil.empresaId,
            sedeId: id,
            tipo: "etiqueta_qr",
            carga: { codigoEntrada: "PRUEBA" },
            creadoPor: perfil.id,
          });

    return NextResponse.json({ id: trabajo.id, antes: antes ?? 0 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo encolar la prueba" },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const trabajoId = req.nextUrl.searchParams.get("trabajo");
  if (!trabajoId) {
    return NextResponse.json({ error: "falta ?trabajo=" }, { status: 400 });
  }

  const { data } = await auth.supabase
    .from("trabajo_impresion")
    .select("estado, error, intentos, impreso_en")
    .eq("id", trabajoId)
    .eq("sede_id", id)
    .maybeSingle();

  if (!data) {
    return NextResponse.json({ error: "trabajo no encontrado" }, { status: 404 });
  }

  return NextResponse.json(data);
}
