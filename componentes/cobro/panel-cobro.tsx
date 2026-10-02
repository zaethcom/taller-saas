"use client";

/**
 * El bloque de cobro que ya tenía /vender (denominaciones + forma de
 * pago) más lo que faltaba: un campo editable para el monto recibido
 * (antes solo se podía armar tocando denominaciones) y el checkbox de
 * imprimir recibo. Compartido con /entregar para el cobro del saldo
 * de una orden -- mismo bloque, mismo comportamiento en las dos.
 */
import { Banknote, RotateCcw } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";

const DENOMINACIONES = [2000, 5000, 10000, 20000, 50000, 100000];

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

interface Metodo {
  id: string;
  nombre: string;
  es_efectivo?: boolean;
}

export function PanelCobro({
  total,
  metodos,
  metodoPagoId,
  onCambiarMetodo,
  montoRecibido,
  onCambiarMontoRecibido,
  imprimir,
  onCambiarImprimir,
}: {
  total: number;
  metodos: Metodo[];
  metodoPagoId: string;
  onCambiarMetodo: (id: string) => void;
  montoRecibido: number;
  onCambiarMontoRecibido: (monto: number) => void;
  imprimir: boolean;
  onCambiarImprimir: (imprimir: boolean) => void;
}) {
  const metodo = metodos.find((m) => m.id === metodoPagoId);
  const cambio = montoRecibido - total;

  return (
    <div className="pila" style={{ gap: 14 }}>
      {metodos.length > 0 && (
        <div>
          <div className="campo-etiqueta">Forma de pago</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(metodos.length, 3)}, minmax(0, 1fr))`, gap: 8 }}>
            {metodos.map((m) => (
              <Boton
                key={m.id}
                variante={metodoPagoId === m.id ? "primario" : "contorno"}
                onClick={() => onCambiarMetodo(m.id)}
                aria-pressed={metodoPagoId === m.id}
              >
                {m.nombre}
              </Boton>
            ))}
          </div>
        </div>
      )}

      {metodo?.es_efectivo && (
        <div>
          <div className="campo-etiqueta">
            <Banknote size={14} strokeWidth={2} style={{ verticalAlign: "-2px", marginRight: 5 }} aria-hidden />
            Efectivo recibido
          </div>
          <div className="fila" style={{ gap: 7, marginBottom: 10, alignItems: "center", flexWrap: "nowrap" }}>
            <input
              type="number"
              value={montoRecibido || ""}
              onChange={(e) => onCambiarMontoRecibido(Number(e.target.value) || 0)}
              placeholder="0"
              aria-label="Monto recibido"
              className="cifra"
              style={{ maxWidth: 160 }}
            />
            <Boton
              variante="fantasma"
              tamano="sm"
              icono={<RotateCcw size={14} strokeWidth={2} />}
              onClick={() => onCambiarMontoRecibido(0)}
            >
              Reiniciar
            </Boton>
          </div>
          <div className="fila" style={{ gap: 7, marginBottom: 10 }}>
            {DENOMINACIONES.map((d) => (
              <Boton key={d} variante="contorno" tamano="sm" onClick={() => onCambiarMontoRecibido(montoRecibido + d)}>
                <span className="cifra">{fmt(d)}</span>
              </Boton>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
            <span style={{ color: "var(--ink-2)" }}>Recibido</span>
            <span className="cifra" style={{ fontWeight: 700 }}>{fmt(montoRecibido)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, fontWeight: 800 }}>
            <span style={{ color: cambio < 0 ? "var(--peligro)" : "var(--ok)" }}>{cambio < 0 ? "Falta" : "Cambio"}</span>
            <span className="cifra" style={{ color: cambio < 0 ? "var(--peligro)" : "var(--ok)" }}>
              {fmt(Math.abs(cambio))}
            </span>
          </div>
        </div>
      )}

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
        <input type="checkbox" checked={imprimir} onChange={(e) => onCambiarImprimir(e.target.checked)} />
        Imprimir recibo
      </label>
    </div>
  );
}

export { fmt as formatearMoneda };
