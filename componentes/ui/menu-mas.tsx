"use client";

/**
 * El botón «⋯» con las acciones que se usan poco (editar, reimprimir...)
 * para que no ocupen una fila de botones cada una.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";

export interface OpcionMenuMas {
  texto: string;
  icono?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function MenuMas({ opciones, etiqueta = "Más acciones" }: { opciones: OpcionMenuMas[]; etiqueta?: string }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [abierto]);

  if (opciones.length === 0) return null;

  const estilo: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: "var(--r-sm)",
    background: "none",
    color: "var(--ink)",
    fontFamily: "inherit",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
  };

  return (
    <div ref={caja} style={{ position: "relative" }}>
      <button
        type="button"
        className="btn btn-contorno btn-icono"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={etiqueta}
        title={etiqueta}
      >
        <MoreHorizontal size={18} strokeWidth={2.2} />
      </button>
      {abierto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 40,
            minWidth: 220,
            padding: 6,
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            boxShadow: "var(--sombra-2)",
          }}
        >
          {opciones.map((o) =>
            o.href ? (
              <Link key={o.texto} href={o.href} role="menuitem" style={estilo} onClick={() => setAbierto(false)}>
                {o.icono}
                {o.texto}
              </Link>
            ) : (
              <button
                key={o.texto}
                type="button"
                role="menuitem"
                style={{ ...estilo, opacity: o.disabled ? 0.5 : 1 }}
                disabled={o.disabled}
                onClick={() => {
                  setAbierto(false);
                  o.onClick?.();
                }}
              >
                {o.icono}
                {o.texto}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}
