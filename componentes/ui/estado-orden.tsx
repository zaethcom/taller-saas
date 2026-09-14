/**
 * La etiqueta de un estado de orden, con su tono fijado en un solo
 * lugar. Antes cada pantalla escribía el nombre del estado como texto
 * plano (o peor, con su propio color inventado); el nombre ya vivía en
 * ETIQUETA_ESTADO de lib/estados.ts y ahora el color vive junto a él.
 *
 * El mapa cubre los siete estados por nombre, sin `default`: si alguien
 * agrega un estado a lib/estados.ts, TypeScript rompe aquí y obliga a
 * decidir de qué color es -- que es exactamente lo que queremos.
 */
import { ETIQUETA_ESTADO, type Estado } from "@/lib/estados";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";

const TONO: Record<Estado, TonoEtiqueta> = {
  recibida: "peligro",
  en_diagnostico: "aviso",
  esperando_aprobacion: "espera",
  en_reparacion: "info",
  esperando_repuesto: "espera",
  rechazada: "neutro",
  entregada: "fuerte",
};

export function EstadoOrden({ estado, punto = true }: { estado: Estado; punto?: boolean }) {
  return (
    <Etiqueta tono={TONO[estado]} punto={punto}>
      {ETIQUETA_ESTADO[estado]}
    </Etiqueta>
  );
}
