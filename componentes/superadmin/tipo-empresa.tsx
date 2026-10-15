"use client";

/**
 * El tipo de una empresa visto desde su ficha del superadmin: cuál
 * tiene y el botón para asignarle otro (o volver a aplicar el mismo
 * después de editar el estándar). Asignar solo agrega fases y
 * categorías; nunca borra lo que la empresa ya tiene (0053).
 */
import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Campo, Aviso } from "@/componentes/ui/campo";
import { VentanaError } from "@/componentes/ui/ventana-error";

interface TipoResumen {
  id: string;
  nombre: string;
  activo: boolean;
}

export function TipoEmpresaFicha({
  empresaId,
  tipoActualId,
  alCambiar,
}: {
  empresaId: string;
  tipoActualId: string | null;
  alCambiar: () => void | Promise<void>;
}) {
  const [tipos, setTipos] = useState<TipoResumen[]>([]);
  const [elegido, setElegido] = useState(tipoActualId ?? "");
  const [aplicando, setAplicando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/superadmin/tipos")
      .then((r) => r.json())
      .then((data) => setTipos(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setElegido(tipoActualId ?? "");
  }, [tipoActualId]);

  const actual = tipos.find((t) => t.id === tipoActualId);

  async function aplicar() {
    setAplicando(true);
    setMensaje(null);
    setError(null);
    try {
      const res = await fetch(`/api/superadmin/empresas/${empresaId}/tipo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipoId: elegido }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo asignar el tipo");
      setMensaje(
        `Tipo asignado. Se agregaron ${data.fases} fase${data.fases === 1 ? "" : "s"} y ${data.categorias} categoría${
          data.categorias === 1 ? "" : "s"
        } que no tenía.`,
      );
      await alCambiar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo asignar el tipo");
    } finally {
      setAplicando(false);
    }
  }

  return (
    <Tarjeta>
      <h2 style={{ marginBottom: 6 }}>Tipo de empresa</h2>
      <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--ink-3)" }}>
        {actual ? (
          <>
            Hoy es <strong>{actual.nombre}</strong>.{" "}
          </>
        ) : (
          "Todavía no tiene tipo. "
        )}
        Asignar un tipo le carga sus fases de la orden, categorías y tipo de equipo por defecto. Solo agrega: no borra
        nada de lo que la empresa ya tiene.
      </p>
      <div className="fila" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Campo etiqueta="Tipo">
          <select value={elegido} onChange={(e) => setElegido(e.target.value)} style={{ minWidth: 200 }}>
            <option value="">Elegir…</option>
            {tipos
              .filter((t) => t.activo || t.id === tipoActualId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
          </select>
        </Campo>
        <Boton
          variante="primario"
          icono={<Layers size={16} strokeWidth={2.2} />}
          onClick={aplicar}
          disabled={!elegido || aplicando}
        >
          {aplicando ? "Aplicando…" : elegido && elegido === tipoActualId ? "Volver a aplicar" : "Asignar tipo"}
        </Boton>
      </div>
      {mensaje && (
        <div style={{ marginTop: 12 }}>
          <Aviso tono="ok">{mensaje}</Aviso>
        </div>
      )}
      <VentanaError mensaje={error} onCerrar={() => setError(null)} />
    </Tarjeta>
  );
}
