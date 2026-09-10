"use client";

/**
 * Un lienzo simple para capturar la firma de quien recibe el equipo.
 * Sin librería externa: un canvas y los eventos de puntero alcanzan
 * para esto. El padre pide el PNG con el ref cuando lo necesita.
 */
import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export interface FirmaCanvasHandle {
  obtenerBlob(): Promise<Blob | null>;
  limpiar(): void;
  estaVacio(): boolean;
}

export const FirmaCanvas = forwardRef<FirmaCanvasHandle>(function FirmaCanvas(_props, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const [vacio, setVacio] = useState(true);

  useImperativeHandle(ref, () => ({
    obtenerBlob: () =>
      new Promise((resolve) => {
        canvasRef.current?.toBlob((blob) => resolve(blob), "image/png");
      }),
    limpiar: () => {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx && canvasRef.current) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      setVacio(true);
    },
    estaVacio: () => vacio,
  }));

  function posicion(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function iniciar(e: React.PointerEvent<HTMLCanvasElement>) {
    dibujando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
    setVacio(false);
  }

  function terminar() {
    dibujando.current = false;
  }

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={140}
      onPointerDown={iniciar}
      onPointerMove={mover}
      onPointerUp={terminar}
      onPointerLeave={terminar}
      style={{ border: "1px solid #ccc", borderRadius: 8, touchAction: "none", width: "100%" }}
    />
  );
});
