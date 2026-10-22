"use client";

/**
 * Fotos y videos de cómo deja el cliente el equipo, tomados en el
 * mostrador antes de crear la orden. Todavía no hay orden a la cual
 * colgarlos, así que se quedan en memoria (con su vista previa) y
 * /recibir los sube con fase 'entrada' y visibles al cliente apenas
 * POST /api/ordenes devuelve el id -- ver subirEvidenciaIngreso.
 */
import { useEffect, useRef } from "react";
import { Camera, Video, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { subirEvidencia } from "@/lib/subir-evidencia";
import { ETIQUETA_FASE_EVIDENCIA, LIMITE_EVIDENCIA_BYTES } from "@/lib/evidencia";

export interface ArchivoIngreso {
  archivo: File;
  url: string;
  tipo: "foto" | "video";
}

export function EvidenciaIngreso({
  archivos,
  onChange,
  onError,
}: {
  archivos: ArchivoIngreso[];
  onChange: (archivos: ArchivoIngreso[]) => void;
  onError: (mensaje: string | null) => void;
}) {
  const inputFotoRef = useRef<HTMLInputElement>(null);
  const inputVideoRef = useRef<HTMLInputElement>(null);

  // Las URLs de vista previa ocupan memoria hasta que se liberan.
  const archivosRef = useRef(archivos);
  archivosRef.current = archivos;
  useEffect(() => () => archivosRef.current.forEach((a) => URL.revokeObjectURL(a.url)), []);

  function agregar(e: React.ChangeEvent<HTMLInputElement>) {
    const nuevos = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (nuevos.length === 0) return;

    const pesado = nuevos.find((a) => a.size > LIMITE_EVIDENCIA_BYTES);
    if (pesado) {
      onError(
        `El archivo pesa ${(pesado.size / 1024 / 1024).toFixed(1)}MB. El límite es 50MB -- ` +
          `graba un video más corto o toma la foto de nuevo.`,
      );
      return;
    }
    onError(null);
    onChange([
      ...archivos,
      ...nuevos.map((archivo) => ({
        archivo,
        url: URL.createObjectURL(archivo),
        tipo: archivo.type.startsWith("video/") ? ("video" as const) : ("foto" as const),
      })),
    ]);
  }

  function quitar(i: number) {
    const a = archivos[i];
    if (a) URL.revokeObjectURL(a.url);
    onChange(archivos.filter((_, j) => j !== i));
  }

  return (
    <div>
      <p className="campo-ayuda" style={{ marginTop: 0, marginBottom: 12 }}>
        Cómo deja el cliente el equipo (&quot;{ETIQUETA_FASE_EVIDENCIA.entrada}&quot;). El cliente la ve en su enlace de seguimiento.
      </p>

      <div className="fila" style={{ gap: 10 }}>
        <Boton
          variante="contorno"
          icono={<Camera size={17} strokeWidth={2.2} />}
          onClick={() => inputFotoRef.current?.click()}
        >
          Tomar foto
        </Boton>
        <Boton
          variante="contorno"
          icono={<Video size={17} strokeWidth={2.2} />}
          onClick={() => inputVideoRef.current?.click()}
        >
          Grabar video
        </Boton>
      </div>
      <input
        ref={inputFotoRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={agregar}
        hidden
        aria-label="Tomar foto del equipo recibido"
      />
      <input
        ref={inputVideoRef}
        type="file"
        accept="video/*"
        capture="environment"
        onChange={agregar}
        hidden
        aria-label="Grabar video del equipo recibido"
      />

      {archivos.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 10,
            marginTop: 14,
          }}
        >
          {archivos.map((a, i) => (
            <div key={a.url} style={{ position: "relative" }}>
              {a.tipo === "video" ? (
                <video src={a.url} muted playsInline preload="metadata" style={estiloMiniatura} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.url} alt="Equipo recibido" style={estiloMiniatura} />
              )}
              <span style={{ position: "absolute", left: 6, bottom: 6 }}>
                <Etiqueta tono="ok">{ETIQUETA_FASE_EVIDENCIA.entrada}</Etiqueta>
              </span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label="Quitar"
                style={{
                  position: "absolute",
                  top: 6,
                  right: 6,
                  width: 28,
                  height: 28,
                  padding: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--r-sm)",
                  border: "none",
                  background: "rgba(0,0,0,.6)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                <X size={16} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const estiloMiniatura: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1",
  objectFit: "cover",
  display: "block",
  borderRadius: "var(--r-md)",
  border: "1px solid var(--rule)",
};

/**
 * Sube la evidencia del mostrador a la orden recién creada. Devuelve
 * cuántos archivos no se pudieron subir, para que /recibir lo diga y
 * mande a /orden/[id]/evidencia a reintentar -- la orden ya existe,
 * no se deshace por una foto.
 */
export async function subirEvidenciaIngreso(params: {
  empresaId: string;
  ordenId: string;
  archivos: ArchivoIngreso[];
}): Promise<number> {
  let fallidos = 0;
  for (const a of params.archivos) {
    try {
      await subirEvidencia({
        empresaId: params.empresaId,
        ordenId: params.ordenId,
        archivo: a.archivo,
        extension: a.archivo.name.split(".").pop() || (a.tipo === "video" ? "mp4" : "jpg"),
        tipo: a.tipo,
        fase: "entrada",
        visibleCliente: true,
      });
    } catch {
      fallidos++;
    }
  }
  return fallidos;
}
