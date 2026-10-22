"use client";

/**
 * Las pestañas de una sección del menú que agrupa varias pantallas
 * (Inventario: existencias, mercancía, traslados, importar...). Cada
 * pestaña es una dirección propia, así que los enlaces viejos siguen
 * sirviendo; el layout pasa todas las secciones y aquí se muestra solo
 * la que contiene la página actual, si tiene más de una pestaña.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface PestanaSeccion {
  href: string;
  etiqueta: string;
}

/** La página está dentro de `href` (la misma o una subpágina). */
export function dentroDe(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export function PestanasSeccion({ secciones }: { secciones: PestanaSeccion[][] }) {
  const pathname = usePathname();
  const seccion = secciones.find((s) => s.some((p) => dentroDe(pathname, p.href)));
  if (!seccion || seccion.length < 2) return null;

  return (
    <nav aria-label="Secciones" style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2, marginBottom: 14 }}>
      {seccion.map((p) => {
        const activa = dentroDe(pathname, p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`pastilla${activa ? " pastilla-activa" : ""}`}
            style={{ textDecoration: "none", whiteSpace: "nowrap" }}
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
