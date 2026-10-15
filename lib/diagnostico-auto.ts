/**
 * El técnico no "pasa la orden a diagnóstico" como un paso aparte:
 * revisar el equipo (guardar el diagnóstico) o enviar la cotización ya
 * es diagnosticar. Si la orden todavía está en Recibida (o rechazada y
 * se va a recotizar), entra sola a en_diagnostico con quien la revisa
 * como técnico, por la misma transicionar() de lib/estados.ts, y queda
 * en el historial.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { buscarPrimeraFase } from "@/lib/fases";
import { RequisitoFaltanteError, TransicionInvalidaError, transicionar, type Estado, type Requisito } from "@/lib/estados";

const ENTRAN_SOLAS: Estado[] = ["recibida", "rechazada"];

/**
 * Deja la orden en en_diagnostico si hace falta. Devuelve el estado en
 * que quedó, o un mensaje para el técnico si no se pudo.
 */
export async function asegurarDiagnostico(
  supabase: SupabaseClient,
  ordenId: string,
  userId: string,
): Promise<{ estado: Estado } | { error: string }> {
  const { data: orden } = await supabase
    .from("orden")
    .select("estado, empresa_id, tecnico_id, fase:fase_id ( nombre )")
    .eq("id", ordenId)
    .maybeSingle();
  if (!orden) return { error: "orden no encontrada" };

  const estado = orden.estado as Estado;
  if (!ENTRAN_SOLAS.includes(estado)) return { estado };

  const { count: fotos } = await supabase
    .from("evidencia")
    .select("id", { count: "exact", head: true })
    .eq("orden_id", ordenId)
    .eq("tipo", "foto")
    .eq("fase", "entrada");

  const tecnicoId = orden.tecnico_id ?? userId;
  const cumplidos = new Set<Requisito>(["tiene_tecnico"]);
  if ((fotos ?? 0) > 0) cumplidos.add("tiene_foto_entrada");

  try {
    transicionar(estado, "en_diagnostico", cumplidos);
  } catch (e) {
    if (e instanceof RequisitoFaltanteError) {
      return { error: "Falta la foto del equipo al recibirlo: agrégala en la orden antes de diagnosticar." };
    }
    if (e instanceof TransicionInvalidaError) return { error: e.message };
    throw e;
  }

  const faseNueva = await buscarPrimeraFase(supabase, orden.empresa_id, "en_diagnostico");
  // El join de Supabase infiere `fase` como arreglo aunque la relación
  // sea 1:1 -- mismo caso que lib/perfil.ts.
  const faseAnterior = orden.fase as unknown as { nombre: string } | null;

  const { error } = await supabase
    .from("orden")
    .update({ estado: "en_diagnostico", fase_id: faseNueva?.id ?? null, tecnico_id: tecnicoId })
    .eq("id", ordenId);
  if (error) return { error: error.message };

  await supabase.from("orden_evento").insert({
    empresa_id: orden.empresa_id,
    orden_id: ordenId,
    de_estado: estado,
    a_estado: "en_diagnostico",
    de_fase: faseAnterior?.nombre ?? null,
    a_fase: faseNueva?.nombre ?? null,
    autor_id: userId,
  });

  return { estado: "en_diagnostico" };
}
