/**
 * POST /api/turno/cerrar
 * Body: { efectivoContado: number }
 * Cierra el turno abierto de la sede, calcula la diferencia con
 * lib/caja.ts, y encola el comprobante de cierre -- con la firma del
 * responsable (nombre y rol de quien abrió y quien cerró), tal como sale en la
 * plantilla de estacion/plantillas/cierre.ts.
 */
import { NextRequest, NextResponse } from "next/server";
import { calcularDiferencia, efectivoEsperado, totalesMovimientos } from "@/lib/caja";
import { movimientosDelTurno } from "@/lib/movimiento-caja";
import { encolarImpresion } from "@/lib/impresion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSedeActivaId } from "@/lib/perfil";
import type { Rol } from "@/lib/permisos";

const ETIQUETA_ROL: Record<Rol, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
  tecnico: "Técnico",
  compras: "Compras",
  cajero: "Cajero",
};

/**
 * Hora de Colombia, no la del servidor: en Vercel corre en UTC y el comprobante
 * salía con cinco horas de más (un cierre a las 7:39 p. m. decía 12:39 a. m.).
 */
function fechaHora(d: Date): string {
  return d.toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { efectivoContado?: number };
  if (typeof body.efectivoContado !== "number" || body.efectivoContado < 0) {
    return NextResponse.json({ error: "falta el efectivo contado" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const { data: perfil } = await supabase
    .from("perfil")
    .select("empresa_id, sede_id")
    .eq("id", user.id)
    .single();
  const sedeActivaId = await obtenerSedeActivaId(supabase);

  if (!perfil || !sedeActivaId) {
    return NextResponse.json({ error: "elige la sede en la que estás trabajando" }, { status: 400 });
  }

  const { data: turno } = await supabase
    .from("turno_caja")
    .select("id, base_inicial, abierto_en, abierto_por")
    .eq("sede_id", sedeActivaId)
    .is("cerrado_en", null)
    .order("abierto_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!turno) {
    return NextResponse.json({ error: "no hay un turno abierto en esta sede" }, { status: 409 });
  }

  const { data: pagos } = await supabase
    .from("pago")
    .select("monto, es_efectivo, venta:venta_id!inner ( turno_id, anulada )")
    .eq("venta.turno_id", turno.id)
    .eq("venta.anulada", false);

  const ventasEfectivo = (pagos ?? [])
    .filter((p) => p.es_efectivo)
    .reduce((s, p) => s + Number(p.monto), 0);
  const totalVentas = (pagos ?? []).reduce((s, p) => s + Number(p.monto), 0);
  const { ingresos, salidas } = totalesMovimientos(await movimientosDelTurno(supabase, turno.id));

  const resumen = {
    baseInicial: Number(turno.base_inicial),
    ventasEfectivo,
    ingresosEfectivo: ingresos,
    salidasEfectivo: salidas,
  };
  const diferencia = calcularDiferencia(resumen, body.efectivoContado);

  const { error: errCierre } = await supabase
    .from("turno_caja")
    .update({
      cerrado_por: user.id,
      efectivo_contado: body.efectivoContado,
      diferencia,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", turno.id);

  if (errCierre) {
    return NextResponse.json({ error: errCierre.message }, { status: 500 });
  }

  // Nombre y rol de quien abrió y quien cerró, para que el comprobante diga quién
  // responde por la caja y no solo «Firma responsable».
  const { data: personas } = await supabase
    .from("perfil")
    .select("id, nombre, rol")
    .in("id", [turno.abierto_por, user.id]);
  const persona = (id: string) => {
    const p = (personas ?? []).find((x) => x.id === id);
    return p ? `${p.nombre} (${ETIQUETA_ROL[p.rol as Rol] ?? p.rol})` : undefined;
  };
  const cierreEn = new Date();

  await encolarImpresion(supabase, {
    empresaId: perfil.empresa_id,
    sedeId: sedeActivaId,
    tipo: "cierre_caja",
    creadoPor: user.id,
    carga: {
      aperturaEn: fechaHora(new Date(turno.abierto_en)),
      cierreEn: fechaHora(cierreEn),
      abiertoPor: persona(turno.abierto_por),
      cerradoPor: persona(user.id),
      baseInicial: resumen.baseInicial,
      totalVentas,
      ingresos,
      salidas,
      efectivoEsperado: efectivoEsperado(resumen),
      efectivoContado: body.efectivoContado,
      diferencia,
    },
  });

  return NextResponse.json({ ok: true, diferencia });
}
