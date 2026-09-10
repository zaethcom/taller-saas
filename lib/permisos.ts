/**
 * Qué rol puede hacer qué. Un solo lugar, para que el layout de cada
 * puerta ((pos), (taller), (admin)) y las rutas de API consulten lo mismo
 * en vez de repetir listas de roles sueltas por el código.
 */

export type Rol = "admin" | "recepcion" | "tecnico" | "compras" | "cajero";

export type Accion =
  | "vender" // POS: registrar una venta de mostrador
  | "cobrar_orden" // POS: cobrar anticipo o saldo de una orden
  | "abrir_cajon_manual" // POS: abrir el cajón sin una venta detrás
  | "cerrar_turno" // POS: cuadrar y cerrar la caja
  | "recibir_equipo" // Taller: crear una orden nueva
  | "diagnosticar" // Taller: cotizar y avanzar el diagnóstico
  | "marcar_faltante" // Taller: reportar un repuesto que no hay
  | "ver_ordenes" // Admin: el tablero completo
  | "gestionar_inventario"
  | "gestionar_compras"
  | "gestionar_usuarios";

const PERMISOS: Record<Rol, Accion[]> = {
  admin: [
    "vender",
    "cobrar_orden",
    "abrir_cajon_manual",
    "cerrar_turno",
    "recibir_equipo",
    "diagnosticar",
    "marcar_faltante",
    "ver_ordenes",
    "gestionar_inventario",
    "gestionar_compras",
    "gestionar_usuarios",
  ],
  recepcion: ["recibir_equipo", "cobrar_orden", "abrir_cajon_manual", "ver_ordenes"],
  tecnico: ["diagnosticar", "marcar_faltante"],
  compras: ["gestionar_compras", "ver_ordenes"],
  cajero: ["vender", "cobrar_orden", "abrir_cajon_manual", "cerrar_turno"],
};

export function puede(rol: Rol, accion: Accion): boolean {
  return PERMISOS[rol].includes(accion);
}

/** Para usar en el layout de cada puerta: ¿este rol puede entrar aquí? */
export const ROLES_POR_PUERTA = {
  pos: ["admin", "recepcion", "cajero"] satisfies Rol[],
  taller: ["admin", "tecnico"] satisfies Rol[],
  admin: ["admin", "recepcion", "compras"] satisfies Rol[],
} as const;

export function puedeEntrarA(rol: Rol, puerta: keyof typeof ROLES_POR_PUERTA): boolean {
  return (ROLES_POR_PUERTA[puerta] as readonly Rol[]).includes(rol);
}
