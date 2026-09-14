"use client";

/**
 * Editar el código corto de un cajero/técnico desde /usuarios, sin
 * convertir toda la página en un client component -- el mismo patrón
 * que cerrar-sesion.tsx y selector-puertas.tsx.
 */
import { useState } from "react";
import { Check, Save } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

export function EditarCodigo({ perfilId, codigoInicial }: { perfilId: string; codigoInicial: string | null }) {
  const [codigo, setCodigo] = useState(codigoInicial ?? "");
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
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
      // Un guardado silencioso deja a quien edita sin saber si pasó algo.
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        value={codigo}
        onChange={(e) => setCodigo(e.target.value)}
        placeholder="Ej. C001"
        aria-label="Código corto"
        className="cifra"
        style={{ width: 92, height: "var(--alto-sm)", padding: "0 10px", letterSpacing: "0.06em" }}
      />
      <Boton
        variante={guardado ? "contorno" : "contorno"}
        tamano="sm"
        icono={guardado ? <Check size={15} strokeWidth={2.6} /> : <Save size={15} strokeWidth={2} />}
        onClick={guardar}
        disabled={guardando}
        aria-label="Guardar código"
      />
      {error && <span style={{ color: "var(--peligro)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
