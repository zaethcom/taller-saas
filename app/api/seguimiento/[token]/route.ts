/**
 * GET /api/seguimiento/<token>
 *
 * Lo que el cliente ve desde el enlace, sin cuenta y sin login. El token
 * es el único secreto: 32 caracteres hexadecimales aleatorios por orden
 * (orden.token_publico), así que esta ruta usa el cliente con service
 * role a propósito -- no hay sesión de usuario que darle a RLS.
 *
 * Devuelve una lista blanca de campos, nunca la fila completa: así un
 * campo nuevo que alguien agregue a `orden` en el futuro no se filtra
 * aquí por accidente.
 */
import { NextRequest, NextResponse } from "next/server";
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { etiquetaEvento } from "@/lib/fases";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = clienteAdmin();

  const { data: orden, error } = await admin
    .from("orden")
    .select(
      `
      id, empresa_id, numero, estado, motivo, abierta_en, cerrada_en,
      fase:fase_id ( nombre ),
      producto:producto_id ( serial, tipo, marca, modelo ),
      cliente:producto_id ( cliente:cliente_id ( nombre ) )
    `,
    )
    .eq("token_publico", token)
    .maybeSingle();

  if (error || !orden) {
    // Nunca decir "token inválido" vs. "orden no existe" por separado:
    // ambos casos deben verse iguales desde afuera.
    return NextResponse.json({ error: "enlace no válido o vencido" }, { status: 404 });
  }

  const [
    { data: eventos },
    { data: cotizacion },
    { data: evidencias },
    { data: itemsPendientes },
    { data: diagnostico },
    { data: empresa },
    { data: mensajes },
  ] = await Promise.all([
    admin
      .from("orden_evento")
      .select("de_estado, a_estado, a_fase, ocurrio_en")
      .eq("orden_id", orden.id)
      .order("ocurrio_en", { ascending: true }),
    admin
      .from("cotizacion")
      .select("id, total, mano_obra, estado, decision, cotizacion_item(descripcion, cantidad, precio_unit)")
      .eq("orden_id", orden.id)
      .order("enviada_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("evidencia")
      .select("ruta, tipo, tomada_en")
      .eq("orden_id", orden.id)
      .eq("visible_cliente", true),
    // Ítems agregados DESPUÉS de aprobada la cotización original --
    // Fase F2 del Plan 3 -- que el cliente también tiene que decidir.
    admin
      .from("orden_item")
      .select("id, descripcion, cantidad, precio_unit, decision")
      .eq("orden_id", orden.id)
      .eq("requiere_aprobacion", true)
      .order("creado_en", { ascending: true }),
    // El diagnóstico ya existe como paso propio (Fase 2 del Plan 1)
    // pero nunca se mostraba en el seguimiento del cliente -- Fase F1
    // del Plan 3.
    admin
      .from("diagnostico")
      .select("hallazgos, fallas, observaciones, recomendaciones")
      .eq("orden_id", orden.id)
      .maybeSingle(),
    admin.from("empresa").select("nombre").eq("id", orden.empresa_id).maybeSingle(),
    // El hilo de mensajes cliente <-> taller -- Fase F3 del Plan 3.
    admin
      .from("orden_mensaje")
      .select("autor_tipo, texto, creado_en")
      .eq("orden_id", orden.id)
      .order("creado_en", { ascending: true }),
  ]);

  const { data: config } = await admin
    .from("empresa_config")
    .select("logo_url, color_principal")
    .eq("empresa_id", orden.empresa_id)
    .maybeSingle();

  // Se firman aquí, con service role, porque el visitante público no
  // tiene sesión -- la única autorización que tiene es haber llegado
  // con el token correcto, y eso ya se validó arriba.
  const evidenciasFirmadas = await Promise.all(
    (evidencias ?? []).map(async (ev) => {
      const { data: firmada } = await admin.storage
        .from("evidencia")
        .createSignedUrl(ev.ruta, 5 * 60);
      return { tipo: ev.tipo, tomadaEn: ev.tomada_en, url: firmada?.signedUrl ?? null };
    }),
  );

  return NextResponse.json({
    numero: orden.numero,
    estado: orden.estado,
    etiquetaEstado: ETIQUETA_ESTADO[orden.estado as Estado],
    // La fase dentro del estado (0050_fase_orden.sql), solo el nombre.
    // El join de Supabase infiere `fase` como arreglo aunque sea 1:1.
    fase: (orden.fase as unknown as { nombre: string } | null)?.nombre ?? null,
    motivo: orden.motivo,
    abiertaEn: orden.abierta_en,
    cerradaEn: orden.cerrada_en,
    producto: orden.producto,
    empresaNombre: empresa?.nombre ?? "",
    logoUrl: config?.logo_url ?? null,
    colorPrincipal: config?.color_principal ?? null,
    diagnostico,
    historial: (eventos ?? []).map((e) => ({
      estado: e.a_estado,
      etiqueta: etiquetaEvento(e),
      fecha: e.ocurrio_en,
    })),
    cotizacion,
    evidencias: evidenciasFirmadas,
    itemsPendientes: (itemsPendientes ?? []).map((it) => ({
      id: it.id,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnit: Number(it.precio_unit),
      decision: it.decision,
    })),
    mensajes: (mensajes ?? []).map((m) => ({
      autorTipo: m.autor_tipo,
      texto: m.texto,
      creadoEn: m.creado_en,
    })),
  });
}
