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
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
      <h1>Escanear equipo</h1>

      <div
        style={{
          position: "relative",
          aspectRatio: "1",
          background: "#1a262c",
          borderRadius: 12,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        {camaraDisponible ? (
          <video
            ref={videoRef}
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span style={{ opacity: 0.5, padding: 20, textAlign: "center" }}>
            Este navegador no lee QR con la cámara. Usa el campo de serial abajo.
          </span>
        )}
        {camaraActiva && !buscando && (
          <div
            style={{
              position: "absolute",
              inset: "20%",
              border: "3px solid #4ade80",
              borderRadius: 12,
              pointerEvents: "none",
            }}
          />
        )}
        {buscando && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            Buscando…
          </div>
        )}
      </div>

      <p style={{ opacity: 0.7, fontSize: 14 }}>
        O escribe el serial a mano:
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (serial.trim()) buscarPorSerial(serial.trim());
        }}
      >
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Ej. RL-000001"
          style={{ width: "100%", padding: 12, borderRadius: 8, marginBottom: 8 }}
        />
        <button type="submit" disabled={buscando} style={{ width: "100%", padding: 12, borderRadius: 8 }}>
          {buscando ? "Buscando…" : "Buscar orden"}
        </button>
      </form>
      {error && <p style={{ color: "#ff8080" }}>{error}</p>}
    </div>
  );
}
