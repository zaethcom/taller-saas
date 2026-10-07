"use client";

/**
 * Selector visual del patrón de desbloqueo Android: 3x3 puntos
 * numerados. Se dibuja arrastrando el dedo (o el mouse) sobre los
 * puntos, como en el teléfono, y la línea sigue el recorrido; tocar
 * los puntos uno por uno también sirve. El recorrido se guarda como
 * `valor.join("-")`, ej. "1-2-5-8-9".
 */
import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";

/** Puntos 1-9 en una grilla 3x3, numerados izquierda-derecha arriba-abajo. */
function posicion(n: number): [number, number] {
  const col = (n - 1) % 3;
  const fila = Math.floor((n - 1) / 3);
  return [40 + col * 80, 40 + fila * 80];
}

const PUNTOS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
/** Radio (en unidades del viewBox) dentro del cual el dedo "engancha" un punto. */
const RADIO_CAPTURA = 30;

/** Punto que queda a mitad de camino entre a y b (ej. 1→3 pasa por 2), como hace Android. */
function intermedio(a: number, b: number): number | null {
  const [x1, y1] = posicion(a);
  const [x2, y2] = posicion(b);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  return PUNTOS.find((n) => n !== a && n !== b && posicion(n)[0] === mx && posicion(n)[1] === my) ?? null;
}

export function PatronGrid({ valor, onChange }: { valor: number[]; onChange: (valor: number[]) => void }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const recorrido = useRef<number[]>(valor);
  const [arrastrando, setArrastrando] = useState(false);
  const [cursor, setCursor] = useState<[number, number] | null>(null);

  /** Coordenadas del puntero en unidades del viewBox (240x240 sin importar el tamaño en pantalla). */
  function coordenadas(e: React.PointerEvent): [number, number] | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * 240, ((e.clientY - r.top) / r.height) * 240];
  }

  function puntoEn([x, y]: [number, number]): number | null {
    return (
      PUNTOS.find((n) => {
        const [px, py] = posicion(n);
        return Math.hypot(px - x, py - y) <= RADIO_CAPTURA;
      }) ?? null
    );
  }

  function agregar(n: number) {
    const actual = recorrido.current;
    if (actual.includes(n)) return;
    const ultimo = actual[actual.length - 1];
    const medio = ultimo !== undefined ? intermedio(ultimo, n) : null;
    const nuevo = medio !== null && !actual.includes(medio) ? [...actual, medio, n] : [...actual, n];
    recorrido.current = nuevo;
    onChange(nuevo);
  }

  function alPresionar(e: React.PointerEvent<SVGSVGElement>) {
    const c = coordenadas(e);
    if (!c) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    // Cada trazo continúa el patrón existente, así tocar punto por punto
    // también funciona; "Reiniciar" lo borra para empezar de nuevo.
    const n = puntoEn(c);
    recorrido.current = valor;
    setArrastrando(true);
    setCursor(c);
    if (n !== null) agregar(n);
  }

  function alMover(e: React.PointerEvent<SVGSVGElement>) {
    if (!arrastrando) return;
    const c = coordenadas(e);
    if (!c) return;
    setCursor(c);
    const n = puntoEn(c);
    if (n !== null) agregar(n);
  }

  function alSoltar() {
    setArrastrando(false);
    setCursor(null);
  }

  const ultimo = valor[valor.length - 1];

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox="0 0 240 240"
        width={240}
        height={240}
        style={{ touchAction: "none", userSelect: "none", WebkitUserSelect: "none", maxWidth: "100%", cursor: "pointer" }}
        role="img"
        aria-label={valor.length ? `Patrón: ${valor.join("-")}` : "Patrón sin registrar"}
        onPointerDown={alPresionar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
      >
        <rect x={0} y={0} width={240} height={240} rx={12} fill="var(--surface-2)" opacity={0.4} />
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
              strokeWidth={5}
              strokeLinecap="round"
            />
          );
        })}
        {arrastrando && cursor && ultimo !== undefined && (
          <line
            x1={posicion(ultimo)[0]}
            y1={posicion(ultimo)[1]}
            x2={cursor[0]}
            y2={cursor[1]}
            stroke="var(--accent)"
            strokeWidth={5}
            strokeLinecap="round"
            opacity={0.5}
          />
        )}
        {PUNTOS.map((n) => {
          const [x, y] = posicion(n);
          const elegido = valor.includes(n);
          return (
            <g key={n} aria-label={`Punto ${n}`}>
              <circle cx={x} cy={y} r={20} fill={elegido ? "var(--accent)" : "var(--surface-2)"} stroke="var(--rule-fuerte)" />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14}
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
          {valor.length ? valor.join(" → ") : "Desliza el dedo por los puntos (o tócalos en orden)"}
        </span>
        {valor.length > 0 && (
          <button
            type="button"
            onClick={() => {
              recorrido.current = [];
              onChange([]);
            }}
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
