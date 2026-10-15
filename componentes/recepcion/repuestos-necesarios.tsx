"use client";

/**
 * Repuestos que ya se sabe que lleva el daño, desde el mostrador. Se
 * buscan en todo el catálogo (todas las categorías) con la existencia
 * de esta sede a la vista; lo que no aparece se agrega a Compras tal
 * cual se escribió. Lo que no alcanza entra solo a Compras, con el
 * número de la orden, al guardar la recepción (POST /api/ordenes, ver
 * lib/repuestos-recepcion.ts).
 */
import { useEffect, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { disponible } from "@/lib/reservas";

export interface RepuestoElegido {
  /** Clave local de la fila. */
  clave: string;
  repuestoId?: string;
  descripcion: string;
  cantidad: number;
  /** Existencia en la sede al momento de elegirlo; sin catálogo, 0. */
  existencia: number;
}

interface Resultado {
  id: string;
  codigo: string;
  descripcion: string;
  existenciaAqui: number;
  reservadoAqui?: number;
}

let siguienteClave = 0;
const nuevaClave = () => `r${++siguienteClave}`;

export function RepuestosNecesarios({
  repuestos,
  onChange,
}: {
  repuestos: RepuestoElegido[];
  onChange: (repuestos: RepuestoElegido[]) => void;
}) {
  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  // La búsqueda ya respondió para el texto actual (para decir "no está").
  const [buscado, setBuscado] = useState("");

  useEffect(() => {
    const texto = buscar.trim();
    if (texto.length < 2) {
      setResultados([]);
      return;
    }
    const controlador = new AbortController();
    const temporizador = setTimeout(() => {
      fetch(`/api/repuestos?buscar=${encodeURIComponent(texto)}`, { signal: controlador.signal })
        .then((r) => r.json())
        .then((data) => {
          setResultados(Array.isArray(data) ? data : []);
          setBuscado(texto);
        })
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(temporizador);
      controlador.abort();
    };
  }, [buscar]);

  function agregar(r: Omit<RepuestoElegido, "clave" | "cantidad">) {
    onChange([...repuestos, { ...r, clave: nuevaClave(), cantidad: 1 }]);
    setBuscar("");
    setResultados([]);
  }

  function cambiarCantidad(clave: string, cantidad: number) {
    onChange(repuestos.map((r) => (r.clave === clave ? { ...r, cantidad: Math.max(1, cantidad) } : r)));
  }

  return (
    <div>
      {repuestos.length > 0 && (
        <div className="pila" style={{ gap: 8, marginBottom: 12 }}>
          {repuestos.map((r) => {
            const alcanza = r.existencia >= r.cantidad;
            return (
              <div key={r.clave} className="fila" style={{ gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
                <span style={{ flex: 1, minWidth: 0 }}>{r.descripcion}</span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  className="cifra"
                  value={r.cantidad}
                  onChange={(e) => cambiarCantidad(r.clave, Number(e.target.value) || 1)}
                  aria-label={`Cantidad de ${r.descripcion}`}
                  style={{ width: 64 }}
                />
                {alcanza ? (
                  <Etiqueta tono="ok">Hay {r.existencia}</Etiqueta>
                ) : (
                  <Etiqueta tono="aviso">{r.repuestoId && r.existencia > 0 ? `Hay ${r.existencia} · a Compras` : "A Compras"}</Etiqueta>
                )}
                <Boton
                  tamano="sm"
                  variante="fantasma"
                  icono={<X size={16} strokeWidth={2} />}
                  onClick={() => onChange(repuestos.filter((x) => x.clave !== r.clave))}
                  aria-label={`Quitar ${r.descripcion}`}
                />
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative" }}>
        <div className="fila" style={{ gap: 8, flexWrap: "nowrap", alignItems: "center" }}>
          <input
            placeholder="Buscar repuesto, ej. pantalla A10"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            aria-label="Buscar repuesto necesario"
            style={{ flex: 1, minWidth: 0 }}
          />
          {/* Secundario: lo normal es elegir del catálogo, esto es para lo que no está. */}
          <Boton
            variante="contorno"
            tamano="sm"
            style={{ flexShrink: 0 }}
            aria-label="Agregar a Compras"
            icono={<Plus size={15} strokeWidth={2} />}
            disabled={!buscar.trim()}
            onClick={() => agregar({ descripcion: buscar.trim(), existencia: 0 })}
          >
            {/* En celular solo "+ Compras", para que el buscador tenga el ancho. */}
            <span className="ocultar-movil">Agregar a&nbsp;</span>Compras
          </Boton>
        </div>
        {buscado === buscar.trim() && buscado.length >= 2 && resultados.length === 0 && (
          <div style={{ marginTop: 8, fontSize: 13, color: "var(--ink-2)" }}>
            No está en el catálogo. Con el botón Compras se pide tal cual, con el número de esta orden.
          </div>
        )}
        {resultados.length > 0 && (
          <div className="pila" style={{ gap: 4, marginTop: 8 }}>
            {resultados.map((r) => {
              // Lo apartado para otras órdenes no está disponible.
              const libre = disponible(r.existenciaAqui, r.reservadoAqui ?? 0);
              return (
              <button
                key={r.id}
                type="button"
                className="fila"
                onClick={() => agregar({ repuestoId: r.id, descripcion: r.descripcion, existencia: libre })}
                style={{
                  gap: 8,
                  flexWrap: "nowrap",
                  justifyContent: "space-between",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--r-md)",
                  background: "var(--surface-2)",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <Search size={14} strokeWidth={2} color="var(--ink-3)" aria-hidden />
                  <span className="cifra" style={{ color: "var(--ink-3)" }}>
                    {r.codigo}
                  </span>
                  {r.descripcion}
                </span>
                <Etiqueta tono={libre > 0 ? "ok" : "aviso"}>{libre > 0 ? `Hay ${libre}` : "Agotado · a Compras"}</Etiqueta>
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
