"use client";

/**
 * Las sedes a las que puede entrar un usuario, desde /usuarios -- las
 * que le aparecen para escoger al iniciar sesión (lib/sede-activa.ts).
 * Mismo patrón que EditarCodigo: un pedacito cliente dentro de una
 * página de servidor.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Save, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

interface Sede {
  id: string;
  nombre: string;
}

export function EditarSedes({
  perfilId,
  sedes,
  permitidasIniciales,
}: {
  perfilId: string;
  sedes: Sede[];
  permitidasIniciales: string[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [permitidas, setPermitidas] = useState<string[]>(permitidasIniciales);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nombres = sedes.filter((s) => permitidas.includes(s.id)).map((s) => s.nombre);

  function alternar(id: string) {
    setPermitidas((actual) => (actual.includes(id) ? actual.filter((x) => x !== id) : [...actual, id]));
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/usuarios/${perfilId}/sedes`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // En el orden de la lista: si la sede principal se quitó, la
        // nueva principal es la primera marcada.
        body: JSON.stringify({ sedeIds: sedes.filter((s) => permitidas.includes(s.id)).map((s) => s.id) }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setEditando(false);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2000);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  if (!editando) {
    return (
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ color: "var(--ink-2)" }}>{nombres.length ? nombres.join(", ") : "—"}</span>
        <Boton
          variante="contorno"
          tamano="sm"
          icono={guardado ? <Check size={15} strokeWidth={2.6} /> : <Pencil size={14} strokeWidth={2} />}
          onClick={() => setEditando(true)}
          aria-label="Editar sedes"
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {sedes.map((s) => (
        <label key={s.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input type="checkbox" checked={permitidas.includes(s.id)} onChange={() => alternar(s.id)} />
          {s.nombre}
        </label>
      ))}
      <div style={{ display: "flex", gap: 6 }}>
        <Boton
          variante="primario"
          tamano="sm"
          icono={<Save size={15} strokeWidth={2} />}
          onClick={guardar}
          disabled={guardando}
        >
          Guardar
        </Boton>
        <Boton
          variante="fantasma"
          tamano="sm"
          icono={<X size={15} strokeWidth={2} />}
          onClick={() => {
            setPermitidas(permitidasIniciales);
            setEditando(false);
            setError(null);
          }}
          aria-label="Cancelar"
        />
      </div>
      {error && <span style={{ color: "var(--peligro)", fontSize: 12 }}>{error}</span>}
    </div>
  );
}
