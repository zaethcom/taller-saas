"use client";

/**
 * El visor de pantalla completa para leer un QR: cámara cuadrada que
 * ocupa el ancho, esquinas y línea en el color de la empresa, y el
 * aviso "Ubica el código dentro del recuadro". Lo usan /escanear y
 * /entregar, que abren la cámara apenas se entra.
 *
 * Las esquinas y la línea del visor son del sistema, no un adorno:
 * marcan dónde hay que poner el código en una pantalla que por lo
 * demás es una imagen de cámara en movimiento.
 *
 * La cámara se apaga al leer un código (useLectorCodigos); para volver
 * a leer, quien lo usa lo vuelve a montar (p. ej. con `key`).
 */
import { useLectorCodigos } from "./use-lector-codigos";

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

export function VisorEscaner({
  formats,
  onDetectado,
  buscando = false,
  textoSinCamara,
}: {
  formats: string[];
  onDetectado: (valor: string) => void;
  buscando?: boolean;
  /** Qué hacer si el navegador no deja leer con la cámara. */
  textoSinCamara: string;
}) {
  const { videoRef, camaraDisponible, camaraActiva } = useLectorCodigos(formats, onDetectado);

  return (
    <div
      style={{
        position: "relative",
        aspectRatio: "1",
        maxHeight: "70vh",
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
        <span style={{ padding: 24, textAlign: "center", color: "var(--ink-3)", fontSize: 14 }}>{textoSinCamara}</span>
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
  );
}

/** La raya con "o escríbelo" entre el visor y el campo manual. */
export function SeparadorEscribelo() {
  return (
    <div className="fila" style={{ gap: 12, flexWrap: "nowrap" }}>
      <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink-3)" }}>
        o escríbelo
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--rule)" }} />
    </div>
  );
}
