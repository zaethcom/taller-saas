"use client";

/**
 * Lo que se ve cuando una pantalla revienta en el navegador, en vez del
 * "Application error: a client-side exception" en blanco de Next.js.
 * Primero recarga sola una vez (casi siempre era la app abierta con la
 * versión anterior, ver lib/recarga-error.ts); si vuelve a fallar,
 * muestra qué falló y deja intentar de nuevo.
 *
 * Estilos en línea a propósito: app/global-error.tsx reemplaza el layout
 * raíz y ahí globals.css puede no estar cargado.
 */
import { useEffect, useState } from "react";
import { debeRecargar, textoDelError } from "@/lib/recarga-error";

function almacenSesion() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function PantallaError({ error }: { error: Error & { digest?: string } }) {
  const [recargando, setRecargando] = useState(true);

  useEffect(() => {
    console.error(error);
    if (debeRecargar(almacenSesion(), Date.now())) {
      window.location.reload();
    } else {
      setRecargando(false);
    }
  }, [error]);

  return (
    <main
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "64px 20px",
        fontFamily: "var(--fuente-archivo, system-ui, sans-serif)",
        color: "var(--ink, #111)",
      }}
    >
      <h1 style={{ fontSize: 22, margin: "0 0 8px" }}>
        {recargando ? "Actualizando la app…" : "Algo falló al mostrar esta pantalla"}
      </h1>
      {!recargando && (
        <>
          <p style={{ margin: "0 0 20px", fontSize: 15, color: "var(--ink-2, #555)" }}>
            Recarga la página. Si vuelve a salir, envía una foto de este mensaje.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "12px 20px",
              fontSize: 16,
              fontWeight: 700,
              border: 0,
              borderRadius: 10,
              background: "var(--accent, #111)",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
          <pre
            style={{
              marginTop: 24,
              padding: 12,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(0,0,0,0.05)",
              borderRadius: 8,
              color: "var(--ink-2, #555)",
            }}
          >
            {textoDelError(error)}
            {error.digest ? `\nRef: ${error.digest}` : ""}
            {`\n${window.location.pathname}`}
          </pre>
        </>
      )}
    </main>
  );
}
