/**
 * La etiqueta de estado: stock, resultado, estado de una orden.
 *
 * El tono NUNCA es el color de la empresa -- ese color significa
 * "acción" en toda la plataforma, y un estado no es una acción. Un
 * verde sigue siendo verde aunque la empresa sea verde.
 */
export type TonoEtiqueta = "ok" | "info" | "aviso" | "peligro" | "espera" | "neutro" | "marca" | "fuerte";

export function Etiqueta({
  tono = "neutro",
  punto,
  icono,
  children,
}: {
  tono?: TonoEtiqueta;
  /** El círculo de color a la izquierda -- para listas donde se comparan estados. */
  punto?: boolean;
  icono?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className={`etq etq-${tono}`}>
      {punto && <span className="etq-punto" />}
      {icono}
      {children}
    </span>
  );
}
