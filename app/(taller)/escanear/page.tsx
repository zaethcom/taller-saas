"use client";

/**
 * Escanear el QR de un equipo abre su orden activa -- la primera de
 * las dos promesas del proyecto.
 *
 * Usa BarcodeDetector, nativo de Chrome/Android -- sin librería
 * externa, sin peso extra en el bundle. Donde no existe (Safari/iOS
 * todavía no lo soporta ampliamente) el campo de serial manual sigue
 * siempre visible, no es un respaldo oculto.
 *
 * El QR impreso codifica la URL de seguimiento completa, no el serial
 * (ver app/api/ordenes/route.ts) -- así que decodificar el QR extrae
 * el token de esa URL y resuelve la orden con /api/ordenes/por-token.
 * Si lo que se lee no es esa URL (o si se escribe a mano), se busca
 * por serial con /api/ordenes/por-serial.
 *
 * Las esquinas y la línea del visor son del sistema, no un adorno:
 * marcan dónde hay que poner el código en una pantalla que por lo
 * demás es una imagen de cámara en movimiento.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Search, Barcode } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats: string[] }) => BarcodeDetectorLike;
  }
}

function extraerTokenDeSeguimiento(valor: string): string | null {
  try {
    const url = new URL(valor);
    const partes = url.pathname.split("/").filter(Boolean);
    const i = partes.indexOf("seguimiento");
    const token = i >= 0 ? partes[i + 1] : undefined;
    if (token) return token;
  } catch {
    // No era una URL -- se intenta como serial más abajo.
  }
  return null;
}

/** Las cuatro esquinas del visor, en el color de la empresa. */
function Esquina({ arriba, izquierda }: { arriba: boolean; izquierda: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        [arriba ? "top" : "bottom"]: 28,
        [izquierda ? "left" : "right"]: 28,
        width: 34,
        height: 34,
        [arriba ? "borderTop" : "borderBottom"]: "3px solid var(--accent)",
        [izquierda ? "borderLeft" : "borderRight"]: "3px solid var(--accent)",
        [`border${arriba ? "Top" : "Bottom"}${izquierda ? "Left" : "Right"}Radius`]: 8,
        pointerEvents: "none",
      }}
    />
  );
}

export default function PaginaEscanear() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [serial, setSerial] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [camaraDisponible, setCamaraDisponible] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);

  useEffect(() => {
    let cancelado = false;
    let intervalo: ReturnType<typeof setInterval>;

    async function iniciar() {
      if (typeof window === "undefined" || !window.BarcodeDetector) {
        setCamaraDisponible(false);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCamaraActiva(true);

        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        intervalo = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const resultados = await detector.detect(videoRef.current);
            if (resultados[0]) {
              clearInterval(intervalo);
              procesarCodigo(resultados[0].rawValue);
            }
          } catch {
            // un frame ilegible no es un error -- se reintenta en el siguiente
          }
        }, 350);
      } catch {
        setCamaraDisponible(false);
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function detener() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCamaraActiva(false);
  }

  async function procesarCodigo(valor: string) {
    detener();
    const token = extraerTokenDeSeguimiento(valor);
    if (token) {
      buscarPorToken(token);
    } else {
      buscarPorSerial(valor.trim());
    }
  }

  async function buscarPorToken(token: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/por-token?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { ordenId } = await res.json();
      router.push(`/orden/${ordenId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar la orden");
      setBuscando(false);
    }
  }

  async function buscarPorSerial(valor: string) {
    setBuscando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/por-serial?serial=${encodeURIComponent(valor)}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const { ordenId } = await res.json();
      router.push(`/orden/${ordenId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al buscar la orden");
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div>
      <TituloPantalla
        icono={<ScanLine size={24} strokeWidth={2} />}
        titulo="Escanear equipo"
        descripcion="Apunta al QR del equipo para abrir su ficha y sus órdenes."
      />

      <div className="pila">
        <div
          style={{
            position: "relative",
            aspectRatio: "1",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {camaraDisponible ? (
            <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>
              Este navegador no lee QR con la cámara. Usa el campo de serial de abajo.
            </span>
          )}

          {camaraActiva && !buscando && (
            <>
              <Esquina arriba izquierda />
              <Esquina arriba izquierda={false} />
              <Esquina arriba={false} izquierda />
              <Esquina arriba={false} izquierda={false} />
              <div
                style={{
                  position: "absolute",
                  left: 28,
                  right: 28,
                  top: "50%",
                  height: 2,
                  background: "var(--accent)",
                  boxShadow: "0 0 16px 2px var(--accent-aro)",
                  pointerEvents: "none",
                }}
              />
              <span
                style={{
                  position: "absolute",
                  bottom: 14,
                  padding: "0 14px",
                  height: 30,
                  display: "inline-flex",
                  alignItems: "center",
                  borderRadius: "var(--r-pill)",
                  background: "rgba(0,0,0,0.72)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Ubica el código dentro del recuadro
              </span>
            </>
          )}

          {buscando && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(0,0,0,0.62)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              Buscando…
            </div>
          )}
        </div>

        <div className="fila" style={{ gap: 12, flexWrap: "nowrap" }}>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
            o escríbelo
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
        </div>

        <Tarjeta>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (serial.trim()) buscarPorSerial(serial.trim());
            }}
          >
            <Campo etiqueta="Serial del equipo">
              <div className="fila" style={{ gap: 0, flexWrap: "nowrap" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 46,
                    height: 44,
                    borderRadius: "var(--r-md) 0 0 var(--r-md)",
                    border: "1px solid var(--rule-fuerte)",
                    borderRight: "none",
                    background: "var(--surface-2)",
                    color: "var(--ink-2)",
                    flexShrink: 0,
                  }}
                >
                  <Barcode size={20} strokeWidth={1.8} aria-hidden />
                </span>
                <input
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="Ej. RL-000001"
                  aria-label="Serial del equipo"
                  className="cifra"
                  style={{ borderRadius: "0 var(--r-md) var(--r-md) 0" }}
                />
              </div>
            </Campo>
            <div style={{ marginTop: 14 }}>
              <Boton
                type="submit"
                variante="primario"
                tamano="lg"
                ancho
                icono={<Search size={19} strokeWidth={2} />}
                disabled={buscando || !serial.trim()}
              >
                {buscando ? "Buscando…" : "Buscar orden"}
              </Boton>
            </div>
          </form>
        </Tarjeta>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
