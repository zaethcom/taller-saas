"use client";

/**
 * Configurar a qué impresora de tickets y de etiquetas manda sus
 * trabajos la estación de una sede -- antes solo se podía cambiar
 * editando config.json a mano en el dispositivo. "Red por IP" es una
 * impresora de verdad en la red (protocolo "crudo" en
 * estacion/destino.ts); "Local por USB" es una impresora conectada por
 * USB al equipo que imprime: Chrome con /estacion (WebUSB) o el puente Android
 * (protocolo "puente_android") -- no son dos conceptos nuevos, son los
 * dos que ya modela el código de la estación, solo que ahora se eligen
 * aquí en vez de en un archivo.
 *
 * «Probar» manda una impresión de prueba de verdad por la cola, igual
 * que una venta, y se queda mirando qué reporta la estación: así se ve
 * si el problema es la estación (no la recoge), la impresora (la estación
 * reporta error) o nada (salió).
 */
import { useEffect, useRef, useState } from "react";
import { Printer, Check, X, FlaskConical } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { ImpresorasUsbEsteEquipo } from "@/componentes/estacion/impresoras-usb";
import { VentanaError } from "@/componentes/ui/ventana-error";

type Protocolo = "crudo" | "puente_android";
type Lenguaje = "pplb" | "zpl" | "escpos";
type AnchoPapel = 58 | 80;

interface Destino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

interface Impresoras {
  tickets: Destino & { anchoMm?: AnchoPapel };
  etiquetas: Destino & { lenguaje?: Lenguaje; ajusteMm?: number };
}

const DESTINO_VACIO: Destino = { host: "", puerto: 9100, protocolo: "crudo" };

/** Con USB la estación (Chrome en /estacion o la app del puente) no necesita IP. */
const HOST_USB = "localhost";

function CampoDestino({
  titulo,
  valor,
  onCambiar,
}: {
  titulo: string;
  valor: Destino;
  onCambiar: (d: Destino) => void;
}) {
  const usb = valor.protocolo === "puente_android";
  const hostVisible = usb && valor.host === HOST_USB ? "" : valor.host;
  return (
    <div className="pila" style={{ gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>
      <Campo etiqueta="Tipo de conexión">
        <select
          value={valor.protocolo}
          onChange={(e) => onCambiar({ ...valor, protocolo: e.target.value as Protocolo })}
        >
          <option value="crudo">Red por IP</option>
          <option value="puente_android">USB (Chrome con /estacion o app del puente)</option>
        </select>
      </Campo>
      {usb ? (
        <Campo
          etiqueta="IP del Android (opcional)"
          ayuda="Déjalo vacío si la impresora está conectada por USB al equipo con Chrome o al Android con la app: no hace falta IP. Solo se llena si un PC con la estación le manda a un Android por la red."
        >
          <input
            placeholder="Vacío = USB directo"
            value={hostVisible}
            onChange={(e) => onCambiar({ ...valor, host: e.target.value })}
            className="cifra"
          />
        </Campo>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 10 }}>
          <Campo etiqueta="Host / IP">
            <input
              placeholder="192.168.1.50"
              value={valor.host}
              onChange={(e) => onCambiar({ ...valor, host: e.target.value })}
              className="cifra"
            />
          </Campo>
          <Campo etiqueta="Puerto">
            <input
              type="number"
              value={valor.puerto}
              onChange={(e) => onCambiar({ ...valor, puerto: Number(e.target.value) || 9100 })}
              className="cifra"
            />
          </Campo>
        </div>
      )}
    </div>
  );
}

/** Lo que se guarda: con USB y sin IP, un host fijo para que la base lo acepte. */
function paraGuardar(d: Destino): Destino {
  return d.protocolo === "puente_android" && !d.host.trim() ? { ...d, host: HOST_USB } : d;
}

function listo(d: Destino): boolean {
  return d.protocolo === "puente_android" || !!d.host.trim();
}

type Destinos = "tickets" | "etiquetas";

interface Prueba {
  destino: Destinos;
  estado: "enviando" | "pendiente" | "impreso" | "error" | "sin_respuesta";
  mensaje: string;
}

/** Cuánto esperar a que la estación recoja la prueba antes de rendirse. */
const ESPERA_PRUEBA_MS = 60_000;

function useProbarImpresora(sedeId: string) {
  const [prueba, setPrueba] = useState<Prueba | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current);
  }, []);

  async function probar(destino: Destinos) {
    if (temporizador.current) clearTimeout(temporizador.current);
    setPrueba({ destino, estado: "enviando", mensaje: "Enviando la prueba…" });
    try {
      const res = await fetch(`/api/sedes/${sedeId}/impresoras/prueba`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destino }),
      });
      const cuerpo = await res.json();
      if (!res.ok) throw new Error(cuerpo.error);
      const antes: number = cuerpo.antes ?? 0;
      const espera =
        antes > 0
          ? `En cola. Antes de la prueba hay ${antes} ${antes === 1 ? "impresión esperando" : "impresiones esperando"}, que saldrán primero.`
          : "En cola, esperando a que la estación la recoja…";
      setPrueba({ destino, estado: "pendiente", mensaje: espera });

      const inicio = Date.now();
      const revisar = async () => {
        try {
          const r = await fetch(`/api/sedes/${sedeId}/impresoras/prueba?trabajo=${cuerpo.id}`);
          const t = (await r.json()) as { estado: string; error: string | null };
          if (t.estado === "impreso") {
            setPrueba({ destino, estado: "impreso", mensaje: "La estación la imprimió. Revisa que el papel haya salido bien." });
            return;
          }
          if (t.estado === "error" || t.error) {
            // La base reintenta hasta 5 veces, pero el primer error ya dice
            // lo que pasa (casi siempre: la impresora no responde en esa IP).
            setPrueba({
              destino,
              estado: "error",
              mensaje: `La estación la recibió pero la impresora falló: ${t.error ?? "error desconocido"}. Revisa la conexión (la IP o el cable USB) y que la impresora esté encendida.`,
            });
            return;
          }
        } catch {
          // Un fallo de red de este navegador no dice nada de la impresora;
          // se sigue esperando.
        }
        if (Date.now() - inicio > ESPERA_PRUEBA_MS) {
          setPrueba({
            destino,
            estado: "sin_respuesta",
            mensaje:
              "Pasó un minuto y la estación no la recogió. La estación de esta sede no está corriendo o no tiene la clave correcta. La prueba queda en cola y saldrá cuando se conecte.",
          });
          return;
        }
        temporizador.current = setTimeout(revisar, 3000);
      };
      temporizador.current = setTimeout(revisar, 3000);
    } catch (e) {
      setPrueba({
        destino,
        estado: "error",
        mensaje: e instanceof Error ? e.message : "No se pudo enviar la prueba",
      });
    }
  }

  return { prueba, probar };
}

const TONO_PRUEBA = {
  enviando: "info",
  pendiente: "info",
  impreso: "ok",
  error: "peligro",
  sin_respuesta: "aviso",
} as const;

export function ConfigImpresoras({ sedeId }: { sedeId: string }) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [tickets, setTickets] = useState<Destino>(DESTINO_VACIO);
  const [etiquetas, setEtiquetas] = useState<Destino>(DESTINO_VACIO);
  const [lenguaje, setLenguaje] = useState<Lenguaje>("pplb");
  const [anchoPapel, setAnchoPapel] = useState<AnchoPapel>(80);
  // Texto y no número: se puede escribir "-" o "1." a medio camino.
  const [ajusteEtiqueta, setAjusteEtiqueta] = useState("0");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { prueba, probar } = useProbarImpresora(sedeId);
  const probando = prueba?.estado === "enviando" || prueba?.estado === "pendiente";

  useEffect(() => {
    if (!abierto) return;
    setCargando(true);
    fetch(`/api/sedes/${sedeId}/impresoras`)
      .then((r) => r.json())
      .then((data: Impresoras | null) => {
        if (data) {
          setTickets(data.tickets);
          setEtiquetas(data.etiquetas);
          setLenguaje(data.etiquetas.lenguaje ?? "pplb");
          setAnchoPapel(data.tickets.anchoMm === 58 ? 58 : 80);
          setAjusteEtiqueta(String(data.etiquetas.ajusteMm ?? 0));
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [abierto, sedeId]);

  async function guardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const res = await fetch(`/api/sedes/${sedeId}/impresoras`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tickets: { ...paraGuardar(tickets), anchoMm: anchoPapel },
          // Sin etiquetadora, las etiquetas van a la POS: lo que diga el destino de etiquetas no se usa.
          etiquetas: {
            ...paraGuardar(lenguaje === "escpos" && !listo(etiquetas) ? tickets : etiquetas),
            lenguaje,
            ajusteMm: Number(ajusteEtiqueta.replace(",", ".")) || 0,
          },
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setMensaje(
        "Guardado. La estación de esta sede la toma en menos de un minuto (si tiene una versión anterior, al reiniciarla).",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!abierto) {
    return (
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<Printer size={14} strokeWidth={2} />}
        onClick={() => setAbierto(true)}
        style={{ marginTop: 10 }}
      >
        Configurar impresoras
      </Boton>
    );
  }

  return (
    <Tarjeta style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
          <Printer size={16} strokeWidth={2} />
          Impresoras de esta sede
        </div>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={() => setAbierto(false)}
        />
      </div>

      {cargando ? (
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)" }}>Cargando…</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          <div className="pila" style={{ gap: 10 }}>
            <CampoDestino titulo="Tickets (recibos, comprobantes)" valor={tickets} onCambiar={setTickets} />
            <Campo
              etiqueta="Ancho del papel de tickets"
              ayuda="Mide el rollo: el ancho cambia cuántas letras caben por renglón y el tamaño del logo y del QR."
            >
              <select value={anchoPapel} onChange={(e) => setAnchoPapel(Number(e.target.value) === 58 ? 58 : 80)}>
                <option value={80}>80 mm</option>
                <option value={58}>58 mm</option>
              </select>
            </Campo>
          </div>
          <div className="pila" style={{ gap: 10 }}>
            <CampoDestino titulo="Etiquetas (QR, artículos, repuestos)" valor={etiquetas} onCambiar={setEtiquetas} />
            <Campo
              etiqueta="Marca de la etiquetadora"
              ayuda="Cada marca habla un idioma distinto. Si la etiqueta sale en blanco o con letras raras, prueba la otra. Si la etiqueta sale en la impresora de recibos como texto raro, elige «imprimir en la POS de tickets»."
            >
              <select value={lenguaje} onChange={(e) => setLenguaje(e.target.value as Lenguaje)}>
                <option value="pplb">Argox (PPLB)</option>
                <option value="zpl">Zebra (ZPL)</option>
                <option value="escpos">No tengo etiquetadora: imprimir en la POS de tickets</option>
              </select>
            </Campo>
            <Campo
              etiqueta="Correr la etiqueta (mm)"
              ayuda="Si sale cortada por la izquierda, pon un número positivo (ej. 4) para correrla a la derecha; si sale cortada por la derecha, uno negativo. Guarda y usa «Probar» hasta que salga completa."
            >
              <input
                type="text"
                inputMode="decimal"
                value={ajusteEtiqueta}
                onChange={(e) => setAjusteEtiqueta(e.target.value.replace(/[^0-9.,-]/g, "").slice(0, 5))}
                className="cifra"
              />
            </Campo>
          </div>
        </div>
      )}

      {!cargando && (tickets.protocolo === "puente_android" || etiquetas.protocolo === "puente_android") && (
        <div style={{ marginTop: 14 }}>
          <ImpresorasUsbEsteEquipo />
        </div>
      )}

      <div className="fila" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Check size={15} strokeWidth={2.2} />}
          onClick={guardar}
          disabled={guardando || cargando || !listo(tickets) || (lenguaje !== "escpos" && !listo(etiquetas))}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </Boton>
        <Boton
          variante="contorno"
          tamano="sm"
          icono={<FlaskConical size={15} strokeWidth={2} />}
          onClick={() => probar("tickets")}
          disabled={probando || cargando}
        >
          Probar impresora de tickets
        </Boton>
        <Boton
          variante="contorno"
          tamano="sm"
          icono={<FlaskConical size={15} strokeWidth={2} />}
          onClick={() => probar("etiquetas")}
          disabled={probando || cargando}
        >
          Probar impresora de etiquetas
        </Boton>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
        La prueba usa lo último que guardaste. Si cambiaste algo, guarda primero.
      </p>

      {prueba && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono={TONO_PRUEBA[prueba.estado]}>
            <strong>{prueba.destino === "tickets" ? "Tickets" : "Etiquetas"}:</strong> {prueba.mensaje}
          </Aviso>
        </div>
      )}

      {mensaje && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="ok">{mensaje}</Aviso>
        </div>
      )}
      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </Tarjeta>
  );
}
