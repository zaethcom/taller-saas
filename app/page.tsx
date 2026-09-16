import Link from "next/link";
import { ShoppingCart, ScanLine, ClipboardList, ChevronRight } from "lucide-react";

/**
 * La portada: las tres puertas y nada más. Quien llega con sesión
 * abierta normalmente entra directo a la suya desde /login -- esta
 * pantalla es para quien escribe la raíz a mano o cambia de puerta.
 */
const PUERTAS = [
  { href: "/vender", icono: ShoppingCart, titulo: "POS", descripcion: "Caja de las dos sedes" },
  { href: "/escanear", icono: ScanLine, titulo: "Taller", descripcion: "La app del técnico" },
  { href: "/ordenes", icono: ClipboardList, titulo: "Admin", descripcion: "Tablero de órdenes" },
];

export default function Inicio() {
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "72px 20px" }}>
      <div className="marca" style={{ fontSize: 34, lineHeight: 1 }}>
        Taller SaaS
      </div>
      <p style={{ margin: "8px 0 28px", fontSize: 15, color: "var(--ink-2)" }}>
        Tres puertas, un solo sistema.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {PUERTAS.map(({ href, icono: Icono, titulo, descripcion }) => (
          <Link
            key={href}
            href={href}
            className="tarjeta"
            style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, color: "var(--ink)", textDecoration: "none" }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 46,
                height: 46,
                borderRadius: "var(--r-md)",
                background: "var(--accent-suave)",
                color: "var(--accent)",
                flexShrink: 0,
              }}
            >
              <Icono size={22} strokeWidth={2} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 16, fontWeight: 700 }}>{titulo}</span>
              <span style={{ display: "block", fontSize: 13, color: "var(--ink-2)" }}>{descripcion}</span>
            </span>
            <ChevronRight size={19} strokeWidth={2} color="var(--ink-3)" aria-hidden />
          </Link>
        ))}
      </div>
    </main>
  );
}
