"use client";

/**
 * Los últimos recibos de venta de la sede activa, en su propia pantalla
 * del POS (/recibos, debajo de Vender en el menú). Sirve para lo que
 * pasa en el mostrador justo después de cobrar: el cliente vuelve por el papel, o quien cobró quiere revisar
 * qué se le vendió. Cada fila se despliega para ver los items y tiene
 * su botón de reimprimir (POST /api/ventas/<id>/reimprimir, que no
 * toca inventario ni caja).
 */
import { useEffect, useState } from "react";
import { ChevronDown, Printer, Receipt } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";

interface Recibo {
  id: string;
  numero: number;
  total: number;
  tipo: string;
  creadaEn: string;
  medioPago: string | null;
  items: { descripcion: string; cantidad: number; precioUnit: number }[];
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

function hora(iso: string) {
  const d = new Date(iso);
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  const h = d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
  return mismoDia ? h : `${d.toLocaleDateString("es-CO", { day: "numeric", month: "short" })} ${h}`;
}

export function UltimosRecibos() {
  const [recibos, setRecibos] = useState<Recibo[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ id: string; texto: string } | null>(null);

  useEffect(() => {
    fetch("/api/ventas?limite=5")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setRecibos(Array.isArray(data) ? data : []))
      .catch(() => setRecibos([]));
  }, []);

  async function reimprimir(id: string) {
    try {
      const res = await fetch(`/api/ventas/${id}/reimprimir`, { method: "POST" });
      if (!res.ok) throw new Error();
      setAviso({ id, texto: "Reimprimiendo…" });
    } catch {
      setAviso({ id, texto: "No se pudo reimprimir" });
    }
  }

  return (
    <Tarjeta relleno={false} style={{ overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--rule)" }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 15 }}>
          <Receipt size={18} strokeWidth={2} color="var(--accent)" aria-hidden />
          Últimos recibos
        </h2>
      </div>

      {recibos === null ? null : recibos.length === 0 ? (
        <p style={{ margin: 0, padding: "16px", fontSize: 13, color: "var(--ink-3)" }}>
          Todavía no hay ventas en esta sede.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recibos.map((r) => {
            const estaAbierto = abierto === r.id;
            return (
              <div key={r.id} style={{ borderBottom: "1px solid var(--rule)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 16px" }}>
                  <button
                    type="button"
                    onClick={() => setAbierto(estaAbierto ? null : r.id)}
                    aria-expanded={estaAbierto}
                    aria-label={`Ver recibo #${r.numero}`}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      border: "none",
                      background: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      color: "inherit",
                    }}
                  >
                    <span className="cifra" style={{ fontSize: 13, fontWeight: 800 }}>
                      #{r.numero}
                    </span>
                    <span className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                      {hora(r.creadaEn)}
                    </span>
                    <span className="cifra" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 800 }}>
                      {fmt(r.total)}
                    </span>
                    <ChevronDown
                      size={15}
                      strokeWidth={2.2}
                      aria-hidden
                      style={{ flexShrink: 0, transform: estaAbierto ? "rotate(180deg)" : undefined }}
                    />
                  </button>
                  <Boton
                    variante="contorno"
                    tamano="sm"
                    icono={<Printer size={15} strokeWidth={2} />}
                    onClick={() => reimprimir(r.id)}
                    aria-label={`Reimprimir recibo #${r.numero}`}
                    title="Reimprimir recibo"
                  />
                </div>

                {aviso?.id === r.id && (
                  <p style={{ margin: 0, padding: "0 16px 8px", fontSize: 12, color: "var(--ink-2)" }}>{aviso.texto}</p>
                )}

                {estaAbierto && (
                  <div style={{ padding: "0 16px 10px", fontSize: 12, color: "var(--ink-2)" }}>
                    {r.items.map((i, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, padding: "2px 0" }}>
                        <span className="cifra" style={{ flexShrink: 0 }}>
                          {i.cantidad}×
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>{i.descripcion}</span>
                        <span className="cifra" style={{ flexShrink: 0 }}>
                          {fmt(i.cantidad * i.precioUnit)}
                        </span>
                      </div>
                    ))}
                    <div style={{ marginTop: 4, color: "var(--ink-3)" }}>
                      {r.tipo === "servicio" ? "Cobro de orden" : "Mostrador"}
                      {r.medioPago ? ` · ${r.medioPago}` : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Tarjeta>
  );
}
