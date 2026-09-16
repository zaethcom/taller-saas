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
import { resolverImpresion, type TrabajoPendiente } from "./ruteo";

interface Config {
  sedeId: string;
  apiBase: string;
  servicioClave: string;
  intervaloMs: number;
  // Respaldo local: se usa solo si GET /api/estacion/impresoras no
  // responde (la sede todavía no tiene nada configurado desde la web,
  // o no hay red hacia el servidor en este arranque en particular).
  impresoras?: ConfigImpresoras;
}

function cargarConfig(ruta: string): Config {
  return JSON.parse(readFileSync(ruta, "utf-8"));
}

/**
 * A qué host/puerto/protocolo mandar tickets y etiquetas -- se pide una
 * vez al arrancar a la API (editable desde /sedes en la web), y si la
 * sede no tiene nada configurado ahí todavía, o no hay red en este
 * momento, se cae al `impresoras` de config.json. Si ninguno de los dos
 * existe, no hay a dónde imprimir y el arranque falla con un mensaje
 * claro en vez de un error críptico más adelante.
 */
async function obtenerImpresoras(config: Config): Promise<ConfigImpresoras> {
  try {
    const res = await fetch(
      `${config.apiBase}/api/estacion/impresoras?sede=${config.sedeId}`,
      { headers: { Authorization: `Bearer ${config.servicioClave}` } },
    );
    if (res.ok) {
      console.log("[estacion] impresoras: usando la configuración de la web");
      return res.json();
    }
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`[estacion] no se pudo pedir la configuración de impresoras a la web: ${mensaje}`);
  }

  if (config.impresoras) {
    console.log("[estacion] impresoras: usando el respaldo local de config.json");
    return config.impresoras;
  }

  throw new Error(
    "no hay impresoras configuradas: ni la web (GET /api/estacion/impresoras) ni config.json tienen nada",
  );
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

async function procesarUnTrabajo(
  config: Config,
  destinos: ReturnType<typeof crearDestinos>,
  hayEtiquetadora: boolean,
  trabajo: TrabajoPendiente,
): Promise<void> {
  try {
    const { destino, contenido } = resolverImpresion(trabajo, hayEtiquetadora);
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
  const impresoras = await obtenerImpresoras(config);
  const destinos = crearDestinos(impresoras);

  // Sin impresora de etiquetas configurada, las etiquetas salen por la
  // de tickets en ESC/POS -- ver resolverImpresion en ruteo.ts.
  const hayEtiquetadora = Boolean(impresoras.etiquetas);
  console.log(
    hayEtiquetadora
      ? "[estacion] etiquetas: impresora propia, en ZPL"
      : "[estacion] etiquetas: sin etiquetadora, salen por la de tickets",
  );

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const pendientes = await obtenerPendientes(config);
      for (const trabajo of pendientes) {
        await procesarUnTrabajo(config, destinos, hayEtiquetadora, trabajo);
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
