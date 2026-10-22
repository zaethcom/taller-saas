/**
 * La barra superior de las tres puertas: buscar una orden, saltar a
 * otra puerta, los avisos de los clientes (componentes/ui/avisos.tsx),
 * y el menú del usuario (sede, quién es y cerrar sesión).
 *
 * Es la misma barra en las tres -- negra siempre, como el menú
 * lateral, aunque la empresa haya elegido tema claro. Que el marco de
 * la aplicación no cambie de color con el tema es lo que hace que el
 * color de la empresa signifique una sola cosa: la acción.
 */
import { Avisos } from "@/componentes/ui/avisos";
import { Buscador } from "@/componentes/ui/buscador";
import { MenuUsuario } from "@/componentes/ui/menu-usuario";
import { SelectorPuertas } from "@/componentes/ui/selector-puertas";
import { veAvisos } from "@/lib/avisos";
import type { Rol } from "@/lib/permisos";

export function BarraSuperior({
  nombre,
  rol,
  sedeNombre = null,
  puedeCambiarSede = false,
  puerta,
}: {
  nombre: string;
  rol: Rol;
  sedeNombre?: string | null;
  /** Con más de una sede permitida, la sede es un enlace a /elegir-sede. */
  puedeCambiarSede?: boolean;
  puerta: "pos" | "taller" | "admin";
}) {
  return (
    <header
      className="barra-superior"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        padding: "11px 20px",
        background: "var(--chrome)",
        backgroundImage: "linear-gradient(115deg, var(--chrome) 0%, var(--chrome-2) 62%, var(--chrome) 100%)",
        flexWrap: "wrap",
      }}
    >
      <Buscador className="bs-buscador" />

      <div className="bs-acciones" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
        <SelectorPuertas rol={rol} actual={puerta} />
        {veAvisos(rol) && <Avisos rol={rol} />}
        <MenuUsuario nombre={nombre} rol={rol} sedeNombre={sedeNombre} puedeCambiarSede={puedeCambiarSede} />
      </div>
    </header>
  );
}
