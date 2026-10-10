"use client";

/**
 * La estación de impresión dentro de Chrome: para un Chromebook (o
 * cualquier equipo con Chrome) que tiene la impresora de tickets y la de
 * etiquetas conectadas por USB. Hace lo mismo que la app Android del
 * puente (estacion/puente-android.md) -- vincular con el código de
 * /sedes, pedir los trabajos cada 2 s ya traducidos a bytes y reportar
 * cada uno -- pero los manda a la impresora con WebUSB, sin instalar nada.
 *
 * Lo que se guarda en este navegador (localStorage): la clave de la sede
 * y qué impresora es cuál. Chrome recuerda el permiso USB por sitio, así
 * que después del primer «Elegir impresora» basta con abrir la página.
 *
 * El reloj de la consulta corre en un Web Worker: Chrome frena los
 * temporizadores de una pestaña oculta a uno por minuto, y una venta no
 * puede esperar un minuto su recibo.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Printer, Tag, Link2, Unlink, Check, AlertTriangle, Usb as IconoUsb } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import {
  base64ABytes,
  coincide,
  huella,
  imprimirUsb,
  usbDelNavegador,
  type DispositivoUsb,
  type HuellaUsb,
} from "@/lib/impresion-usb";

type Rol = "tickets" | "etiquetas";

interface Vinculo {
  clave: string;
  sedeId: string;
  sedeNombre: string | null;
}

interface Trabajo {
  id: string;
  tipo: string;
  destino?: Rol;
  bytes?: string;
  error?: string;
}

interface Registro {
  hora: string;
  texto: string;
  ok: boolean;
}

const CLAVE_VINCULO = "estacion-navegador:vinculo";
const CLAVE_IMPRESORAS = "estacion-navegador:impresoras";
const NOMBRE_ROL: Record<Rol, string> = { tickets: "Tickets", etiquetas: "Etiquetas" };

function leer<T>(clave: string): T | null {
  try {
    const crudo = localStorage.getItem(clave);
    return crudo ? (JSON.parse(crudo) as T) : null;
  } catch {
    return null;
  }
}

function guardar(clave: string, valor: unknown) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Sin almacenamiento (ventana privada): funciona hasta cerrar la pestaña.
  }
}

/** Un reloj que Chrome no frena en segundo plano. */
function crearReloj(ms: number, alSonar: () => void): () => void {
  try {
    const codigo = `setInterval(() => postMessage(0), ${ms});`;
    const url = URL.createObjectURL(new Blob([codigo], { type: "text/javascript" }));
    const worker = new Worker(url);
    worker.onmessage = alSonar;
    return () => {
      worker.terminate();
      URL.revokeObjectURL(url);
    };
  } catch {
    const t = setInterval(alSonar, ms);
    return () => clearInterval(t);
  }
}

export function EstacionNavegador() {
  const [soportado, setSoportado] = useState<boolean | null>(null);
  const [vinculo, setVinculo] = useState<Vinculo | null>(null);
  const [huellas, setHuellas] = useState<Partial<Record<Rol, HuellaUsb>>>({});
  const [conectadas, setConectadas] = useState<Partial<Record<Rol, DispositivoUsb>>>({});
  const [codigo, setCodigo] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enLinea, setEnLinea] = useState<boolean | null>(null);
  const [esperando, setEsperando] = useState<Rol[]>([]);
  const [registros, setRegistros] = useState<Registro[]>([]);

  const ocupado = useRef(false);
  const estado = useRef({ vinculo, conectadas });
  estado.current = { vinculo, conectadas };

  const anotar = useCallback((texto: string, ok: boolean) => {
    const hora = new Date().toLocaleTimeString("es-CO", { timeStyle: "short" });
    setRegistros((r) => [{ hora, texto, ok }, ...r].slice(0, 12));
  }, []);

  // Lo guardado en este navegador + las impresoras USB que Chrome ya
  // tiene permitidas para este sitio.
  const buscarImpresoras = useCallback(async (h: Partial<Record<Rol, HuellaUsb>>) => {
    const usb = usbDelNavegador();
    if (!usb) return;
    const dispositivos = await usb.getDevices();
    const encontradas: Partial<Record<Rol, DispositivoUsb>> = {};
    for (const rol of ["tickets", "etiquetas"] as Rol[]) {
      const buscada = h[rol];
      const d = buscada && dispositivos.find((x) => coincide(x, buscada));
      if (d) encontradas[rol] = d;
    }
    setConectadas(encontradas);
  }, []);

  useEffect(() => {
    const usb = usbDelNavegador();
    setSoportado(Boolean(usb));
    setVinculo(leer<Vinculo>(CLAVE_VINCULO));
    const h = leer<Partial<Record<Rol, HuellaUsb>>>(CLAVE_IMPRESORAS) ?? {};
    setHuellas(h);
    if (!usb) return;
    buscarImpresoras(h);
    const alCambiar = () => buscarImpresoras(leer(CLAVE_IMPRESORAS) ?? {});
    usb.addEventListener("connect", alCambiar);
    usb.addEventListener("disconnect", alCambiar);
    return () => {
      usb.removeEventListener("connect", alCambiar);
      usb.removeEventListener("disconnect", alCambiar);
    };
  }, [buscarImpresoras]);

  // Que el equipo no se duerma mientras la página está a la vista: dormido
  // no imprime. Chrome suelta el bloqueo al ocultar la pestaña, así que se
  // vuelve a pedir al regresar.
  useEffect(() => {
    if (!vinculo) return;
    type Bloqueo = { release(): Promise<void> };
    const wakeLock = (navigator as unknown as { wakeLock?: { request(t: "screen"): Promise<Bloqueo> } }).wakeLock;
    if (!wakeLock) return;
    let bloqueo: Bloqueo | null = null;
    const pedir = () => {
      if (document.visibilityState === "visible") {
        wakeLock.request("screen").then((b) => (bloqueo = b), () => {});
      }
    };
    pedir();
    document.addEventListener("visibilitychange", pedir);
    return () => {
      document.removeEventListener("visibilitychange", pedir);
      bloqueo?.release().catch(() => {});
    };
  }, [vinculo]);

  const reportar = useCallback(async (v: Vinculo, id: string, ok: boolean, mensaje?: string) => {
    await fetch(`/api/impresion/${id}/resultado`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${v.clave}` },
      body: JSON.stringify(ok ? { ok: true } : { ok: false, error: mensaje }),
    });
  }, []);

  const consultar = useCallback(async () => {
    const { vinculo: v, conectadas: c } = estado.current;
    if (!v || ocupado.current) return;
    ocupado.current = true;
    try {
      const res = await fetch(`/api/impresion/pendientes?sede=${encodeURIComponent(v.sedeId)}&formato=bytes`, {
        headers: { Authorization: `Bearer ${v.clave}` },
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) {
        guardar(CLAVE_VINCULO, null);
        setVinculo(null);
        setError("La sede dejó de aceptar este navegador (se vinculó otro equipo). Vincúlalo de nuevo.");
        return;
      }
      if (!res.ok) throw new Error(`la página respondió ${res.status}`);
      setEnLinea(true);
      const trabajos = (await res.json()) as Trabajo[];

      const faltan = new Set<Rol>();
      for (const t of trabajos) {
        if (t.error || !t.destino || !t.bytes) {
          await reportar(v, t.id, false, t.error ?? "trabajo sin datos para imprimir");
          anotar(`${t.tipo}: ${t.error ?? "sin datos"}`, false);
          continue;
        }
        const impresora = c[t.destino];
        // Sin la impresora conectada el trabajo se queda en la cola: no se
        // gasta un reintento por un cable suelto.
        if (!impresora) {
          faltan.add(t.destino);
          continue;
        }
        try {
          await imprimirUsb(impresora, base64ABytes(t.bytes));
          await reportar(v, t.id, true);
          anotar(`${t.tipo} → ${NOMBRE_ROL[t.destino]}`, true);
        } catch (e) {
          const mensaje = e instanceof Error ? e.message : "no se pudo imprimir";
          await reportar(v, t.id, false, mensaje);
          anotar(`${t.tipo} → ${NOMBRE_ROL[t.destino]}: ${mensaje}`, false);
          // La próxima vez se abre de cero, por si la impresora se reinició.
          impresora.close().catch(() => {});
        }
      }
      setEsperando([...faltan]);
    } catch {
      setEnLinea(false);
    } finally {
      ocupado.current = false;
    }
  }, [anotar, reportar]);

  useEffect(() => {
    if (!vinculo) return;
    consultar();
    return crearReloj(2000, consultar);
  }, [vinculo, consultar]);

  async function vincular() {
    setProcesando(true);
    setError(null);
    try {
      const res = await fetch("/api/estacion/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo, nombre: "Chrome (impresión directa por USB)" }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      const nuevo: Vinculo = { clave: cuerpo.clave, sedeId: cuerpo.sedeId, sedeNombre: cuerpo.sedeNombre };
      guardar(CLAVE_VINCULO, nuevo);
      setVinculo(nuevo);
      setCodigo("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular");
    } finally {
      setProcesando(false);
    }
  }

  function desvincular() {
    guardar(CLAVE_VINCULO, null);
    setVinculo(null);
    setEnLinea(null);
    setEsperando([]);
  }

  async function elegir(rol: Rol) {
    const usb = usbDelNavegador();
    if (!usb) return;
    setError(null);
    try {
      const d = await usb.requestDevice({ filters: [] });
      const nuevas = { ...huellas, [rol]: huella(d) };
      guardar(CLAVE_IMPRESORAS, nuevas);
      setHuellas(nuevas);
      await buscarImpresoras(nuevas);
    } catch (e) {
      // Cerrar el diálogo sin elegir también llega aquí (NotFoundError).
      if (e instanceof Error && e.name !== "NotFoundError") setError(e.message);
    }
  }

  if (soportado === null) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  if (!soportado) {
    return (
      <Aviso tono="peligro" icono={<AlertTriangle size={16} strokeWidth={2} />}>
        Este navegador no puede hablar con impresoras USB. Abre esta página en <strong>Google Chrome</strong>{" "}
        (o Edge) en un Chromebook, Windows, Mac o Linux. En celulares Android se usa la app del puente.
      </Aviso>
    );
  }

  return (
    <div className="pila" style={{ gap: 14 }}>
      {error && <Aviso tono="peligro">{error}</Aviso>}

      <Tarjeta>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Link2 size={16} strokeWidth={2} />
          Conexión con la página
        </div>
        {vinculo ? (
          <div className="pila" style={{ gap: 10 }}>
            <div className="fila" style={{ gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 13 }}>
              <span>
                Imprimiendo para <strong>{vinculo.sedeNombre ?? "la sede"}</strong>
              </span>
              {enLinea === false ? (
                <Etiqueta tono="peligro">Sin internet</Etiqueta>
              ) : (
                <Etiqueta tono="ok">En línea</Etiqueta>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
              Deja esta pestaña abierta: mientras esté abierta, todo lo que se mande a imprimir en esta
              sede sale por aquí.
            </p>
            <div>
              <Boton variante="fantasma" tamano="sm" icono={<Unlink size={14} strokeWidth={2} />} onClick={desvincular}>
                Desvincular este navegador
              </Boton>
            </div>
          </div>
        ) : (
          <div className="pila" style={{ gap: 10 }}>
            <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
              En otra pestaña o equipo, entra como administrador a <strong>Sedes</strong> → «Estación de
              impresión» → «Código para la app Android», y escribe aquí ese código.
            </p>
            <Campo etiqueta="Código de vinculación" ayuda="8 letras o números, como ABCD-EFGH. Vence en 15 minutos.">
              <input
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.toUpperCase())}
                placeholder="ABCD-EFGH"
                autoCapitalize="characters"
                autoComplete="off"
              />
            </Campo>
            <div>
              <Boton variante="primario" tamano="sm" onClick={vincular} disabled={procesando || !codigo.trim()}>
                Vincular
              </Boton>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
              Si la sede ya imprimía con otro equipo (el Android del puente o un PC), ese deja de recibir
              trabajos cuando se vincula este.
            </p>
          </div>
        )}
      </Tarjeta>

      <Tarjeta>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <IconoUsb size={16} strokeWidth={2} />
          Impresoras conectadas por USB
        </div>
        <div className="pila" style={{ gap: 12 }}>
          {(["tickets", "etiquetas"] as Rol[]).map((rol) => {
            const h = huellas[rol];
            const conectada = conectadas[rol];
            return (
              <div key={rol} className="fila" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {rol === "tickets" ? <Printer size={16} strokeWidth={2} /> : <Tag size={16} strokeWidth={2} />}
                <span style={{ fontWeight: 600, minWidth: 80 }}>{NOMBRE_ROL[rol]}</span>
                {h ? (
                  <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{h.nombre}</span>
                ) : (
                  <span style={{ fontSize: 13, color: "var(--ink-3)" }}>Sin elegir</span>
                )}
                {h && (conectada ? <Etiqueta tono="ok">Conectada</Etiqueta> : <Etiqueta tono="aviso">Desconectada</Etiqueta>)}
                <Boton variante="contorno" tamano="sm" onClick={() => elegir(rol)}>
                  {h ? "Cambiar" : "Elegir impresora"}
                </Boton>
              </div>
            );
          })}
          {esperando.length > 0 && (
            <Aviso tono="aviso">
              Hay impresiones de {esperando.map((r) => NOMBRE_ROL[r].toLowerCase()).join(" y ")} esperando: conecta
              esa impresora (o elígela arriba) y salen solas.
            </Aviso>
          )}
          <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
            Chrome pide permiso una sola vez por impresora. Para probar, usa «Probar impresora» en Sedes →
            Configurar impresoras; la prueba sale por aquí.
          </p>
        </div>
      </Tarjeta>

      {registros.length > 0 && (
        <Tarjeta>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Últimas impresiones</div>
          <div className="pila" style={{ gap: 4, fontSize: 13 }}>
            {registros.map((r, i) => (
              <div key={i} className="fila" style={{ gap: 8, alignItems: "center" }}>
                {r.ok ? (
                  <Check size={14} strokeWidth={2.2} color="var(--ok)" />
                ) : (
                  <AlertTriangle size={14} strokeWidth={2} color="var(--peligro)" />
                )}
                <span style={{ color: "var(--ink-3)" }}>{r.hora}</span>
                <span>{r.texto}</span>
              </div>
            ))}
          </div>
        </Tarjeta>
      )}
    </div>
  );
}
