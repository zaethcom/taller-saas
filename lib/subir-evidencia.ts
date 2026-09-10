/**
 * Sube un archivo al bucket privado 'evidencia' con la convención de
 * ruta que exigen las políticas de 0007_storage.sql
 * (evidencia/<empresa_id>/<orden_id>/<archivo>), y registra la fila
 * en la tabla `evidencia` vía POST /api/evidencia.
 *
 * Solo para el navegador: usa clienteNavegador(), que respeta RLS con
 * la sesión del usuario -- si la ruta no empieza con su empresa_id,
 * Storage rechaza la subida antes de que este código pueda hacer nada.
 */
import { clienteNavegador } from "./supabase/cliente";

export async function subirEvidencia(params: {
  empresaId: string;
  ordenId: string;
  archivo: Blob;
  extension: string;
  tipo: "foto" | "video" | "firma";
  fase?: "entrada" | "salida";
  visibleCliente?: boolean;
}): Promise<void> {
  const supabase = clienteNavegador();
  const ruta = `${params.empresaId}/${params.ordenId}/${params.tipo}-${Date.now()}.${params.extension}`;

  const { error: errSubida } = await supabase.storage.from("evidencia").upload(ruta, params.archivo);
  if (errSubida) {
    throw new Error(`No se pudo subir el archivo: ${errSubida.message}`);
  }

  const res = await fetch("/api/evidencia", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ordenId: params.ordenId,
      ruta,
      tipo: params.tipo,
      fase: params.fase,
      visibleCliente: params.visibleCliente,
    }),
  });

  if (!res.ok) {
    throw new Error((await res.json()).error ?? "no se pudo registrar la evidencia");
  }
}
