/**
 * La credencial con la que la estación de impresión de una sede se
 * autentica contra /api/impresion/* (ver supabase/migrations/0006_estaciones.sql).
 *
 * Antes de esto no existía ninguna ruta que creara una: había que entrar a
 * la base y hacer el INSERT a mano, con el hash calculado aparte. Eso deja
 * el alta de una sede nueva fuera del alcance de quien administra el
 * negocio, que es justo lo que un SaaS no puede permitirse.
 *
 * GET    -- ¿hay credencial activa? Nunca devuelve la clave: solo existe
 *           en claro en la respuesta del POST que la creó.
 * POST   -- generar una. Si ya había, la revoca: rotar es crear la nueva y
 *           dar de baja la vieja, no pisarla (así queda el rastro).
 * DELETE -- revocar sin crear otra, para una tablet que se perdió.
 */
import { NextResponse } from "next/server";
import { clienteServidor, clienteAdmin } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { generarClaveEstacion, hashClave } from "@/lib/estacion-auth";

/**
 * Quién puede tocar esto, y sobre qué sede.
 *
 * El aislamiento entre empresas es el punto delicado de este archivo.
 * estacion_credencial tiene RLS con CERO policies a propósito (0006), así
 * que hay que escribirla con el cliente de servicio -- que se salta RLS
 * entero. Si la ruta se fiara del `id` de la URL, un admin de la empresa A
 * podría emitirle una credencial a una sede de la empresa B y leer su cola
 * de impresión.
 *
 * Por eso la sede se busca con el cliente del USUARIO, no con el de
 * servicio: si RLS no se la muestra, no es suya, y no hay nada que hacer.
 * La comprobación la hace la base con la política que ya existe, en vez de
 * una comparación de empresa_id escrita a mano aquí.
 */
async function autorizar(sedeId: string) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return { error: NextResponse.json({ error: "no autenticado" }, { status: 401 }) };
  }
  if (!puede(perfil.rol, "gestionar_sedes")) {
    return { error: NextResponse.json({ error: "no autorizado" }, { status: 403 }) };
  }

  const { data: sede } = await supabase.from("sede").select("id, nombre").eq("id", sedeId).maybeSingle();
  if (!sede) {
    return { error: NextResponse.json({ error: "la sede no existe" }, { status: 404 }) };
  }

  return { perfil, sede };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const { data } = await clienteAdmin()
    .from("estacion_credencial")
    .select("id, nombre, creada_en")
    .eq("sede_id", id)
    .is("revocada_en", null)
    .maybeSingle();

  if (!data) return NextResponse.json({ vinculada: false });

  return NextResponse.json({
    vinculada: true,
    nombre: data.nombre,
    creadaEn: data.creada_en,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => ({}))) as { nombre?: string };
  const nombre = body.nombre?.trim() || null;

  const admin = clienteAdmin();

  // Revocar la anterior ANTES de insertar: el índice único parcial de la
  // 0036 no deja dos activas en la misma sede, así que hacerlo al revés
  // fallaría. Y en este orden, si el insert falla, la sede queda sin
  // credencial en vez de con dos -- se nota enseguida y se vuelve a
  // intentar, que es mejor que una ambigüedad silenciosa.
  await admin
    .from("estacion_credencial")
    .update({ revocada_en: new Date().toISOString() })
    .eq("sede_id", id)
    .is("revocada_en", null);

  const clave = generarClaveEstacion();

  const { error } = await admin.from("estacion_credencial").insert({
    empresa_id: auth.perfil.empresaId,
    sede_id: id,
    clave_hash: hashClave(clave),
    nombre,
    creada_por: auth.perfil.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // La única vez que la clave existe en claro fuera del dispositivo. No se
  // guarda: la tabla solo tiene su hash, así que si se pierde hay que
  // generar otra. Eso es deliberado -- una clave recuperable es una clave
  // que alguien acaba leyendo de una pantalla que no debía.
  return NextResponse.json({ clave, sede: auth.sede.nombre });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const auth = await autorizar(id);
  if (auth.error) return auth.error;

  const { error } = await clienteAdmin()
    .from("estacion_credencial")
    .update({ revocada_en: new Date().toISOString() })
    .eq("sede_id", id)
    .is("revocada_en", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
