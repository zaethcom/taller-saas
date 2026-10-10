/**
 * GET /api/superadmin/empresas/<id>
 * La empresa con sus sedes y su historial de pagos del servicio -- lo
 * que muestra /superadmin/empresas/<id>.
 *
 * PATCH /api/superadmin/empresas/<id>
 * Body: { activa?, nombre?, nit?, servicio_inicio?, servicio_fin? }
 * Suspender o reactivar una empresa, corregir sus datos o ajustar a mano
 * las fechas del servicio. empresa_actual() (0020_superadmin.sql) exige
 * empresa.activa -- en cuanto esto se guarda en false, ningún usuario de
 * esa empresa vuelve a ver nada por RLS, en toda la aplicación, sin que
 * ninguna pantalla tenga que acordarse de revisarlo. Las fechas del
 * servicio, en cambio, solo avisan: no bloquean nada (0052).
 */
import { NextResponse } from "next/server";
import { clienteAdmin, clienteServidor } from "@/lib/supabase/servidor";
import { obtenerSuperadminActual } from "@/lib/superadmin";
import { esFechaIso } from "@/lib/servicio-empresa";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const admin = clienteAdmin();
    const [{ data: empresa, error }, { data: sedes }, { data: pagos }] = await Promise.all([
      admin
        .from("empresa")
        .select("id, nombre, nit, activa, creada_en, servicio_inicio, servicio_fin")
        .eq("id", id)
        .maybeSingle(),
      admin.from("sede").select("id, nombre, tipo").eq("empresa_id", id).order("nombre"),
      admin
        .from("pago_servicio")
        .select("id, fecha_pago, meses, valor, desde, hasta, nota")
        .eq("empresa_id", id)
        .order("fecha_pago", { ascending: false })
        .order("creado_en", { ascending: false }),
    ]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!empresa) {
      return NextResponse.json({ error: "la empresa no existe" }, { status: 404 });
    }

    return NextResponse.json({ ...empresa, sedes: sedes ?? [], pagos: pagos ?? [] });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado cargando la empresa" },
      { status: 500 },
    );
  }
}

interface CuerpoPatch {
  activa?: boolean;
  nombre?: string;
  nit?: string | null;
  servicio_inicio?: string | null;
  servicio_fin?: string | null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = (await req.json()) as CuerpoPatch;

    const supabase = await clienteServidor();
    const superadmin = await obtenerSuperadminActual(supabase);
    if (!superadmin) {
      return NextResponse.json({ error: "no autorizado" }, { status: 403 });
    }

    const cambios: Record<string, unknown> = {};
    if (body.activa !== undefined) {
      if (typeof body.activa !== "boolean") {
        return NextResponse.json({ error: "el estado activa no es válido" }, { status: 400 });
      }
      cambios.activa = body.activa;
    }
    if (body.nombre !== undefined) {
      if (typeof body.nombre !== "string" || !body.nombre.trim()) {
        return NextResponse.json({ error: "falta el nombre de la empresa" }, { status: 400 });
      }
      cambios.nombre = body.nombre.trim();
    }
    if (body.nit !== undefined) {
      cambios.nit = typeof body.nit === "string" && body.nit.trim() ? body.nit.trim() : null;
    }
    for (const campo of ["servicio_inicio", "servicio_fin"] as const) {
      const valor = body[campo];
      if (valor === undefined) continue;
      if (valor !== null && valor !== "" && !esFechaIso(valor)) {
        return NextResponse.json({ error: `la fecha ${campo.replace("servicio_", "de ")} no es válida` }, { status: 400 });
      }
      cambios[campo] = valor || null;
    }
    const inicio = cambios.servicio_inicio as string | null | undefined;
    const fin = cambios.servicio_fin as string | null | undefined;
    if (inicio && fin && fin < inicio) {
      return NextResponse.json({ error: "la fecha de fin no puede ser anterior a la de inicio" }, { status: 400 });
    }
    if (Object.keys(cambios).length === 0) {
      return NextResponse.json({ error: "no hay nada que cambiar" }, { status: 400 });
    }

    const { error } = await clienteAdmin().from("empresa").update(cambios).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "error inesperado actualizando la empresa" },
      { status: 500 },
    );
  }
}
