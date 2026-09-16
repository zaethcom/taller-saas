"use client";

/**
 * El buscador de la barra superior. Existe porque hay dos rutas reales
 * detrás -- /api/ordenes/buscar (por número) y /api/ordenes/por-serial
 * (por serial de equipo) -- y decide cuál usar por la forma de lo que
 * se escribe: solo dígitos es un número de orden, cualquier otra cosa
 * es un serial. Quien escanea un QR con una pistola lectora obtiene el
 * serial y cae en la segunda sin tener que elegir nada.
 *
 * Deliberadamente NO hay campana de notificaciones al lado: no hay
 * nada que notificar todavía y un adorno que no hace nada le enseña a
 * la gente a ignorar la barra.
 */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export function Buscador({ className }: { className?: string }) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor || buscando) return;

    setBuscando(true);
    setError(null);
    try {
      const soloDigitos = /^\d+$/.test(valor);
      const ruta = soloDigitos
        ? `/api/ordenes/buscar?numero=${encodeURIComponent(valor)}`
        : `/api/ordenes/por-serial?serial=${encodeURIComponent(valor)}`;
      const res = await fetch(ruta);
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "no se encontró");
      // Las dos rutas devuelven la orden de forma distinta: buscar
      // devuelve la orden entera, por-serial solo su id.
      const id = soloDigitos ? datos.id : datos.ordenId;
      setTexto("");
      router.push(`/orden/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar");
      entrada.current?.select();
    } finally {
      setBuscando(false);
    }
  }

  return (
    <form onSubmit={buscar} className={className} style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 460 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 42,
          padding: "0 12px",
          borderRadius: "var(--r-md)",
          background: "#ffffff",
        }}
      >
        <Search size={17} strokeWidth={2} color="#6b7078" aria-hidden />
        <input
          ref={entrada}
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Buscar orden por número o serial…"
          aria-label="Buscar orden por número o serial"
          style={{
            flex: 1,
            minWidth: 0,
            height: 40,
            padding: 0,
            border: "none",
            background: "none",
            boxShadow: "none",
            fontSize: 13,
            color: "#131417",
          }}
        />
        {texto && (
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setError(null);
              entrada.current?.focus();
            }}
            aria-label="Limpiar"
            style={{ display: "flex", border: "none", background: "none", cursor: "pointer", padding: 2 }}
          >
            <X size={15} strokeWidth={2.4} color="#6b7078" />
          </button>
        )}
        <span className="btn-atajo" style={{ background: "#eff1f4", color: "#6b7078" }}>
          {buscando ? "…" : "↵"}
        </span>
      </div>
      {error && (
        <div
          role="alert"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            padding: "8px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--peligro)",
            color: "#ffffff",
            fontSize: 12,
            fontWeight: 600,
            zIndex: 20,
          }}
        >
          {error}
        </div>
      )}
    </form>
  );
}
