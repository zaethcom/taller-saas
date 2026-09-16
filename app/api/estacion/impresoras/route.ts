/**
 * GET /api/estacion/impresoras?sede=<id>
 *
 * Lo que la estación de cada sede pide una vez al arrancar, para saber
 * a qué host/puerto/protocolo mandar tickets y etiquetas -- reemplaza
 * el `impresoras` de config.json como fuente de la verdad, ahora
 * editable desde /sedes en vez de un archivo en el dispositivo. Mismo
 * patrón de autenticación que /api/impresion/pendientes: sin sesión de
 * usuario, con la clave propia de la estación.
 *
 * Si la sede todavía no tiene fila en impresora_sede (nadie configuró
 * nada desde la web todavía), responde 404 -- la estación sabe que debe
 * seguir usando su config.json local en ese caso.
 */
import { NextRequest, NextResponse } from "next/server";
import { verificarEstacion } from "@/lib/estacion-auth";
import { clienteAdmin } from "@/lib/supabase/servidor";

export async function GET(req: NextRequest) {
  const identidad = await verificarEstacion(req.headers.get("authorization"));
  if (!identidad) {
    return NextResponse.json({ error: "credencial de estación inválida" }, { status: 401 });
  }

  const sedeSolicitada = req.nextUrl.searchParams.get("sede");
  if (sedeSolicitada !== identidad.sedeId) {
    return NextResponse.json(
      { error: "esta credencial no corresponde a la sede solicitada" },
      { status: 403 },
    );
  }

  const admin = clienteAdmin();
  const { data, error } = await admin
    .from("impresora_sede")
    .select(
      "tickets_host, tickets_puerto, tickets_protocolo, etiquetas_host, etiquetas_puerto, etiquetas_protocolo",
    )
    .eq("sede_id", identidad.sedeId)
    .maybeSingle();

  if (error || !data || !data.tickets_host || !data.etiquetas_host) {
    return NextResponse.json({ error: "esta sede no tiene impresoras configuradas todavía" }, { status: 404 });
  }

  return NextResponse.json({
    tickets: { host: data.tickets_host, puerto: data.tickets_puerto, protocolo: data.tickets_protocolo },
    etiquetas: { host: data.etiquetas_host, puerto: data.etiquetas_puerto, protocolo: data.etiquetas_protocolo },
  });
}
