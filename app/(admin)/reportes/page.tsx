/**
 * Las cuatro métricas de éxito del piloto -- Fase 8 del plano de
 * construcción. Tres se calculan de los datos reales; la cuarta
 * (tiempo de recepción) no tiene de dónde salir de la base: el plano
 * la describe como algo que se cronometra a mano durante el piloto,
 * no como un timestamp que el sistema capture solo. Se muestra como
 * instrucción, nunca como un número inventado.
 */
import { clienteServidor } from "@/lib/supabase/servidor";

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
      <h1>Reportes</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Las cuatro métricas de éxito del piloto, Fase 8 del plano de construcción.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase" }}>Tiempo de recepción</div>
          <div style={{ fontSize: 15, marginTop: 8 }}>
            Meta: menos de 3 minutos. No hay un timestamp de inicio/fin de la recepción en el
            sistema -- se mide con cronómetro, en persona, durante el piloto.
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase" }}>
            Evidencia completa (entrada + salida)
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
            {porcentajeEvidenciaCompleta === null ? "—" : `${porcentajeEvidenciaCompleta}%`}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {idsEntregadas.length === 0
              ? "Todavía no hay órdenes entregadas."
              : `de ${idsEntregadas.length} orden${idsEntregadas.length === 1 ? "" : "es"} entregada${idsEntregadas.length === 1 ? "" : "s"}`}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase" }}>
            Tiempo hasta aprobación
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
            {horasPromedioAprobacion === null ? "—" : fmtHoras(horasPromedioAprobacion)}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {cotizacionesAprobadas?.length
              ? `promedio de ${cotizacionesAprobadas.length} cotización${cotizacionesAprobadas.length === 1 ? "" : "es"} aprobada${cotizacionesAprobadas.length === 1 ? "" : "s"}`
              : "Todavía no hay cotizaciones aprobadas."}
          </div>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase" }}>
            Faltantes resueltos en menos de 48h
          </div>
          <div style={{ fontSize: 32, fontWeight: 700, marginTop: 8 }}>
            {porcentajeFaltantesA48h === null ? "—" : `${porcentajeFaltantesA48h}%`}
          </div>
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            {faltantesResueltos?.length
              ? `de ${faltantesResueltos.length} faltante${faltantesResueltos.length === 1 ? "" : "s"} resuelto${faltantesResueltos.length === 1 ? "" : "s"}`
              : "Todavía no hay faltantes marcados como recibidos."}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 18, marginTop: 32, marginBottom: 12 }}>Productividad por técnico</h2>
      {productividad.length === 0 ? (
        <p style={{ opacity: 0.6 }}>Todavía no hay técnicos registrados.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
              <th>Técnico</th>
              <th>Asignados</th>
              <th>Terminados</th>
              <th>En curso</th>
              <th>Tiempo promedio</th>
            </tr>
          </thead>
          <tbody>
            {productividad.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td>{p.codigo ? `${p.codigo} · ${p.nombre}` : p.nombre}</td>
                <td>{p.asignados}</td>
                <td>{p.terminados}</td>
                <td>{p.enCurso}</td>
                <td>{p.horasPromedio === null ? "—" : fmtHoras(p.horasPromedio)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
