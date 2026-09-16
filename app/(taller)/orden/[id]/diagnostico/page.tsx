"use client";

/**
 * El técnico registra los hallazgos y arma la cotización -- repuestos
 * más mano de obra -- y la envía en un solo paso. Al enviar,
 * POST /api/ordenes/[id]/cotizacion mueve la orden a
 * esperando_aprobacion y devuelve el enlace de seguimiento para
 * mandarlo por WhatsApp. Fase 5 del plano de construcción.
 */
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Wrench, Plus, X, Send, Copy, Check, ArrowLeft } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Linea {
  descripcion: string;
  cantidad: number;
  precioUnit: number;
}

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

const LINEA_VACIA: Linea = { descripcion: "", cantidad: 1, precioUnit: 0 };

export default function PaginaDiagnostico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [nota, setNota] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([{ ...LINEA_VACIA }]);
  const [manoObra, setManoObra] = useState("0");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ total: number; urlSeguimiento: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const totalItems = lineas.reduce((s, l) => s + l.cantidad * l.precioUnit, 0);
  const total = totalItems + (Number(manoObra) || 0);

  function actualizarLinea(i: number, cambios: Partial<Linea>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, { ...LINEA_VACIA }]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      const items = lineas.filter((l) => l.descripcion.trim() && l.cantidad > 0);
      if (items.length === 0) throw new Error("Agrega al menos un repuesto o servicio con descripción.");

      const res = await fetch(`/api/ordenes/${id}/cotizacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, manoObra: Number(manoObra) || 0, nota: nota.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      const data = await res.json();
      setResultado({ total: data.total, urlSeguimiento: data.urlSeguimiento });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar la cotización");
    } finally {
      setEnviando(false);
    }
  }

  async function copiarEnlace() {
    if (!resultado) return;
    await navigator.clipboard.writeText(resultado.urlSeguimiento);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  }

  if (resultado) {
    return (
      <div className="pila">
        <Tarjeta style={{ textAlign: "center" }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 54,
              height: 54,
              borderRadius: "var(--r-lg)",
              background: "var(--ok-fondo)",
              color: "var(--ok)",
              marginBottom: 12,
            }}
          >
            <Check size={28} strokeWidth={2.4} />
          </span>
          <h1>Cotización enviada</h1>
          <p className="cifra" style={{ margin: "8px 0 0", fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
            {fmt(resultado.total)}
          </p>
        </Tarjeta>

        <Tarjeta>
          <div className="campo-etiqueta">
            Comparte este enlace con el cliente para que apruebe o rechace desde su celular
          </div>
          <div
            style={{
              padding: 12,
              borderRadius: "var(--r-md)",
              background: "var(--surface-2)",
              border: "1px solid var(--rule)",
              wordBreak: "break-all",
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {resultado.urlSeguimiento}
          </div>
          <div className="fila">
            <Boton
              variante="primario"
              icono={copiado ? <Check size={17} strokeWidth={2.4} /> : <Copy size={17} strokeWidth={2} />}
              onClick={copiarEnlace}
            >
              {copiado ? "¡Copiado!" : "Copiar enlace"}
            </Boton>
            <Boton
              variante="contorno"
              icono={<ArrowLeft size={17} strokeWidth={2} />}
              onClick={() => router.push(`/orden/${id}`)}
            >
              Volver a la orden
            </Boton>
          </div>
        </Tarjeta>
      </div>
    );
  }

  return (
    <div>
      <TituloPantalla
        icono={<Wrench size={24} strokeWidth={2} />}
        titulo="Diagnóstico y cotización"
        descripcion="Lo que encontraste y lo que cuesta arreglarlo."
      />

      <div className="pila">
        <Tarjeta>
          <Campo etiqueta="Hallazgos del diagnóstico" ayuda="El cliente no lo ve; queda en la orden para el historial del equipo.">
            <textarea
              placeholder="Hallazgos del diagnóstico…"
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              rows={3}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta>
          <h2 style={{ marginBottom: 12 }}>Repuestos y servicios</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {lineas.map((l, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 72px 110px 44px", gap: 8 }}>
                <input
                  placeholder="Descripción"
                  value={l.descripcion}
                  onChange={(e) => actualizarLinea(i, { descripcion: e.target.value })}
                  aria-label={`Descripción de la línea ${i + 1}`}
                />
                <input
                  type="number"
                  min={1}
                  value={l.cantidad}
                  onChange={(e) => actualizarLinea(i, { cantidad: Number(e.target.value) || 1 })}
                  aria-label={`Cantidad de la línea ${i + 1}`}
                  className="cifra"
                  style={{ textAlign: "center" }}
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Precio"
                  value={l.precioUnit || ""}
                  onChange={(e) => actualizarLinea(i, { precioUnit: Number(e.target.value) || 0 })}
                  aria-label={`Precio de la línea ${i + 1}`}
                  className="cifra"
                  style={{ textAlign: "right" }}
                />
                <Boton
                  variante="peligro"
                  icono={<X size={16} strokeWidth={2.4} />}
                  onClick={() => quitarLinea(i)}
                  disabled={lineas.length === 1}
                  aria-label={`Quitar la línea ${i + 1}`}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <Boton variante="fantasma" icono={<Plus size={17} strokeWidth={2.2} />} onClick={agregarLinea}>
              Agregar línea
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 160px", gap: 12, alignItems: "end" }}>
            <Campo etiqueta="Mano de obra" ayuda="Se suma al total, aparte de los repuestos.">
              <input
                type="number"
                min={0}
                value={manoObra}
                onChange={(e) => setManoObra(e.target.value)}
                className="cifra"
              />
            </Campo>
            <div style={{ textAlign: "right" }}>
              <div className="campo-etiqueta">Total</div>
              <div className="cifra" style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em" }}>
                {fmt(total)}
              </div>
            </div>
          </div>
        </Tarjeta>

        <Boton
          variante="primario"
          tamano="xl"
          ancho
          icono={<Send size={19} strokeWidth={2} />}
          onClick={enviar}
          disabled={enviando}
        >
          {enviando ? "Enviando…" : "Enviar cotización"}
        </Boton>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
