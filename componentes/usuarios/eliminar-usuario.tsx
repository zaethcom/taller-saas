"use client";

/**
 * Botón de eliminar en cada fila de /usuarios, con confirmación en la
 * misma fila. La API decide si lo borra o lo desactiva (ver DELETE
 * /api/usuarios/<id>); en los dos casos sale de la lista.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

export function EliminarUsuario({ perfilId, nombre }: { perfilId: string; nombre: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function eliminar() {
    setEliminando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${perfilId}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      setConfirmando(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el usuario");
    } finally {
      setEliminando(false);
    }
  }

  if (!confirmando) {
    return (
      <Boton
        variante="fantasma"
        tamano="sm"
        icono={<Trash2 size={14} strokeWidth={2} />}
        onClick={() => setConfirmando(true)}
        aria-label={`Eliminar a ${nombre}`}
      />
    );
  }

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
        ¿Eliminar a <strong>{nombre}</strong>?
      </span>
      <Boton variante="peligro" tamano="sm" onClick={eliminar} disabled={eliminando}>
        {eliminando ? "Eliminando…" : "Sí, eliminar"}
      </Boton>
      <Boton variante="fantasma" tamano="sm" onClick={() => setConfirmando(false)}>
        Cancelar
      </Boton>
      {error && <span style={{ fontSize: 12, color: "var(--peligro)", width: "100%" }}>{error}</span>}
    </div>
  );
}
