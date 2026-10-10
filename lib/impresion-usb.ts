/**
 * Imprimir desde Chrome directo a una impresora USB (WebUSB), sin app ni
 * estación en medio. Pensado para un Chromebook (o cualquier equipo con
 * Chrome) con la Sewoo y la Zebra conectadas por cable: la página
 * /estacion pide los trabajos a la web con ?formato=bytes -- los mismos
 * bytes ya traducidos que recibe la app Android del puente -- y aquí solo
 * se mandan tal cual al endpoint de salida de la impresora.
 *
 * La web sigue sin hablar de bytes de impresora: la traducción a
 * ESC/POS, PPLB o ZPL la hace estacion/resolver.ts en el servidor.
 *
 * Los tipos de WebUSB se declaran aquí con lo mínimo que se usa, para no
 * sumar una dependencia solo por tipos.
 */

export interface EndpointUsb {
  endpointNumber: number;
  direction: "in" | "out";
  type: "bulk" | "interrupt" | "isochronous";
  packetSize: number;
}

export interface AlternativaUsb {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: EndpointUsb[];
}

export interface InterfazUsb {
  interfaceNumber: number;
  alternates: AlternativaUsb[];
  claimed: boolean;
}

export interface ConfiguracionUsb {
  configurationValue: number;
  interfaces: InterfazUsb[];
}

export interface DispositivoUsb {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  productName?: string;
  manufacturerName?: string;
  opened: boolean;
  configuration: ConfiguracionUsb | null;
  configurations: ConfiguracionUsb[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(valor: number): Promise<void>;
  claimInterface(numero: number): Promise<void>;
  selectAlternateInterface(numero: number, alternativa: number): Promise<void>;
  transferOut(endpoint: number, datos: Uint8Array): Promise<{ status: string; bytesWritten: number }>;
}

export interface Usb {
  getDevices(): Promise<DispositivoUsb[]>;
  requestDevice(opciones: { filters: object[] }): Promise<DispositivoUsb>;
  addEventListener(tipo: "connect" | "disconnect", fn: (e: { device: DispositivoUsb }) => void): void;
  removeEventListener(tipo: "connect" | "disconnect", fn: (e: { device: DispositivoUsb }) => void): void;
}

/** navigator.usb, o null si el navegador no tiene WebUSB (Firefox, Safari, Android). */
export function usbDelNavegador(): Usb | null {
  if (typeof navigator === "undefined") return null;
  return (navigator as unknown as { usb?: Usb }).usb ?? null;
}

/** Clase USB 7 = impresora. */
const CLASE_IMPRESORA = 7;

export interface SalidaUsb {
  configuracion: number;
  interfaz: number;
  alternativa: number;
  endpoint: number;
}

/**
 * Dónde escribir: la primera interfaz de clase impresora con un endpoint
 * bulk de salida; si la impresora no se anuncia como clase 7 (algunas
 * térmicas chinas usan clase 255, «de fabricante»), cualquier interfaz
 * con un endpoint bulk de salida.
 */
export function elegirSalida(configuraciones: ConfiguracionUsb[]): SalidaUsb | null {
  let respaldo: SalidaUsb | null = null;
  for (const config of configuraciones) {
    for (const interfaz of config.interfaces) {
      for (const alt of interfaz.alternates) {
        const salida = alt.endpoints.find((e) => e.direction === "out" && e.type === "bulk");
        if (!salida) continue;
        const candidata = {
          configuracion: config.configurationValue,
          interfaz: interfaz.interfaceNumber,
          alternativa: alt.alternateSetting,
          endpoint: salida.endpointNumber,
        };
        if (alt.interfaceClass === CLASE_IMPRESORA) return candidata;
        respaldo ??= candidata;
      }
    }
  }
  return respaldo;
}

/**
 * Trozos de 16 KB: una etiqueta con imagen pasa de 100 KB y algunas
 * impresoras (o el controlador USB del Chromebook) no aceptan una sola
 * transferencia de ese tamaño.
 */
export function partir(datos: Uint8Array, tamano = 16 * 1024): Uint8Array[] {
  const trozos: Uint8Array[] = [];
  for (let i = 0; i < datos.length; i += tamano) trozos.push(datos.subarray(i, i + tamano));
  return trozos;
}

/** Abre la impresora (si hace falta), reclama su interfaz y manda los bytes. */
export async function imprimirUsb(dispositivo: DispositivoUsb, datos: Uint8Array): Promise<void> {
  const salida = elegirSalida(dispositivo.configurations);
  if (!salida) throw new Error("esta impresora no tiene una salida USB por donde mandarle datos");

  if (!dispositivo.opened) await dispositivo.open();
  if (dispositivo.configuration?.configurationValue !== salida.configuracion) {
    await dispositivo.selectConfiguration(salida.configuracion);
  }
  const interfaz = dispositivo.configuration?.interfaces.find((i) => i.interfaceNumber === salida.interfaz);
  if (!interfaz?.claimed) {
    await dispositivo.claimInterface(salida.interfaz);
    if (salida.alternativa !== 0) await dispositivo.selectAlternateInterface(salida.interfaz, salida.alternativa);
  }

  for (const trozo of partir(datos)) {
    const r = await dispositivo.transferOut(salida.endpoint, trozo);
    if (r.status !== "ok") throw new Error(`la impresora no recibió los datos (${r.status})`);
  }
}

/** Cómo se reconoce la impresora la próxima vez que se abra la página. */
export interface HuellaUsb {
  vendorId: number;
  productId: number;
  serialNumber?: string;
  nombre: string;
}

export function huella(d: DispositivoUsb): HuellaUsb {
  const nombre = [d.manufacturerName, d.productName].filter(Boolean).join(" ").trim();
  return {
    vendorId: d.vendorId,
    productId: d.productId,
    serialNumber: d.serialNumber || undefined,
    nombre: nombre || `USB ${hex(d.vendorId)}:${hex(d.productId)}`,
  };
}

export function coincide(d: DispositivoUsb, h: HuellaUsb): boolean {
  return (
    d.vendorId === h.vendorId &&
    d.productId === h.productId &&
    (!h.serialNumber || (d.serialNumber || undefined) === h.serialNumber)
  );
}

function hex(n: number): string {
  return n.toString(16).padStart(4, "0");
}

export function base64ABytes(b64: string): Uint8Array {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}
