"use client";

/**
 * El diagnóstico, como paso propio: qué se encontró y qué se propone
 * hacer, antes de armar la cotización (punto 3 del documento de
 * trazabilidad del taller). Antes esta pantalla también construía la
 * cotización en el mismo formulario -- eso se movió a /cotizacion, que
 * es donde de verdad se transiciona la orden a esperando_aprobacion.
 *
 * "Continuar a cotización" guarda el diagnóstico y navega -- no cambia
 * el estado de la orden todavía; eso sigue pasando solo al enviar la
 * cotización, como antes.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Wrench, ArrowRight } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Diagnostico {
  hallazgos: string;
  fallas: string;
  observaciones: string;
  recomendaciones: string;
}

const VACIO: Diagnostico = { hallazgos: "", fallas: "", observaciones: "", recomendaciones: "" };

export default function PaginaDiagnostico() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [datos, setDatos] = useState<Diagnostico>(VACIO);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ordenes/${id}/diagnostico`)
      .then((r) => r.json())
      .then((data: Partial<Diagnostico> | null) => {
        if (data) {
          setDatos({
            hallazgos: data.hallazgos ?? "",
            fallas: data.fallas ?? "",
            observaciones: data.observaciones ?? "",
            recomendaciones: data.recomendaciones ?? "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [id]);

  async function guardar(): Promise<boolean> {
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch(`/api/ordenes/${id}/diagnostico`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datos),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el diagnóstico");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function continuar() {
    if (!datos.hallazgos.trim()) {
      setError("Registra al menos los hallazgos del diagnóstico.");
      return;
    }
    if (await guardar()) {
      router.push(`/orden/${id}/cotizacion`);
    }
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<Wrench size={24} strokeWidth={2} />}
        titulo="Diagnóstico"
        descripcion="Qué tiene el equipo y qué se propone hacer."
      />

      <div className="pila">
        <Tarjeta>
          <Campo etiqueta="Diagnóstico técnico" ayuda="Qué se encontró al revisar el equipo.">
            <textarea
              placeholder="Ej. Pastillas de freno delanteras desgastadas por completo…"
              value={datos.hallazgos}
              onChange={(e) => setDatos({ ...datos, hallazgos: e.target.value })}
              rows={3}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta>
          <Campo etiqueta="Fallas encontradas" ayuda="Opcional. Lista de fallas puntuales, si aplica.">
            <textarea
              placeholder="Ej. Ruido en el motor, batería no carga al 100%…"
              value={datos.fallas}
              onChange={(e) => setDatos({ ...datos, fallas: e.target.value })}
              rows={3}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta>
          <Campo etiqueta="Observaciones" ayuda="Opcional. El cliente no las ve; quedan en el historial del equipo.">
            <textarea
              placeholder="Ej. Equipo con golpes previos en el chasis…"
              value={datos.observaciones}
              onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })}
              rows={3}
            />
          </Campo>
        </Tarjeta>

        <Tarjeta>
          <Campo etiqueta="Recomendaciones" ayuda="Opcional. Qué se le sugiere al cliente además de la reparación.">
            <textarea
              placeholder="Ej. Cambiar también el cable de freno trasero antes de que falle…"
              value={datos.recomendaciones}
              onChange={(e) => setDatos({ ...datos, recomendaciones: e.target.value })}
              rows={2}
            />
          </Campo>
        </Tarjeta>

        <div className="fila">
          <Boton variante="contorno" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar borrador"}
          </Boton>
          <Boton
            variante="primario"
            tamano="lg"
            icono={<ArrowRight size={19} strokeWidth={2} />}
            onClick={continuar}
            disabled={guardando}
          >
            Continuar a cotización
          </Boton>
        </div>

        {error && <Aviso tono="peligro">{error}</Aviso>}
      </div>
    </div>
  );
}
