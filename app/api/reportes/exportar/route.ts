/**
 * GET /api/reportes/exportar?formato=xlsx|pdf&informe=&desde=&hasta=&sede=&agrupar=
 *
 * Descarga el informe que el admin tiene en pantalla, con los mismos
 * filtros (lib/reportes/parametros.ts) y calculado por la misma función
 * (lib/reportes/generar.ts): lo que se descarga es lo que se ve.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { leerParametros } from "@/lib/reportes/parametros";
import { generarInforme } from "@/lib/reportes/generar";
import { informeAExcel, informeAPdf, type Encabezado } from "@/lib/reportes/exportar";
import { formatear } from "@/lib/reportes/formato";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!puede(perfil.rol, "ver_reportes")) return NextResponse.json({ error: "sin permiso" }, { status: 403 });

  const formato = req.nextUrl.searchParams.get("formato");
  if (formato !== "xlsx" && formato !== "pdf") {
    return NextResponse.json({ error: "formato debe ser xlsx o pdf" }, { status: 400 });
  }

  const { def, filtro, sedeNombre } = leerParametros(req.nextUrl.searchParams, perfil.sedesPermitidas);

  let informe;
  try {
    informe = await generarInforme(supabase, def.id, filtro);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "no se pudo generar el informe" }, { status: 500 });
  }

  const encabezado: Encabezado = {
    empresa: perfil.empresaNombre,
    rango: def.usaFechas ? `${formatear(filtro.desde, "fecha")} al ${formatear(filtro.hasta, "fecha")}` : null,
    sede: def.usaSede ? sedeNombre : null,
    generado: `${formatear(new Date().toISOString(), "fechaHora")} por ${perfil.nombre}`,
  };

  const nombre = `${def.id}_${def.usaFechas ? `${filtro.desde}_a_${filtro.hasta}` : filtro.hasta}`;

  if (formato === "xlsx") {
    const archivo = await informeAExcel(informe, encabezado);
    return new NextResponse(new Uint8Array(archivo), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const archivo = informeAPdf(informe, encabezado);
  return new NextResponse(new Uint8Array(archivo), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombre}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
