/**
 * Enlaces cruzados entre las tres puertas, para el rol que tenga acceso
 * a más de una (típicamente admin). Sin esto, un admin que entra a
 * /ordenes no tiene ninguna forma de llegar al POS o a la app del
 * técnico salvo escribiendo la URL a mano -- justo lo que pasó al
 * probar el sistema por primera vez.
 *
 * Bajo 900px se queda solo el ícono: en la barra superior de un
 * celular, dos botones con texto no caben junto al buscador.
 */
import { ShoppingCart, ScanLine, ClipboardList } from "lucide-react";
import { BotonEnlace } from "@/componentes/ui/boton";
import { puedeEntrarA, type Rol } from "@/lib/permisos";

const PUERTAS = [
  { key: "pos" as const, href: "/vender", etiqueta: "POS", icono: <ShoppingCart size={17} strokeWidth={2} /> },
  { key: "taller" as const, href: "/escanear", etiqueta: "Taller", icono: <ScanLine size={17} strokeWidth={2} /> },
  { key: "admin" as const, href: "/ordenes", etiqueta: "Admin", icono: <ClipboardList size={17} strokeWidth={2} /> },
];

export function SelectorPuertas({ rol, actual }: { rol: Rol; actual: "pos" | "taller" | "admin" }) {
  const otras = PUERTAS.filter((p) => p.key !== actual && puedeEntrarA(rol, p.key));
  if (otras.length === 0) return null;

  return (
    <>
      <style>{`@media (max-width:900px){.sp-texto{display:none;}}`}</style>
      {otras.map((p) => (
        <BotonEnlace
          key={p.key}
          href={p.href}
          variante="oscuro"
          icono={p.icono}
          title={`Ir a ${p.etiqueta}`}
        >
          <span className="sp-texto">{p.etiqueta}</span>
        </BotonEnlace>
      ))}
    </>
  );
}
