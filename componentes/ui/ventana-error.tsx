"use client";

/**
 * Los errores y lo que falta para guardar salen en una ventana emergente,
 * no como texto al pie del formulario: en celular ese texto quedaba fuera
 * de la vista y parecía que el botón no hacía nada.
 *
 * Se muestra mientras `mensaje` tenga algo (un texto o una lista). Al
 * cerrarla (botón, X, Escape o tocar afuera) se llama `onCerrar`, que
 * normalmente limpia el error y lleva al primer campo pendiente.
 */
import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

export function VentanaError({
  mensaje,
  titulo,
  onCerrar,
}: {
  mensaje: string | string[] | null | undefined;
  titulo?: string;
  onCerrar: () => void;
}) {
  const lista = (Array.isArray(mensaje) ? mensaje : mensaje ? [mensaje] : []).filter(Boolean);
  const abierta = lista.length > 0;
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [abierta, onCerrar]);

  if (!abierta) return null;

  const encabezado =
    titulo ?? (lista.every((m) => /^falta/i.test(m)) ? "Falta información" : "No se pudo completar");

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="ventana-error-titulo"
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
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--sombra-2)",
          borderTop: "4px solid var(--peligro)",
          width: "100%",
          maxWidth: 420,
          maxHeight: "calc(100vh - 32px)",
          overflowY: "auto",
          padding: 18,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <AlertTriangle size={20} strokeWidth={2} color="var(--peligro)" style={{ flexShrink: 0 }} />
          <h3 id="ventana-error-titulo" style={{ margin: 0, flex: 1 }}>
            {encabezado}
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar"
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-3)", padding: 4 }}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {lista.length === 1 ? (
          <p style={{ margin: "0 0 16px", lineHeight: 1.45 }}>{lista[0]}</p>
        ) : (
          <ul style={{ margin: "0 0 16px", paddingLeft: 20, lineHeight: 1.45 }}>
            {lista.map((m) => (
              <li key={m} style={{ marginBottom: 4 }}>
                {m}
              </li>
            ))}
          </ul>
        )}

        <Boton autoFocus variante="primario" ancho onClick={onCerrar}>
          Entendido
        </Boton>
      </div>
    </div>
  );
}
