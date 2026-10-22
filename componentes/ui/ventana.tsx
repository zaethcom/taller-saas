"use client";

/**
 * Ventana emergente sencilla: fondo oscuro, tarjeta centrada con título
 * y una X. Se usa para los formularios de "+ Nuevo…" de las listas de
 * administración, que antes estaban siempre abiertos debajo de la lista.
 * Se cierra con la X, con Escape o tocando el fondo.
 */
import { useEffect } from "react";
import { X } from "lucide-react";

export function Ventana({
  titulo,
  onCerrar,
  children,
  ancho = 480,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
  ancho?: number;
}) {
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(11, 11, 12, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--sombra-2)",
          width: "100%",
          maxWidth: ancho,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>{titulo}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)" }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
