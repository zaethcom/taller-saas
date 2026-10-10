"use client";

/**
 * Panel de cámara para leer un código con useLectorCodigos() -- a
 * diferencia de app/(taller)/escanear/page.tsx (pantalla completa,
 * cámara siempre activa), esto se monta solo mientras se necesita: cada
 * pantalla decide cuándo montarlo (al tocar "Escanear", o de entrada en
 * /entregar, donde casi siempre se llega con la etiqueta en la mano).
 *
 * `proporcion` y `maxAlto` agrandan el visor donde la cámara es lo
 * principal de la pantalla; `sinMarco` evita la tarjeta dentro de otra
 * tarjeta cuando quien lo usa ya está dentro de una.
 */
import { useLectorCodigos } from "./use-lector-codigos";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Boton } from "@/componentes/ui/boton";

export function LectorCodigoBarras({
  formats,
  etiqueta = "Ubica el código dentro del recuadro",
  onDetectado,
  onCerrar,
  proporcion = "16 / 9",
  maxAlto,
  sinMarco = false,
}: {
  formats: string[];
  etiqueta?: string;
  proporcion?: string;
  maxAlto?: string;
  sinMarco?: boolean;
  onDetectado: (valor: string) => void;
  onCerrar: () => void;
}) {
  const { videoRef, camaraDisponible, camaraActiva } = useLectorCodigos(formats, onDetectado);

  const contenido = (
    <>
      <div
        style={{
          position: "relative",
          aspectRatio: proporcion,
          maxHeight: maxAlto,
          width: "100%",
          background: "var(--surface)",
          borderRadius: "var(--r-md)",
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
            No se pudo abrir la cámara (revisa el permiso del navegador). Escríbelo a mano.
          </span>
        )}

        {camaraActiva && (
          <>
            <div
              style={{
                position: "absolute",
                left: 24,
                right: 24,
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
                bottom: 12,
                padding: "0 14px",
                height: 28,
                display: "inline-flex",
                alignItems: "center",
                borderRadius: "var(--r-pill)",
                background: "rgba(0,0,0,0.72)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              {etiqueta}
            </span>
          </>
        )}
      </div>
      <div style={{ marginTop: 10 }}>
        <Boton variante="fantasma" tamano="sm" onClick={onCerrar}>
          Cancelar
        </Boton>
      </div>
    </>
  );

  return sinMarco ? <div>{contenido}</div> : <Tarjeta>{contenido}</Tarjeta>;
}
