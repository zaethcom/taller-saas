/**
 * GET /api/configuracion -- la personalización de la empresa del
 * usuario actual: logo, color de marca, tema, y los datos de recibo.
 * Si todavía no existe la fila (nadie ha guardado nada), devuelve los
 * valores por defecto en vez de un 404 -- toda la aplicación (el
 * layout raíz incluido) necesita poder pedir esto sin que la empresa
 * tenga que haber "activado" la personalización primero.
 *
 * PATCH /api/configuracion -- guardar cambios (upsert). Solo admin
 * (personalizar_empresa) -- es configuración de la empresa, no una
 * operación de venta o de taller.
 */
import { NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { obtenerConfiguracion } from "@/lib/configuracion";
import { puede } from "@/lib/permisos";

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const [config, { data: empresa }] = await Promise.all([
    obtenerConfiguracion(supabase, perfil.empresaId),
    supabase.from("empresa").select("codigo").eq("id", perfil.empresaId).maybeSingle(),
  ]);

  return NextResponse.json({ ...config, codigo: empresa?.codigo ?? null });
}

const CODIGO_VALIDO = /^[a-z0-9-]{3,30}$/;

interface CuerpoConfig {
  logoUrl?: string | null;
  colorPrincipal?: string;
  tema?: "claro" | "oscuro" | "alto_contraste";
  reciboDireccion?: string | null;
  reciboTelefono?: string | null;
  reciboPie?: string;
  imagenMarcaUrl?: string | null;
  eslogan?: string | null;
  whatsappProveedor?: string | null;
  fondoLoginUrl?: string | null;
  codigo?: string | null;
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as CuerpoConfig;

  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "personalizar_empresa")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }
  if (body.tema && !["claro", "oscuro", "alto_contraste"].includes(body.tema)) {
    return NextResponse.json({ error: "tema inválido" }, { status: 400 });
  }
  if (body.codigo !== undefined && body.codigo !== null && !CODIGO_VALIDO.test(body.codigo)) {
    return NextResponse.json(
      { error: "el código debe tener entre 3 y 30 caracteres: minúsculas, números y guiones" },
      { status: 400 },
    );
  }

  if (body.codigo !== undefined) {
    const { error: errCodigo } = await supabase
      .from("empresa")
      .update({ codigo: body.codigo })
      .eq("id", perfil.empresaId);
    if (errCodigo) {
      const mensaje = errCodigo.code === "23505" ? "ese código ya lo está usando otra empresa" : errCodigo.message;
      return NextResponse.json({ error: mensaje }, { status: errCodigo.code === "23505" ? 409 : 500 });
    }
  }

  const { error } = await supabase.from("empresa_config").upsert(
    {
      empresa_id: perfil.empresaId,
      ...(body.logoUrl !== undefined && { logo_url: body.logoUrl }),
      ...(body.colorPrincipal !== undefined && { color_principal: body.colorPrincipal }),
      ...(body.tema !== undefined && { tema: body.tema }),
      ...(body.reciboDireccion !== undefined && { recibo_direccion: body.reciboDireccion }),
      ...(body.reciboTelefono !== undefined && { recibo_telefono: body.reciboTelefono }),
      ...(body.reciboPie !== undefined && { recibo_pie: body.reciboPie }),
      ...(body.imagenMarcaUrl !== undefined && { imagen_marca_url: body.imagenMarcaUrl }),
      ...(body.eslogan !== undefined && { eslogan: body.eslogan }),
      ...(body.whatsappProveedor !== undefined && { whatsapp_proveedor: body.whatsappProveedor }),
      ...(body.fondoLoginUrl !== undefined && { fondo_login_url: body.fondoLoginUrl }),
      actualizado_en: new Date().toISOString(),
    },
    { onConflict: "empresa_id" },
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
