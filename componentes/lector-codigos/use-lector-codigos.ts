"use client";

/**
 * Lógica de cámara + BarcodeDetector, sacada de app/(taller)/escanear/page.tsx
 * para que la pueda reusar cualquier pantalla que necesite leer un
 * código con la cámara (QR en /entregar, código de barras en /recibir)
 * sin reescribir el ciclo de vida de `getUserMedia`.
 *
 * Nativo de Chrome/Android, sin librería externa -- donde no existe
 * (Safari/iOS) `camaraDisponible` queda en false y quien llama debe
 * seguir mostrando un campo manual, nunca ocultarlo.
 */
import { useEffect, useRef, useState } from "react";

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

export function useLectorCodigos(formats: string[], onDetectado: (valor: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camaraDisponible, setCamaraDisponible] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);
  // Cada cambio vuelve a encender la cámara: tras leer un código se apaga,
  // y si ese código no lleva a nada quien llama la reinicia con `reiniciar`.
  const [intento, setIntento] = useState(0);

  function detener() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCamaraActiva(false);
  }

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

        const detector = new window.BarcodeDetector({ formats });
        intervalo = setInterval(async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) return;
          try {
            const resultados = await detector.detect(videoRef.current);
            if (resultados[0]) {
              clearInterval(intervalo);
              detener();
              onDetectado(resultados[0].rawValue);
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
  }, [intento]);

  const reiniciar = () => setIntento((n) => n + 1);

  return { videoRef, camaraDisponible, camaraActiva, detener, reiniciar };
}
