/**
 * El programa que corre en el Android (o PC) de cada sede. Consulta la
 * cola de trabajos pendientes cada dos segundos, los traduce a bytes o
 * al lenguaje de la impresora de etiquetas (PPLB, ver estacion/etiqueta.ts)
 * según el tipo, los manda a la impresora correspondiente por red, y
 * reporta el resultado.
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
import { crearDestinos, type ConfigImpresoras, type LenguajeEtiquetas } from "./destino";
import { resolverImpresion, type TrabajoPendiente } from "./resolver";

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
  if (res.status === 401) {
    throw new Error(
      "la web no reconoce la clave de esta estación (401): en /sedes, «Vincular estación de impresión», genera una y descarga el config.json nuevo",
    );
  }
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
  lenguaje: LenguajeEtiquetas | undefined,
  trabajo: TrabajoPendiente,
): Promise<void> {
  try {
    const { destino, contenido } = resolverImpresion(trabajo, lenguaje);
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

/** Cada cuánto se vuelve a preguntar a la web a qué impresoras mandar. */
const REFRESCO_IMPRESORAS_MS = 60_000;

async function cicloPrincipal(config: Config): Promise<void> {
  let impresoras = await obtenerImpresoras(config);
  console.log(
    `[estacion] impresoras: tickets ${impresoras.tickets.host}, etiquetas ${impresoras.etiquetas.host} (${(impresoras.etiquetas.lenguaje ?? "pplb").toUpperCase()})`,
  );
  let destinos = crearDestinos(impresoras);
  let ultimoRefresco = Date.now();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Si alguien cambia una IP desde /sedes, la estación la toma sola en
    // un minuto, sin que haya que ir al local a reiniciarla. Si la web no
    // responde, se sigue con lo que ya había.
    if (Date.now() - ultimoRefresco > REFRESCO_IMPRESORAS_MS) {
      ultimoRefresco = Date.now();
      const nuevas = await obtenerImpresoras(config).catch(() => impresoras);
      if (JSON.stringify(nuevas) !== JSON.stringify(impresoras)) {
        console.log("[estacion] impresoras cambiaron en la web, usando la nueva configuración");
        impresoras = nuevas;
        destinos = crearDestinos(impresoras);
      }
    }

    try {
      const pendientes = await obtenerPendientes(config);
      for (const trabajo of pendientes) {
        await procesarUnTrabajo(config, destinos, impresoras.etiquetas.lenguaje, trabajo);
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
