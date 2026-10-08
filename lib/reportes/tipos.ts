/**
 * La forma común de todos los informes. Cada informe se calcula una sola
 * vez a esta forma (lib/reportes/informes.ts) y de ahí sale igual a la
 * pantalla, al Excel y al PDF -- así lo que el admin ve y lo que
 * descarga nunca pueden diferir.
 */

export type Formato = "texto" | "moneda" | "numero" | "porcentaje" | "fecha" | "fechaHora" | "horas";

export type Valor = string | number | null;

export interface Columna {
  clave: string;
  titulo: string;
  formato: Formato;
}

export interface Tabla {
  titulo?: string;
  columnas: Columna[];
  filas: Record<string, Valor>[];
  /** Fila de totales al pie; las columnas que no suman quedan vacías. */
  totales?: Record<string, Valor>;
  /**
   * Columna cuyo valor se dibuja como barra en pantalla (ventas por
   * día, por hora...). Solo pantalla: en Excel/PDF basta el número.
   */
  barra?: string;
}

export interface Cifra {
  rotulo: string;
  valor: Valor;
  formato: Formato;
}

export interface Informe {
  titulo: string;
  resumen: Cifra[];
  tablas: Tabla[];
  /** Advertencias sobre los datos (p. ej. repuestos sin costo). */
  notas: string[];
}
