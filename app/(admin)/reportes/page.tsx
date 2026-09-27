/**
 * Las cuatro métricas de éxito del piloto -- Fase 8 del plano de
 * construcción. Tres se calculan de los datos reales; la cuarta
 * (tiempo de recepción) no tiene de dónde salir de la base: el plano
 * la describe como algo que se cronometra a mano durante el piloto,
 * no como un timestamp que el sistema capture solo. Se muestra como
 * instrucción, nunca como un número inventado.
 *
 * Por eso esa tarjeta no lleva cifra grande: una casilla vacía donde
 * las otras tres muestran un número se lee como "todavía no hay
 * datos", y no es eso -- es que ese dato no existe en el sistema.
 */
import { BarChart3, Timer } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

/** Una métrica: rótulo arriba, cifra grande, y de qué sale abajo. */
function Metrica({ rotulo, valor, pie }: { rotulo: string; valor: string; pie: string }) {
  return (
    <Tarjeta>
      <div className="campo-etiqueta" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {rotulo}
      </div>
      <div className="cifra" style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.025em", lineHeight: 1.1 }}>
        {valor}
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-2)" }}>{pie}</div>
    </Tarjeta>
  );
}

const HORAS = (ms: number) => ms / 1000 / 60 / 60;

function fmtHoras(horas: number): string {
  if (horas < 1) return `${Math.round(horas * 60)} min`;
  if (horas < 48) return `${horas.toFixed(1)} h`;
  return `${(horas / 24).toFixed(1)} días`;
}

export default async function PaginaReportes() {
  const supabase = await clienteServidor();

  // ── Métrica: % de órdenes entregadas con evidencia de entrada Y salida ──
  const { data: entregadas } = await supabase
    .from("orden")
    .select("id")
    .eq("estado", "entregada");

  const idsEntregadas = (entregadas ?? []).map((o) => o.id);
  let porcentajeEvidenciaCompleta: number | null = null;

  if (idsEntregadas.length > 0) {
    const { data: evidencias } = await supabase
      .from("evidencia")
      .select("orden_id, fase")
      .in("orden_id", idsEntregadas)
      .not("fase", "is", null);

    const porOrden = new Map<string, Set<string>>();
    for (const ev of evidencias ?? []) {
      if (!porOrden.has(ev.orden_id)) porOrden.set(ev.orden_id, new Set());
      porOrden.get(ev.orden_id)!.add(ev.fase as string);
    }
    const completas = idsEntregadas.filter((id) => {
      const fases = porOrden.get(id);
      return fases?.has("entrada") && fases?.has("salida");
    }).length;

    porcentajeEvidenciaCompleta = Math.round((completas / idsEntregadas.length) * 100);
  }

  // ── Métrica: tiempo promedio de cotización enviada -> aprobada ──
  const { data: cotizacionesAprobadas } = await supabase
    .from("cotizacion")
    .select("enviada_en, decidida_en")
    .eq("decision", "aprobada")
    .not("enviada_en", "is", null)
    .not("decidida_en", "is", null);

  let horasPromedioAprobacion: number | null = null;
  if (cotizacionesAprobadas && cotizacionesAprobadas.length > 0) {
    const totalHoras = cotizacionesAprobadas.reduce((suma, c) => {
      const ms = new Date(c.decidida_en!).getTime() - new Date(c.enviada_en!).getTime();
      return suma + HORAS(ms);
    }, 0);
    horasPromedioAprobacion = totalHoras / cotizacionesAprobadas.length;
  }

  // ── Métrica: % de faltantes resueltos en menos de 48 horas ──
  const { data: faltantesResueltos } = await supabase
    .from("repuesto_solicitud")
    .select("creada_en, recibido_en")
    .eq("estado", "recibido")
    .not("recibido_en", "is", null);

  let porcentajeFaltantesA48h: number | null = null;
  if (faltantesResueltos && faltantesResueltos.length > 0) {
    const dentroDe48h = faltantesResueltos.filter((f) => {
      const horas = HORAS(new Date(f.recibido_en!).getTime() - new Date(f.creada_en).getTime());
      return horas <= 48;
    }).length;
    porcentajeFaltantesA48h = Math.round((dentroDe48h / faltantesResueltos.length) * 100);
  }

  // ── Productividad por técnico -- sección 5 del pedido de expansión:
  // cuántos equipos recibió cada uno, cuántos terminó, y en cuánto
  // tiempo. tecnico_id se autoasigna al mover una orden a
  // en_diagnostico (POST /api/ordenes/[id]/transicion) -- antes de eso
  // no había ningún código que lo asignara, así que esta tabla
  // simplemente no tenía de dónde salir.
  const { data: tecnicos } = await supabase.from("perfil").select("id, nombre, codigo").eq("rol", "tecnico");

  const { data: ordenesAsignadas } = await supabase
    .from("orden")
    .select("tecnico_id, estado, abierta_en, cerrada_en")
    .not("tecnico_id", "is", null);

  const productividad = (tecnicos ?? []).map((t) => {
    const propias = (ordenesAsignadas ?? []).filter((o) => o.tecnico_id === t.id);
    const terminadas = propias.filter((o) => o.estado === "entregada" && o.cerrada_en);
    const horasPromedio =
      terminadas.length > 0
        ? terminadas.reduce((s, o) => s + HORAS(new Date(o.cerrada_en!).getTime() - new Date(o.abierta_en).getTime()), 0) /
          terminadas.length
        : null;

    return {
      id: t.id,
      nombre: t.nombre,
      codigo: t.codigo,
      asignados: propias.length,
      terminados: terminadas.length,
      enCurso: propias.length - terminadas.length,
      horasPromedio,
    };
  });

  return (
    <div>
      <TituloPantalla
        icono={<BarChart3 size={24} strokeWidth={2} />}
        titulo="Reportes"
        descripcion="Las cuatro métricas de éxito del piloto, Fase 8 del plano de construcción."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 }}>
        <Tarjeta>
          <div className="campo-etiqueta" style={{ letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Tiempo de recepción
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginTop: 4 }}>
            <Timer size={22} strokeWidth={1.9} color="var(--ink-3)" aria-hidden style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: 14, lineHeight: 1.45, color: "var(--ink-2)" }}>
              Meta: menos de 3 minutos. No hay un timestamp de inicio/fin de la recepción en el sistema --
              se mide con cronómetro, en persona, durante el piloto.
            </div>
          </div>
        </Tarjeta>

        <Metrica
          rotulo="Evidencia completa (entrada + salida)"
          valor={porcentajeEvidenciaCompleta === null ? "—" : `${porcentajeEvidenciaCompleta}%`}
          pie={
            idsEntregadas.length === 0
              ? "Todavía no hay órdenes entregadas."
              : `de ${idsEntregadas.length} orden${idsEntregadas.length === 1 ? "" : "es"} entregada${idsEntregadas.length === 1 ? "" : "s"}`
          }
        />

        <Metrica
          rotulo="Tiempo hasta aprobación"
          valor={horasPromedioAprobacion === null ? "—" : fmtHoras(horasPromedioAprobacion)}
          pie={
            cotizacionesAprobadas?.length
              ? `promedio de ${cotizacionesAprobadas.length} cotización${cotizacionesAprobadas.length === 1 ? "" : "es"} aprobada${cotizacionesAprobadas.length === 1 ? "" : "s"}`
              : "Todavía no hay cotizaciones aprobadas."
          }
        />

        <Metrica
          rotulo="Faltantes resueltos en menos de 48h"
          valor={porcentajeFaltantesA48h === null ? "—" : `${porcentajeFaltantesA48h}%`}
          pie={
            faltantesResueltos?.length
              ? `de ${faltantesResueltos.length} faltante${faltantesResueltos.length === 1 ? "" : "s"} resuelto${faltantesResueltos.length === 1 ? "" : "s"}`
              : "Todavía no hay faltantes marcados como recibidos."
          }
        />
      </div>

      <h2 style={{ marginTop: 32, marginBottom: 12 }}>Productividad por técnico</h2>
      {productividad.length === 0 ? (
        <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          Todavía no hay técnicos registrados.
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Técnico</th>
                <th>Asignados</th>
                <th>Terminados</th>
                <th>En curso</th>
                <th>Tiempo promedio</th>
              </tr>
            </thead>
            <tbody>
              {productividad.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>
                    {p.codigo ? (
                      <>
                        <span className="cifra" style={{ color: "var(--ink-3)" }}>
                          {p.codigo}
                        </span>{" "}
                        · {p.nombre}
                      </>
                    ) : (
                      p.nombre
                    )}
                  </td>
                  <td className="cifra">{p.asignados}</td>
                  <td className="cifra">{p.terminados}</td>
                  <td className="cifra">{p.enCurso}</td>
                  <td className="cifra">{p.horasPromedio === null ? "—" : fmtHoras(p.horasPromedio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}
