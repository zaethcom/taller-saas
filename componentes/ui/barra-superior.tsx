/**
 * La barra superior de las tres puertas: buscar una orden, saltar a
 * otra puerta, y quién tiene la sesión.
 *
 * Es la misma barra en las tres -- negra siempre, como el menú
 * lateral, aunque la empresa haya elegido tema claro. Que el marco de
 * la aplicación no cambie de color con el tema es lo que hace que el
 * color de la empresa signifique una sola cosa: la acción.
 */
import { LogOut } from "lucide-react";
import { Buscador } from "@/componentes/ui/buscador";
import { CerrarSesion } from "@/componentes/ui/cerrar-sesion";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import type { Rol } from "@/lib/permisos";

export function BarraSuperior({
  nombre,
  rol,
  puerta,
}: {
  nombre: string;
  rol: Rol;
  puerta: "pos" | "taller" | "admin";
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 72,
        padding: "14px 20px",
        background: "var(--chrome)",
        backgroundImage: "linear-gradient(115deg, var(--chrome) 0%, var(--chrome-2) 62%, var(--chrome) 100%)",
        flexWrap: "wrap",
      }}
    >
      <Buscador />

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <SelectorPuertas rol={rol} actual={puerta} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            height: 42,
            padding: "0 12px 0 8px",
            borderRadius: "var(--r-md)",
            background: "var(--chrome-campo)",
            border: "1px solid var(--chrome-linea)",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: "var(--r-sm)",
              background: "var(--accent)",
              color: "var(--accent-texto)",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {nombre.charAt(0).toUpperCase() || "?"}
          </span>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--chrome-texto)" }}>{nombre}</div>
            <div style={{ fontSize: 10, color: "var(--chrome-apagado)", textTransform: "capitalize" }}>{rol}</div>
          </div>
        </div>
        <CerrarSesion icono={<LogOut size={17} strokeWidth={2} />} />
      </div>
    </header>
  );
}
