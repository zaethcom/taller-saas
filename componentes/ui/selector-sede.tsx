"use client";

/**
 * Los botones de /elegir-sede: uno grande por sede, para tocar con el
 * dedo en la tablet del mostrador. Al elegir, guarda la sede en este
 * dispositivo (POST /api/perfil/sede) y sigue al destino.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, MapPin } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Aviso } from "@/componentes/ui/campo";
import type { SedePermitida } from "@/lib/sede-activa";

export function SelectorSede({
  sedes,
  actual,
  destino,
}: {
  sedes: SedePermitida[];
  actual: string | null;
  destino: string;
}) {
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(sedeId: string) {
    setEnviando(sedeId);
    setError(null);
    try {
      const res = await fetch("/api/perfil/sede", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      router.push(destino);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo elegir la sede");
      setEnviando(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sedes.map((s) => (
        <Boton
          key={s.id}
          variante={s.id === actual ? "primario" : "contorno"}
          tamano="lg"
          ancho
          icono={s.id === actual ? <Check size={19} strokeWidth={2.4} /> : <MapPin size={19} strokeWidth={2} />}
          onClick={() => elegir(s.id)}
          disabled={enviando !== null}
        >
          {enviando === s.id ? "Entrando…" : s.nombre}
        </Boton>
      ))}
      {error && <Aviso tono="peligro">{error}</Aviso>}
    </div>
  );
}
