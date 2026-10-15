"use client";

/**
 * El buscador de la barra superior. Una sola ruta detrás,
 * /api/ordenes/busqueda, que prueba lo escrito como número de orden,
 * código de la etiqueta, serial, documento del cliente y los dos
 * teléfonos (lib/busqueda-orden.ts). Si encuentra una sola orden la
 * abre directo -- quien escanea un QR con una pistola lectora sigue sin
 * tener que elegir nada --; si encuentra varias (un teléfono con varias
 * órdenes) las muestra debajo para elegir.
 *
 * Deliberadamente NO hay campana de notificaciones al lado: no hay
 * nada que notificar todavía y un adorno que no hace nada le enseña a
 * la gente a ignorar la barra.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

interface Resultado {
  id: string;
  numero: number;
  estado: string;
  cliente: string | null;
  equipo: string | null;
  coincideTexto: string;
}

export function Buscador({ className }: { className?: string }) {
  const router = useRouter();
  const formulario = useRef<HTMLFormElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);

  // La lista se cierra al tocar fuera o con Escape.
  useEffect(() => {
    if (!resultados) return;
    const fuera = (e: MouseEvent) => {
      if (!formulario.current?.contains(e.target as Node)) setResultados(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setResultados(null);
    };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", escape);
    };
  }, [resultados]);

  function abrir(id: string) {
    setTexto("");
    setResultados(null);
    router.push(`/orden/${id}`);
  }

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const valor = texto.trim();
    if (!valor || buscando) return;

    setBuscando(true);
    setError(null);
    setResultados(null);
    try {
      const res = await fetch(`/api/ordenes/busqueda?q=${encodeURIComponent(valor)}`);
      const datos = await res.json();
      if (!res.ok) throw new Error(datos.error ?? "No se pudo buscar");
      const lista = (datos.resultados ?? []) as Resultado[];
      if (lista.length === 0) throw new Error("No hay órdenes con ese número, serial, documento o teléfono");
      if (lista.length === 1) abrir(lista[0]!.id);
      else setResultados(lista);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar");
      entrada.current?.select();
    } finally {
      setBuscando(false);
    }
  }

  return (
    <form ref={formulario} onSubmit={buscar} className={className} style={{ position: "relative", flex: 1, minWidth: 0, maxWidth: 460 }}>
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
            if (resultados) setResultados(null);
          }}
          placeholder="Orden, serial, documento o teléfono…"
          aria-label="Buscar orden por número, serial, documento o teléfono"
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
              setResultados(null);
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
      {resultados && (
        <div
          role="listbox"
          aria-label="Órdenes encontradas"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 360,
            overflowY: "auto",
            borderRadius: "var(--r-sm)",
            background: "#ffffff",
            boxShadow: "0 8px 24px rgba(0,0,0,.18)",
            zIndex: 20,
          }}
        >
          <div style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600, color: "#6b7078" }}>
            {resultados.length} órdenes encontradas
          </div>
          {resultados.map((r) => (
            <button
              key={r.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => abrir(r.id)}
              style={{
                display: "block",
                width: "100%",
                padding: "8px 12px",
                border: "none",
                borderTop: "1px solid #eff1f4",
                background: "none",
                textAlign: "left",
                cursor: "pointer",
                color: "#131417",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, fontWeight: 600 }}>
                <span>Orden #{r.numero}</span>
                <span style={{ fontWeight: 500, color: "#6b7078", whiteSpace: "nowrap" }}>{r.estado}</span>
              </div>
              <div style={{ fontSize: 12, color: "#3b3f46", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[r.cliente, r.equipo].filter(Boolean).join(" · ")}
              </div>
              <div style={{ fontSize: 11, color: "#6b7078" }}>Coincide: {r.coincideTexto}</div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
