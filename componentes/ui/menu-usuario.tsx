"use client";

/**
 * Quién tiene la sesión, en qué sede está y cerrar sesión, en un solo
 * botón de la barra superior. Antes eran tres piezas sueltas (sede,
 * nombre con rol y botón de salir) que se comían media barra.
 *
 * El botón deja ver la sede (bajo 640px solo la inicial): es lo único
 * que alguien de caja necesita confirmar sin abrir el menú.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LogOut, MapPin, ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { clienteNavegador } from "@/lib/supabase/cliente";

export function MenuUsuario({
  nombre,
  rol,
  sedeNombre,
  puedeCambiarSede,
}: {
  nombre: string;
  rol: string;
  sedeNombre: string | null;
  puedeCambiarSede: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);

  // Un toque afuera o Escape lo cierran, como cualquier menú.
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

  async function salir() {
    await clienteNavegador().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const opcion: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 9,
    width: "100%",
    padding: "10px 12px",
    border: "none",
    borderRadius: "var(--r-sm)",
    background: "none",
    color: "var(--ink)",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "left",
    textDecoration: "none",
    cursor: "pointer",
  };

  return (
    <div ref={caja} className="bs-usuario" style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label={`${nombre} · ${rol}${sedeNombre ? ` · ${sedeNombre}` : ""}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 42,
          padding: "0 10px 0 7px",
          borderRadius: "var(--r-md)",
          background: "var(--chrome-campo)",
          border: "1px solid var(--chrome-linea)",
          color: "var(--chrome-texto)",
          cursor: "pointer",
          maxWidth: 220,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: "var(--r-sm)",
            background: "var(--accent)",
            color: "var(--accent-texto)",
            fontSize: 12,
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {nombre.charAt(0).toUpperCase() || "?"}
        </span>
        {sedeNombre && (
          <span
            className="bs-usuario-texto"
            style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
          >
            {sedeNombre}
          </span>
        )}
        <ChevronDown size={15} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0, opacity: 0.7 }} />
      </button>

      {abierto && (
        <div
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            zIndex: 70,
            width: 240,
            padding: 6,
            borderRadius: "var(--r-md)",
            background: "var(--surface)",
            border: "1px solid var(--rule)",
            boxShadow: "var(--sombra-2)",
          }}
        >
          <div style={{ padding: "8px 12px 10px", borderBottom: "1px solid var(--rule)", marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{nombre}</div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", textTransform: "capitalize" }}>{rol}</div>
          </div>
          {sedeNombre &&
            (puedeCambiarSede ? (
              <Link href="/elegir-sede" role="menuitem" style={opcion} onClick={() => setAbierto(false)}>
                <MapPin size={16} strokeWidth={2} aria-hidden />
                <span style={{ minWidth: 0 }}>
                  {sedeNombre}
                  <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--ink-3)" }}>Cambiar de sede</span>
                </span>
              </Link>
            ) : (
              <div style={{ ...opcion, cursor: "default" }}>
                <MapPin size={16} strokeWidth={2} aria-hidden />
                {sedeNombre}
              </div>
            ))}
          <button type="button" role="menuitem" style={opcion} onClick={salir}>
            <LogOut size={16} strokeWidth={2} aria-hidden />
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
