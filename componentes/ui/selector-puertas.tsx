/**
 * Enlaces cruzados entre las tres puertas, para el rol que tenga acceso
 * a más de una (típicamente admin). Sin esto, un admin que entra a
 * /ordenes no tiene ninguna forma de llegar al POS o a la app del
 * técnico salvo escribiendo la URL a mano -- justo lo que pasó al
 * probar el sistema por primera vez.
 */
import { puedeEntrarA, type Rol } from "@/lib/permisos";

const PUERTAS = [
  { key: "pos" as const, href: "/vender", etiqueta: "Ir a POS" },
  { key: "taller" as const, href: "/escanear", etiqueta: "Ir a Taller" },
  { key: "admin" as const, href: "/ordenes", etiqueta: "Ir a Admin" },
];

export function SelectorPuertas({ rol, actual }: { rol: Rol; actual: "pos" | "taller" | "admin" }) {
  const otras = PUERTAS.filter((p) => p.key !== actual && puedeEntrarA(rol, p.key));
  if (otras.length === 0) return null;

  return (
    <>
      {otras.map((p) => (
        <a key={p.key} href={p.href} style={{ opacity: 0.7, fontSize: 13 }}>
          {p.etiqueta}
        </a>
      ))}
    </>
  );
}
