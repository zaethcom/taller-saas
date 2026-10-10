/**
 * Cómo se nombra cada fase de la evidencia en pantalla. En la base sigue
 * siendo 'entrada'/'salida' (0008_ajustes_requisitos.sql, y es lo que
 * consulta /api/ordenes/[id]/transicion), pero el cliente y quien
 * recibe leen "Recibido" y "Entregado": cómo dejó el equipo y cómo se
 * lo llevó.
 */
export const ETIQUETA_FASE_EVIDENCIA: Record<"entrada" | "salida", string> = {
  entrada: "Recibido",
  salida: "Entregado",
};

export function etiquetaFaseEvidencia(fase: string | null | undefined): string | null {
  if (fase === "entrada" || fase === "salida") return ETIQUETA_FASE_EVIDENCIA[fase];
  return null;
}

/** El mismo límite del bucket (0012_limite_evidencia.sql). */
export const LIMITE_EVIDENCIA_BYTES = 50 * 1024 * 1024;
