/**
 * El programa que corre en el Android (o PC) de cada sede. Consulta la
 * cola de trabajos pendientes cada dos segundos, los traduce a bytes o
 * ZPL según el tipo, los manda a la impresora correspondiente por red,
 * y reporta el resultado.
 *
 * No consulta la base de datos directamente ni calcula nada de negocio:
 * solo habla con las dos rutas de la API descritas en el plano de
 * construcción (contrato de la estación de impresión, sección 2).
 *
 * Arranque:  npx tsx estacion/index.ts
 * Producción: empaquetar como servicio (systemd, o Termux:Boot en
 * Android) que arranque solo y reinicie si el proceso muere.
 */
import { readFileSync } from "node:fs";
import { crearDestinos, type ConfigImpresoras } from "./destino";
import { componer, inicializar, abrirCajon as abrirCajonBytes } from "./escpos";
import { etiquetaQrZpl, type DatosEtiquetaQr } from "./etiqueta";
import { reciboVenta, type CargaReciboVenta } from "./plantillas/recibo";
import { comprobanteRecepcion, type CargaComprobanteRecepcion } from "./plantillas/comprobante";
import { cierreCaja, type CargaCierreCaja } from "./plantillas/cierre";
import { comprobanteTraslado, type CargaComprobanteTraslado } from "./plantillas/traslado";

interface Config {
  sedeId: string;
  apiBase: string;
  servicioClave: string;
  intervaloMs: number;
  impresoras: ConfigImpresoras;
}

interface TrabajoPendiente {
  id: string;
  tipo:
    | "etiqueta_qr"
    | "recibo_venta"
    | "comprobante_recepcion"
    | "cierre_caja"
    | "abrir_cajon"
    | "comprobante_traslado";
  carga: unknown;
}

function cargarConfig(ruta: string): Config {
  return JSON.parse(readFileSync(ruta, "utf-8"));
}

async function obtenerPendientes(config: Config): Promise<TrabajoPendiente[]> {
  const res = await fetch(
    `${config.apiBase}/api/impresion/pendientes?sede=${config.sedeId}`,
    { headers: { Authorization: `Bearer ${config.servicioClave}` } },
  );
  if (!res.ok) {
    throw new Error(`GET /pendientes respondió ${res.status}`);
  }
  return res.json();
}

async function reportarResultado(
  config: Config,
  id: string,
  resultado: { ok: true } | { ok: false; error: string },
): Promise<void> {
  await fetch(`${config.apiBase}/api/impresion/${id}/resultado`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.servicioClave}`,
    },
    body: JSON.stringify(resultado),
  });
}

/** Traduce un trabajo pendiente a lo que hay que enviarle a cuál impresora. */
function resolverImpresion(
  trabajo: TrabajoPendiente,
): { destino: "tickets" | "etiquetas"; contenido: Buffer | string } {
  switch (trabajo.tipo) {
    case "recibo_venta":
      return { destino: "tickets", contenido: reciboVenta(trabajo.carga as CargaReciboVenta) };

    case "comprobante_recepcion":
      return {
        destino: "tickets",
        contenido: comprobanteRecepcion(trabajo.carga as CargaComprobanteRecepcion),
      };

    case "cierre_caja":
      return { destino: "tickets", contenido: cierreCaja(trabajo.carga as CargaCierreCaja) };

    case "comprobante_traslado":
      return {
        destino: "tickets",
        contenido: comprobanteTraslado(trabajo.carga as CargaComprobanteTraslado),
      };

    case "abrir_cajon":
      return { destino: "tickets", contenido: componer(inicializar(), abrirCajonBytes()) };

    case "etiqueta_qr":
      return { destino: "etiquetas", contenido: etiquetaQrZpl(trabajo.carga as DatosEtiquetaQr) };
  }
}

async function procesarUnTrabajo(
  config: Config,
  destinos: ReturnType<typeof crearDestinos>,
  trabajo: TrabajoPendiente,
): Promise<void> {
  try {
    const { destino, contenido } = resolverImpresion(trabajo);
    await destinos[destino].enviar(contenido);
    await reportarResultado(config, trabajo.id, { ok: true });
    console.log(`[estacion] impreso ${trabajo.tipo} (${trabajo.id})`);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`[estacion] error imprimiendo ${trabajo.tipo} (${trabajo.id}): ${mensaje}`);
    await reportarResultado(config, trabajo.id, { ok: false, error: mensaje }).catch(() => {
      // Si ni siquiera se puede reportar el error, el trabajo sigue
      // "pendiente" y se reintenta solo en el próximo ciclo.
    });
  }
}

async function cicloPrincipal(config: Config): Promise<void> {
  const destinos = crearDestinos(config.impresoras);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const pendientes = await obtenerPendientes(config);
      for (const trabajo of pendientes) {
        await procesarUnTrabajo(config, destinos, trabajo);
      }
    } catch (err) {
      const mensaje = err instanceof Error ? err.message : String(err);
      console.error(`[estacion] no se pudo consultar la cola: ${mensaje}`);
    }
    await new Promise((r) => setTimeout(r, config.intervaloMs));
  }
}

const rutaConfig = process.argv[2] ?? "./config.json";
cicloPrincipal(cargarConfig(rutaConfig)).catch((err) => {
  console.error("[estacion] error fatal:", err);
  process.exit(1);
});
