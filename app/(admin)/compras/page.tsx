"use client";

/**
 * La lista central de faltantes de la sección 4 del documento original:
 * qué repuesto hace falta, para qué orden, y con qué prioridad. Marcar
 * recibido es lo que cierra el ciclo: el técnico ya puede volver a
 * consumir ese repuesto desde /orden/[id]/repuestos si vuelve a entrar
 * al inventario (registrarlo en existencia es una acción manual de
 * /inventario, deliberadamente separada de esto -- llegar y consumir
 * son dos hechos distintos en el tiempo).
 */
import { useEffect, useState } from "react";
import { ShoppingBag, PackageCheck } from "lucide-react";
import { clienteNavegador } from "@/lib/supabase/cliente";
import { Boton } from "@/componentes/ui/boton";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

interface Faltante {
  id: string;
  descripcion: string;
  cantidad: number;
  prioridad: string;
  estado: string;
  creada_en: string;
  orden: { numero: number } | { numero: number }[] | null;
}

/** Urgente grita, normal no: si todo se ve igual, nada se atiende primero. */
const TONO_PRIORIDAD: Record<string, TonoEtiqueta> = {
  urgente: "peligro",
  alta: "aviso",
  normal: "neutro",
};

export default function PaginaCompras() {
  const [faltantes, setFaltantes] = useState<Faltante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState<string | null>(null);

  async function cargar() {
    setCargando(true);
    const supabase = clienteNavegador();
    const { data } = await supabase
      .from("repuesto_solicitud")
      .select("id, descripcion, cantidad, prioridad, estado, creada_en, orden:orden_id ( numero )")
      .neq("estado", "consumido")
      .order("creada_en", { ascending: true });
    setFaltantes((data as Faltante[]) ?? []);
    setCargando(false);
  }

  useEffect(() => {
    cargar();
  }, []);

  async function marcarRecibido(id: string) {
    setProcesando(id);
    try {
      const res = await fetch(`/api/repuesto-solicitud/${id}/recibir`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      await cargar();
    } catch {
      // El estado no cambió; el usuario ve la fila igual y puede reintentar.
    } finally {
      setProcesando(null);
    }
  }

  function numeroOrden(orden: Faltante["orden"]) {
    if (!orden) return "—";
    return Array.isArray(orden) ? orden[0]?.numero : orden.numero;
  }

  if (cargando) {
    return <Tarjeta style={{ textAlign: "center", color: "var(--ink-3)" }}>Cargando…</Tarjeta>;
  }

  return (
    <div>
      <TituloPantalla
        icono={<ShoppingBag size={24} strokeWidth={2} />}
        titulo="Compras"
        descripcion="Lo que el taller pidió y todavía no llega, en orden de antigüedad."
      />

      {faltantes.length === 0 ? (
        <Tarjeta style={{ textAlign: "center", padding: 36, borderStyle: "dashed" }}>
          <PackageCheck size={30} strokeWidth={1.6} color="var(--ok)" aria-hidden />
          <p style={{ margin: "10px 0 0", fontWeight: 700 }}>No hay faltantes pendientes</p>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
            Aparecen aquí solos cuando un técnico marca un repuesto como faltante.
          </p>
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Repuesto</th>
                <th>Orden</th>
                <th>Cantidad</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Desde</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {faltantes.map((f) => (
                <tr key={f.id}>
                  <td style={{ fontWeight: 600 }}>{f.descripcion}</td>
                  <td className="cifra">#{numeroOrden(f.orden)}</td>
                  <td className="cifra">{f.cantidad}</td>
                  <td>
                    <Etiqueta tono={TONO_PRIORIDAD[f.prioridad] ?? "neutro"} punto>
                      <span style={{ textTransform: "capitalize" }}>{f.prioridad}</span>
                    </Etiqueta>
                  </td>
                  <td>
                    <Etiqueta tono={f.estado === "faltante" ? "aviso" : "info"}>
                      <span style={{ textTransform: "capitalize" }}>{f.estado}</span>
                    </Etiqueta>
                  </td>
                  <td className="cifra" style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                    {new Date(f.creada_en).toLocaleDateString("es-CO")}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {f.estado === "faltante" && (
                      <Boton
                        variante="primario"
                        tamano="sm"
                        icono={<PackageCheck size={15} strokeWidth={2} />}
                        onClick={() => marcarRecibido(f.id)}
                        disabled={procesando === f.id}
                      >
                        Marcar recibido
                      </Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
