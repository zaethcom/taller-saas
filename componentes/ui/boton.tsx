/**
 * El botón de la plataforma. Cinco variantes, cuatro tamaños, y una
 * sola regla: el color de la empresa (`primario`) es la acción que
 * cobra, guarda o confirma -- una por pantalla. Todo lo demás es
 * `contorno` o `fantasma`.
 *
 * Sin "use client" a propósito: así puede usarse tanto desde una
 * pantalla de cliente (donde recibe onClick) como desde un layout de
 * servidor (donde solo es un enlace). Igual que BarraLateral, `icono`
 * es un elemento YA RENDERIZADO (<Save size={18} />), nunca el
 * componente de lucide-react -- pasar la función cruzaría la frontera
 * servidor/cliente y revienta en producción.
 */
import Link from "next/link";

export type VarianteBoton = "primario" | "secundario" | "contorno" | "fantasma" | "peligro" | "oscuro";
export type TamanoBoton = "sm" | "md" | "lg" | "xl";

interface Comun {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  icono?: React.ReactNode;
  /** Ocupa todo el ancho disponible -- el botón de cobro, por ejemplo. */
  ancho?: boolean;
  /** La tecla que dispara la acción, dibujada dentro del botón. */
  atajo?: string;
  children?: React.ReactNode;
  className?: string;
}

function clases({ variante = "contorno", tamano = "md", ancho, children, className }: Comun) {
  return [
    "btn",
    `btn-${variante}`,
    tamano !== "md" ? `btn-${tamano}` : "",
    ancho ? "btn-ancho" : "",
    children == null || children === "" ? "btn-icono" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function Boton({
  variante,
  tamano,
  icono,
  ancho,
  atajo,
  children,
  className,
  ...props
}: Comun & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return (
    <button
      type="button"
      {...props}
      className={clases({ variante, tamano, ancho, children, className })}
    >
      {icono}
      {children}
      {atajo && <span className="btn-atajo">{atajo}</span>}
    </button>
  );
}

/** Mismo botón, pero navega. Separado porque <a> y <button> no aceptan las mismas props. */
export function BotonEnlace({
  href,
  variante,
  tamano,
  icono,
  ancho,
  atajo,
  children,
  className,
  ...props
}: Comun & { href: string } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className">) {
  return (
    <Link href={href} {...props} className={clases({ variante, tamano, ancho, children, className })}>
      {icono}
      {children}
      {atajo && <span className="btn-atajo">{atajo}</span>}
    </Link>
  );
}
