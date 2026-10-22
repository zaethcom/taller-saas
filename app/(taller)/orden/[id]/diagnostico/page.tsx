"use client";

/**
 * El diagnóstico, como paso propio: qué se encontró y qué se propone
 * hacer, antes de armar la cotización (punto 3 del documento de
 * trazabilidad del taller). Antes esta pantalla también construía la
 * cotización en el mismo formulario -- eso se movió a /cotizacion, que
 * es donde de verdad se transiciona la orden a esperando_cliente.
 *
 * "Continuar a cotización" guarda el diagnóstico y navega -- no cambia
 * el estado de la orden todavía; eso sigue pasando solo al enviar la
 * cotización, como antes.
 */
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo } from "@/componentes/ui/campo";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { CabeceraOrden } from "@/componentes/taller/cabecera-orden";
import { AreaDictado } from "@/componentes/ui/area-dictado";
import { VentanaError } from "@/componentes/ui/ventana-error";

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
      setError("Escribe qué tiene el equipo y qué se propone.");
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
      <CabeceraOrden ordenId={id} anterior={{ href: `/orden/${id}`, etiqueta: "Orden" }} />

      <TituloPantalla titulo="Diagnóstico" />

      <div className="pila">
        <Tarjeta>
          <Campo etiqueta="Qué tiene y qué se propone">
            <AreaDictado
              placeholder="Ej. Pastillas de freno delanteras desgastadas por completo…"
              value={datos.hallazgos}
              onChange={(v) => setDatos((d) => ({ ...d, hallazgos: v }))}
              rows={4}
            />
          </Campo>
        </Tarjeta>

        {/* Abierto si ya tiene algo escrito, para no esconder lo guardado. */}
        <details className="mas-opciones" open={Boolean(datos.fallas || datos.observaciones || datos.recomendaciones)}>
          <summary>Más detalles: fallas, observaciones y recomendaciones</summary>
          <div className="pila" style={{ gap: 14, marginTop: 12 }}>
            <Campo etiqueta="Fallas encontradas">
              <AreaDictado
                placeholder="Ej. Ruido en el motor, batería no carga al 100%…"
                value={datos.fallas}
                onChange={(v) => setDatos((d) => ({ ...d, fallas: v }))}
                rows={2}
              />
            </Campo>
            <Campo etiqueta="Observaciones" ayuda="El cliente no las ve.">
              <AreaDictado
                placeholder="Ej. Equipo con golpes previos en el chasis…"
                value={datos.observaciones}
                onChange={(v) => setDatos((d) => ({ ...d, observaciones: v }))}
                rows={2}
              />
            </Campo>
            <Campo etiqueta="Recomendaciones">
              <AreaDictado
                placeholder="Ej. Cambiar también el cable de freno trasero antes de que falle…"
                value={datos.recomendaciones}
                onChange={(v) => setDatos((d) => ({ ...d, recomendaciones: v }))}
                rows={2}
              />
            </Campo>
          </div>
        </details>

        <div className="barra-acciones">
          <Boton variante="contorno" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar borrador"}
          </Boton>
          <Boton
            variante="primario"
            icono={<ArrowRight size={18} strokeWidth={2} />}
            onClick={continuar}
            disabled={guardando}
          >
            Continuar a cotización
          </Boton>
        </div>

        <VentanaError mensaje={error} onCerrar={() => setError(null)} />
      </div>
    </div>
  );
}
