"use client";

/**
 * Un textarea con micrófono: se toca, se habla, y lo dicho se va
 * escribiendo al final del campo. Usa el reconocimiento de voz del
 * navegador (Chrome en Android y PC, Safari en iPhone), sin servidor
 * ni costo. Si el navegador no lo tiene, el micrófono no aparece y el
 * campo funciona como siempre.
 */
import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { unirDictado } from "@/lib/dictado";

/* Lo mínimo de la Web Speech API que se usa (TypeScript no la trae). */
interface ResultadoVoz {
  isFinal: boolean;
  0: { transcript: string };
}
interface EventoVoz {
  resultIndex: number;
  results: ArrayLike<ResultadoVoz>;
}
interface Reconocedor {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: EventoVoz) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type ConstructorReconocedor = new () => Reconocedor;

function constructorVoz(): ConstructorReconocedor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function AreaDictado({
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  value: string;
  onChange: (valor: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  const [disponible, setDisponible] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [parcial, setParcial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const reconocedor = useRef<Reconocedor | null>(null);
  const ultimoFinal = useRef("");
  // El reconocedor llama onresult mucho después del render: lee el valor
  // vigente de aquí y no del que había al empezar a dictar.
  const valorActual = useRef(value);
  valorActual.current = value;
  const alCambiar = useRef(onChange);
  alCambiar.current = onChange;

  useEffect(() => {
    setDisponible(constructorVoz() !== null);
    return () => reconocedor.current?.stop();
  }, []);

  function empezar() {
    const Voz = constructorVoz();
    if (!Voz) return;
    setError(null);
    ultimoFinal.current = "";
    const r = new Voz();
    r.lang = "es-CO";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let enCurso = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const resultado = e.results[i];
        if (!resultado) continue;
        if (resultado.isFinal) {
          // Chrome en Android a veces repite en cada resultado todo lo
          // dicho antes: se escribe solo lo que no estaba.
          const texto = resultado[0].transcript;
          const anterior = ultimoFinal.current;
          ultimoFinal.current = texto;
          const nuevo = unirDictado(
            valorActual.current,
            anterior && texto.startsWith(anterior) ? texto.slice(anterior.length) : texto,
          );
          valorActual.current = nuevo;
          alCambiar.current(nuevo);
        } else {
          enCurso += resultado[0].transcript;
        }
      }
      setParcial(enCurso);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setError("El navegador no dejó usar el micrófono. Permítelo en el candado de la barra de direcciones.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError("No se pudo escuchar. Intenta de nuevo.");
      }
    };
    r.onend = () => {
      setEscuchando(false);
      setParcial("");
      reconocedor.current = null;
    };
    reconocedor.current = r;
    r.start();
    setEscuchando(true);
  }

  function detener() {
    reconocedor.current?.stop();
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        <textarea
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          style={disponible ? { paddingRight: 52 } : undefined}
        />
        {disponible && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              if (escuchando) detener();
              else empezar();
            }}
            aria-label={escuchando ? "Dejar de dictar" : "Dictar con la voz"}
            title={escuchando ? "Dejar de dictar" : "Dictar con la voz"}
            style={{
              position: "absolute",
              right: 8,
              bottom: 8,
              width: 38,
              height: 38,
              borderRadius: "50%",
              border: escuchando ? "none" : "1px solid var(--rule)",
              background: escuchando ? "var(--peligro)" : "var(--surface)",
              color: escuchando ? "#fff" : "var(--ink-2)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: escuchando ? "0 0 0 4px var(--peligro-linea)" : "none",
            }}
          >
            {escuchando ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
          </button>
        )}
      </div>
      {escuchando && (
        <div className="campo-ayuda" style={{ color: "var(--ink-2)" }}>
          {parcial ? `“${parcial}”` : "Escuchando… habla y se irá escribiendo. Toca el cuadro rojo para terminar."}
        </div>
      )}
      {error && <div className="campo-error">{error}</div>}
    </div>
  );
}
