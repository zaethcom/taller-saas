/**
 * GET /api/avisos -- lo que el cliente hizo desde el enlace y nadie ha
 * atendido todavía (0061_avisos_cliente.sql): lo lee el globo de la
 * barra superior (componentes/ui/avisos.tsx) cada pocos segundos.
 *
 * Solo la sede activa en este equipo, igual que el resto de pantallas.
 * `disponible: false` cuando la migración aún no corre: el globo no se
 * muestra en vez de dar error en cada pantalla.
 */
import { NextResponse } from "next/server";
import { veAvisos } from "@/lib/avisos";
import { configuracionPush } from "@/lib/avisos-servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

const LIMITE = 50;

export async function GET() {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!veAvisos(perfil.rol)) {
    return NextResponse.json({ disponible: false, avisos: [] });
  }

  let consulta = supabase
    .from("aviso")
    .select("id, orden_id, tipo, texto, creado_en, orden:orden_id ( numero, producto:producto_id ( cliente:cliente_id ( nombre ) ) )")
    .is("atendido_en", null)
    .order("creado_en", { ascending: false })
    .limit(LIMITE);
  if (perfil.sedeId) consulta = consulta.eq("sede_id", perfil.sedeId);

  const { data, error } = await consulta;
  if (error) {
    // 42P01 = la tabla no existe: falta correr 0061 en el SQL Editor.
    return NextResponse.json({ disponible: false, avisos: [] });
  }

  return NextResponse.json({
    disponible: true,
    clavePush: configuracionPush()?.publica ?? null,
    avisos: (data ?? []).map((a) => {
      const orden = a.orden as unknown as {
        numero: number | null;
        producto: { cliente: { nombre: string } | null } | null;
      } | null;
      return {
        id: a.id,
        ordenId: a.orden_id,
        tipo: a.tipo,
        texto: a.texto,
        creadoEn: a.creado_en,
        numero: orden?.numero ?? null,
        cliente: orden?.producto?.cliente?.nombre ?? null,
      };
    }),
  });
}
