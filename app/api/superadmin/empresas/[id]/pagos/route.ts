/**
 * POST /api/superadmin/empresas/<id>/pagos
 * Body: { meses, valor?, nota?, fechaPago? }
 * Registra un pago de N meses y corre la fecha de fin del servicio: si
 * seguía vigente, los meses se suman al final; si ya había vencido,
 * cuentan desde hoy (lib/servicio-empresa.ts).
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { registrarPago, validarPago, type DatosPago } from "@/lib/pago-servicio";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as Partial<DatosPago>;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }
    const invalido = validarPago(body);
    if (invalido) {
      return NextResponse.json({ error: invalido }, { status: 400 });
    }

    const resultado = await registrarPago(clienteAdmin(), id, body as DatosPago, superadmin.id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado registrando el pago" },
      { status: 500 },
    );
  }
}
