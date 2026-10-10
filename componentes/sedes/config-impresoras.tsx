"use client";

/**
 * Configurar a qué impresora de tickets y de etiquetas manda sus
 * trabajos la estación de una sede -- antes solo se podía cambiar
 * editando config.json a mano en el dispositivo. "Red por IP" es una
 * impresora de verdad en la red (protocolo "crudo" en
 * estacion/destino.ts); "Local por USB" es una impresora conectada por
 * USB al mismo aparato, servida por el puente Android que ya existe
 * (protocolo "puente_android") -- no son dos conceptos nuevos, son los
 * dos que ya modela el código de la estación, solo que ahora se eligen
 * aquí en vez de en un archivo.
 *
 * «Probar» manda una impresión de prueba de verdad por la cola, igual
 * que una venta, y se queda mirando qué reporta la estación: así se ve
 * si el problema es la estación (no la recoge), la impresora (la estación
 * reporta error) o nada (salió).
 *
 * «Ajustes de la etiquetadora» (oscuridad, velocidad, sensor, corrimientos)
 * viajan dentro de cada etiqueta -- ver estacion/ajustes-etiquetadora.ts.
 * Un campo vacío no se manda: la impresora sigue con lo suyo.
 */
import { useEffect, useRef, useState } from "react";
import { Printer, Check, X, FlaskConical } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";

type Protocolo = "crudo" | "puente_android";
type Lenguaje = "pplb" | "zpl";

interface Destino {
  host: string;
  puerto: number;
  protocolo: Protocolo;
}

/** Lo que guarda la base (ver AjustesEtiquetadora en estacion/). */
interface AjustesGuardados {
  oscuridad?: number;
  velocidad?: number;
  sensor?: "espacio" | "marca" | "continuo";
  verticalMm?: number;
  horizontalMm?: number;
  corteMm?: number;
}

/** En el formulario todo es texto: "" = no mandar ese ajuste. */
type AjustesFormulario = Record<keyof AjustesGuardados, string>;

const AJUSTES_VACIOS: AjustesFormulario = {
  oscuridad: "",
  velocidad: "",
  sensor: "",
  verticalMm: "",
  horizontalMm: "",
  corteMm: "",
};

function aFormulario(a: AjustesGuardados | undefined): AjustesFormulario {
  const f = { ...AJUSTES_VACIOS };
  for (const k of Object.keys(f) as (keyof AjustesGuardados)[]) {
    const v = a?.[k];
    if (v !== undefined && v !== null) f[k] = String(v);
  }
  return f;
}

function aGuardar(f: AjustesFormulario): AjustesGuardados {
  const a: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v.trim() === "") continue;
    a[k] = k === "sensor" ? v : Number(v.replace(",", "."));
  }
  return a as AjustesGuardados;
}

interface Impresoras {
  tickets: Destino;
  etiquetas: Destino & { lenguaje?: Lenguaje; ajustes?: AjustesGuardados };
}

const DESTINO_VACIO: Destino = { host: "", puerto: 9100, protocolo: "crudo" };

function CampoDestino({
  titulo,
  valor,
  onCambiar,
}: {
  titulo: string;
  valor: Destino;
  onCambiar: (d: Destino) => void;
}) {
  return (
    <div className="pila" style={{ gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{titulo}</div>
      <Campo etiqueta="Tipo de conexión">
        <select
          value={valor.protocolo}
          onChange={(e) => onCambiar({ ...valor, protocolo: e.target.value as Protocolo })}
        >
          <option value="crudo">Red por IP</option>
          <option value="puente_android">Local por USB (puente Android)</option>
        </select>
      </Campo>
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
    </div>
  );
}

function AjustesEtiquetadora({
  valor,
  lenguaje,
  onCambiar,
}: {
  valor: AjustesFormulario;
  lenguaje: Lenguaje;
  onCambiar: (a: AjustesFormulario) => void;
}) {
  const cambiar = (k: keyof AjustesFormulario) => (e: { target: { value: string } }) =>
    onCambiar({ ...valor, [k]: e.target.value });
  const esZebra = lenguaje === "zpl";
  return (
    <div className="pila" style={{ gap: 10 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>Ajustes de la etiquetadora</div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
        Lo que dejes vacío no se cambia: la impresora sigue con lo que ya tiene.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo etiqueta="Oscuridad (0 a 30)" ayuda="Si el QR sale con manchas o borroso, bájala. Si sale gris, súbela.">
          <input
            type="number"
            min={0}
            max={30}
            placeholder="La de la impresora"
            value={valor.oscuridad}
            onChange={cambiar("oscuridad")}
            className="cifra"
          />
        </Campo>
        <Campo etiqueta="Velocidad" ayuda="Más lento sale más nítido.">
          <select value={valor.velocidad} onChange={cambiar("velocidad")}>
            <option value="">La de la impresora</option>
            {[2, 3, 4, 5, 6].map((v) => (
              <option key={v} value={v}>
                {v} pulgadas por segundo
              </option>
            ))}
          </select>
        </Campo>
      </div>
      {esZebra && (
        <Campo etiqueta="Tipo de etiqueta (sensor)" ayuda="Cómo encuentra la impresora dónde empieza cada etiqueta.">
          <select value={valor.sensor} onChange={cambiar("sensor")}>
            <option value="">La de la impresora</option>
            <option value="espacio">Con espacio entre etiquetas</option>
            <option value="marca">Con marca negra atrás</option>
            <option value="continuo">Papel continuo, sin separación</option>
          </select>
        </Campo>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Campo etiqueta="Mover abajo (mm)" ayuda="Negativo sube el dibujo.">
          <input
            type="number"
            step="0.5"
            min={-15}
            max={15}
            placeholder="0"
            value={valor.verticalMm}
            onChange={cambiar("verticalMm")}
            className="cifra"
          />
        </Campo>
        <Campo etiqueta="Mover a la derecha (mm)" ayuda="Negativo lo corre a la izquierda.">
          <input
            type="number"
            step="0.5"
            min={-15}
            max={15}
            placeholder="0"
            value={valor.horizontalMm}
            onChange={cambiar("horizontalMm")}
            className="cifra"
          />
        </Campo>
      </div>
      {esZebra && (
        <Campo
          etiqueta="Avance al terminar (mm)"
          ayuda="Si al cortarla la etiqueta queda un poco adentro, súbelo (prueba con 2). Si sale de más, ponlo negativo."
        >
          <input
            type="number"
            step="0.5"
            min={-15}
            max={15}
            placeholder="0"
            value={valor.corteMm}
            onChange={cambiar("corteMm")}
            className="cifra"
          />
        </Campo>
      )}
      {esZebra && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--ink-3)" }}>
          Si cambiaste de rollo o se corre de etiqueta en etiqueta, calibra el sensor: con la impresora encendida, deja
          presionado el botón FEED y suéltalo cuando la luz parpadee dos veces.
        </p>
      )}
    </div>
  );
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
              mensaje: `La estación la recibió pero la impresora falló: ${t.error ?? "error desconocido"}. Revisa la IP, el puerto y que la impresora esté encendida.`,
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
  const [ajustes, setAjustes] = useState<AjustesFormulario>(AJUSTES_VACIOS);
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
          setAjustes(aFormulario(data.etiquetas.ajustes));
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
        body: JSON.stringify({ tickets, etiquetas: { ...etiquetas, lenguaje, ajustes: aGuardar(ajustes) } }),
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
          <CampoDestino titulo="Tickets (recibos, comprobantes)" valor={tickets} onCambiar={setTickets} />
          <div className="pila" style={{ gap: 10 }}>
            <CampoDestino titulo="Etiquetas (QR, artículos, repuestos)" valor={etiquetas} onCambiar={setEtiquetas} />
            <Campo
              etiqueta="Marca de la etiquetadora"
              ayuda="Cada marca habla un idioma distinto. Si la etiqueta sale en blanco o con letras raras, prueba la otra."
            >
              <select value={lenguaje} onChange={(e) => setLenguaje(e.target.value as Lenguaje)}>
                <option value="pplb">Argox (PPLB)</option>
                <option value="zpl">Zebra (ZPL)</option>
              </select>
            </Campo>
          </div>
          <AjustesEtiquetadora valor={ajustes} lenguaje={lenguaje} onCambiar={setAjustes} />
        </div>
      )}

      <div className="fila" style={{ marginTop: 14, gap: 8, flexWrap: "wrap" }}>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Check size={15} strokeWidth={2.2} />}
          onClick={guardar}
          disabled={guardando || cargando || !tickets.host.trim() || !etiquetas.host.trim()}
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
      {error && (
        <div style={{ marginTop: 10 }}>
          <Aviso tono="peligro">{error}</Aviso>
        </div>
      )}
    </Tarjeta>
  );
}
