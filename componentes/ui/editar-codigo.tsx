"use client";

/**
 * Editar el código corto de un cajero/técnico desde /usuarios, sin
 * convertir toda la página en un client component -- el mismo patrón
 * que cerrar-sesion.tsx y selector-puertas.tsx.
 */
import { useState } from "react";

export function EditarCodigo({ perfilId, codigoInicial }: { perfilId: string; codigoInicial: string | null }) {
  const [codigo, setCodigo] = useState(codigoInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${perfilId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Ej. C001"
        style={{ width: 80, padding: 4, fontFamily: "monospace" }}
      />
      <button onClick={guardar} disabled={guardando}>
        Guardar
      </button>
      {error && <span style={{ color: "#ff8080", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
