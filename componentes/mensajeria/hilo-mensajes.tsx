"use client";

/**
 * El hilo de mensajes entre cliente y taller (Fase F3 del Plan 3) --
 * compartido entre /seguimiento/[token] (lado cliente) y el hub
 * /orden/[id] (lado staff). `ladoPropio` decide qué burbujas se
 * alinean a la derecha: lo que escribió quien está mirando la
 * pantalla, no un autor fijo.
 */
import { useState } from "react";
import { Send } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";

export interface Mensaje {
  autorTipo: "cliente" | "staff";
  texto: string;
  creadoEn: string;
}

export function HiloMensajes({
  mensajes,
  ladoPropio,
  onEnviar,
  placeholder = "Escribe un mensaje…",
}: {
  mensajes: Mensaje[];
  ladoPropio: "cliente" | "staff";
  onEnviar: (texto: string) => Promise<void>;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const valor = texto.trim();
    if (!valor) return;
    setEnviando(true);
    try {
      await onEnviar(valor);
      setTexto("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tarjeta style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 360, overflowY: "auto" }}>
        {mensajes.length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-3)", textAlign: "center" }}>Sin mensajes todavía.</p>
        ) : (
          mensajes.map((m, i) => {
            const esPropio = m.autorTipo === ladoPropio;
            return (
              <div key={i} style={{ display: "flex", justifyContent: esPropio ? "flex-end" : "flex-start" }}>
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "8px 12px",
                    borderRadius: "var(--r-md)",
                    background: esPropio ? "var(--accent)" : "var(--surface-2)",
                    color: esPropio ? "var(--accent-texto)" : "var(--ink)",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 14, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.texto}</p>
                  <span
                    className="cifra"
                    style={{ display: "block", fontSize: 11, marginTop: 4, opacity: 0.75 }}
                  >
                    {new Date(m.creadoEn).toLocaleString("es-CO")}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
      <form
        className="fila"
        style={{ gap: 8, flexWrap: "nowrap", padding: 12, borderTop: "1px solid var(--rule)" }}
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={placeholder}
          aria-label="Mensaje"
          disabled={enviando}
        />
        <Boton type="submit" variante="primario" icono={<Send size={16} strokeWidth={2} />} disabled={enviando || !texto.trim()} />
      </form>
    </Tarjeta>
  );
}
