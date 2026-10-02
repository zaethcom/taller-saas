"use client";

/**
 * Selector visual del patrón de desbloqueo Android: 3x3 puntos
 * numerados, se tocan en orden (no se arrastra -- en una pantalla de
 * recepción con mouse o dedo, tocar en secuencia es más confiable que
 * rastrear un gesto continuo). El recorrido se guarda como
 * `valor.join("-")`, ej. "1-2-5-8-9".
 */
import { RotateCcw } from "lucide-react";

/** Puntos 1-9 en una grilla 3x3, numerados izquierda-derecha arriba-abajo. */
function posicion(n: number): [number, number] {
  const col = (n - 1) % 3;
  const fila = Math.floor((n - 1) / 3);
  return [30 + col * 70, 30 + fila * 70];
}

const PUNTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function PatronGrid({ valor, onChange }: { valor: number[]; onChange: (valor: number[]) => void }) {
  function tocar(n: number) {
    if (valor.includes(n)) return;
    onChange([...valor, n]);
  }

  return (
    <div>
      <svg
        viewBox="0 0 200 200"
        width={200}
        height={200}
        style={{ touchAction: "none", userSelect: "none" }}
        role="img"
        aria-label={valor.length ? `Patrón: ${valor.join("-")}` : "Patrón sin registrar"}
      >
        {valor.slice(1).map((n, i) => {
          const anterior = valor[i];
          if (anterior === undefined) return null;
          const [x1, y1] = posicion(anterior);
          const [x2, y2] = posicion(n);
          return (
            <line
              key={`${anterior}-${n}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--accent)"
              strokeWidth={4}
              strokeLinecap="round"
            />
          );
        })}
        {PUNTOS.map((n) => {
          const [x, y] = posicion(n);
          const elegido = valor.includes(n);
          return (
            <g
              key={n}
              onClick={() => tocar(n)}
              style={{ cursor: "pointer" }}
              role="button"
              aria-label={`Punto ${n}`}
            >
              <circle cx={x} cy={y} r={18} fill={elegido ? "var(--accent)" : "var(--surface-2)"} stroke="var(--rule-fuerte)" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={13}
                fontWeight={700}
                fill={elegido ? "var(--accent-texto)" : "var(--ink-2)"}
                style={{ pointerEvents: "none" }}
              >
                {n}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="fila" style={{ gap: 8, marginTop: 8, alignItems: "center" }}>
        <span className="cifra" style={{ fontSize: 13, color: "var(--ink-2)" }}>
          {valor.length ? valor.join(" → ") : "Toca los puntos en orden"}
        </span>
        {valor.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            aria-label="Reiniciar patrón"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              background: "none",
              border: "none",
              color: "var(--ink-3)",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
            }}
          >
            <RotateCcw size={13} strokeWidth={2} />
            Reiniciar
          </button>
        )}
      </div>
    </div>
  );
}
