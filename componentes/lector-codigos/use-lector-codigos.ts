"use client";

/**
 * Lógica de cámara + BarcodeDetector, sacada de app/(taller)/escanear/page.tsx
 * para que la pueda reusar cualquier pantalla que necesite leer un
 * código con la cámara (QR en /entregar, código de barras en /recibir)
 * sin reescribir el ciclo de vida de `getUserMedia`.
 *
 * Usa el BarcodeDetector nativo (Chrome/Android) cuando existe; donde
 * no (Safari/iOS, Firefox) carga @zxing/browser bajo demanda, para que
 * la librería no pese en las pantallas que nunca abren la cámara. Si
 * no hay cámara o el permiso se niega, `camaraDisponible` queda en false
 * y quien llama debe seguir mostrando un campo manual, nunca ocultarlo.
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

/** Nombres de formato del BarcodeDetector → los de zxing. */
const FORMATOS_ZXING: Record<string, string> = {
  qr_code: "QR_CODE",
  code_128: "CODE_128",
  code_39: "CODE_39",
  ean_13: "EAN_13",
  ean_8: "EAN_8",
  upc_a: "UPC_A",
  upc_e: "UPC_E",
};

export function useLectorCodigos(formats: string[], onDetectado: (valor: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camaraDisponible, setCamaraDisponible] = useState(true);
  const [camaraActiva, setCamaraActiva] = useState(false);

  function detener() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCamaraActiva(false);
  }

  useEffect(() => {
    let cancelado = false;
    let intervalo: ReturnType<typeof setInterval>;

    let pararZxing: (() => void) | undefined;
    let leido = false;

    function detectado(valor: string) {
      // dos frames seguidos pueden leer el mismo código antes de parar
      if (leido) return;
      leido = true;
      clearInterval(intervalo);
      pararZxing?.();
      detener();
      onDetectado(valor);
    }

    async function iniciar() {
      if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia) {
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

        if (window.BarcodeDetector) {
          const detector = new window.BarcodeDetector({ formats });
          intervalo = setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const resultados = await detector.detect(videoRef.current);
              if (resultados[0]) detectado(resultados[0].rawValue);
            } catch {
              // un frame ilegible no es un error -- se reintenta en el siguiente
            }
          }, 350);
          return;
        }

        const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
          import("@zxing/browser"),
          import("@zxing/library"),
        ]);
        if (cancelado || !videoRef.current) return;
        const hints = new Map();
        hints.set(
          DecodeHintType.POSSIBLE_FORMATS,
          formats
            .map((f) => BarcodeFormat[FORMATOS_ZXING[f] as keyof typeof BarcodeFormat])
            .filter((f) => f !== undefined),
        );
        const lector = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 250 });
        const controles = await lector.decodeFromVideoElement(videoRef.current, (resultado) => {
          if (resultado) detectado(resultado.getText());
        });
        pararZxing = () => controles.stop();
        if (cancelado) pararZxing();
      } catch {
        setCamaraDisponible(false);
      }
    }

    iniciar();

    return () => {
      cancelado = true;
      clearInterval(intervalo);
      pararZxing?.();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { videoRef, camaraDisponible, camaraActiva, detener };
}
