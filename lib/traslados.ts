/**
 * Crear un traslado: descontar en origen, dejar la fila, e imprimir el
 * comprobante que viaja con la mercancía.
 *
 * Vive aquí y no dentro de la ruta porque ahora hay dos formas de originar
 * un traslado -- armarlo a mano en /traslados, o despacharlo desde una
 * solicitud del taller -- y las dos mueven inventario. Dos copias de un
 * `consumir_repuesto` es la clase de duplicación que acaba en existencias
 * que no cuadran cuando alguien arregla una y olvida la otra.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { encolarImpresion } from "./impresion";

export interface ItemTraslado {
  repuestoId?: string;
  articuloId?: string;
  descripcion: string;
  cantidad: number;
}

export type ResultadoTraslado =
  | { ok: true; id: string; numero: number }
  | { ok: false; estado: number; error: string };

export async function crearTraslado(
  supabase: SupabaseClient,
  params: {
    empresaId: string;
    sedeOrigenId: string;
    sedeDestinoId: string;
    items: ItemTraslado[];
    nota?: string | null;
    enviadoPor: string;
  },
): Promise<ResultadoTraslado> {
  const { empresaId, sedeOrigenId, sedeDestinoId, items, enviadoPor } = params;
  const nota = params.nota?.trim() || null;

  if (!items.length) {
    return { ok: false, estado: 400, error: "el traslado no tiene items" };
  }
  if (sedeOrigenId === sedeDestinoId) {
    return { ok: false, estado: 400, error: "la sede destino no puede ser la misma sede" };
  }
  if (items.some((i) => i.articuloId && i.cantidad !== 1)) {
    return { ok: false, estado: 400, error: "un artículo individualizado se traslada de a una unidad" };
  }

  // Descontar en origen ANTES de crear la fila: si algún repuesto no
  // alcanza, o algún artículo ya no está disponible, el traslado no debe
  // quedar registrado a medias.
  for (const item of items) {
    if (item.repuestoId) {
      const { error } = await supabase.rpc("consumir_repuesto", {
        p_repuesto_id: item.repuestoId,
        p_sede_id: sedeOrigenId,
        p_cantidad: item.cantidad,
      });
      if (error) {
        return {
          ok: false,
          estado: 409,
          error: `no se pudo descontar "${item.descripcion}": ${error.message}`,
        };
      }
    } else if (item.articuloId) {
      const { data: articulo } = await supabase
        .from("articulo")
        .update({ estado: "trasladado" })
        .eq("id", item.articuloId)
        .eq("estado", "en_stock")
        .eq("sede_id", sedeOrigenId)
        .select("id")
        .maybeSingle();
      if (!articulo) {
        return { ok: false, estado: 409, error: `"${item.descripcion}" ya no está disponible en esta sede` };
      }
    }
  }

  const { data: traslado, error: errTraslado } = await supabase
    .from("traslado")
    .insert({
      empresa_id: empresaId,
      sede_origen_id: sedeOrigenId,
      sede_destino_id: sedeDestinoId,
      nota,
      enviado_por: enviadoPor,
    })
    .select("id, numero")
    .single();

  if (errTraslado || !traslado) {
    return { ok: false, estado: 500, error: errTraslado?.message ?? "no se pudo crear el traslado" };
  }

  await supabase.from("traslado_item").insert(
    items.map((i) => ({
      traslado_id: traslado.id,
      repuesto_id: i.repuestoId ?? null,
      articulo_id: i.articuloId ?? null,
      descripcion: i.descripcion,
      cantidad: i.cantidad,
    })),
  );

  const [{ data: sedeOrigen }, { data: sedeDestino }] = await Promise.all([
    supabase.from("sede").select("nombre").eq("id", sedeOrigenId).single(),
    supabase.from("sede").select("nombre").eq("id", sedeDestinoId).single(),
  ]);

  await encolarImpresion(supabase, {
    empresaId,
    sedeId: sedeOrigenId,
    tipo: "comprobante_traslado",
    creadoPor: enviadoPor,
    carga: {
      numeroTraslado: traslado.numero,
      sedeOrigenNombre: sedeOrigen?.nombre ?? "",
      sedeDestinoNombre: sedeDestino?.nombre ?? "",
      items: items.map((i) => ({ descripcion: i.descripcion, cantidad: i.cantidad })),
      nota,
      fecha: new Date().toLocaleDateString("es-CO"),
    },
  });

  return { ok: true, id: traslado.id, numero: traslado.numero };
}
