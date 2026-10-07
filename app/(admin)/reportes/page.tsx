/**
 * Informes para el dueño del negocio: ventas (por fecha, vendedor,
 * producto, categoría, método de pago, sede, hora, tipo), caja,
 * inventario y taller. Cada uno con filtro de fechas y sede, y
 * descargable en Excel y PDF.
 *
 * Server Component sin estado en el cliente: los filtros viven en la
 * URL (un <form method="get">), así un informe se puede guardar en
 * favoritos o mandar por enlace tal cual se ve. El cálculo vive en
 * lib/reportes/ y es el mismo que usa la exportación.
 *
 * Las métricas del piloto (Fase 8) que antes eran toda esta pantalla
 * siguen aquí, como un informe más del grupo Taller.
 */
import Link from "next/link";
import { BarChart3, FileSpreadsheet, FileText } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { Aviso, Campo } from "@/componentes/ui/campo";
import { Boton } from "@/componentes/ui/boton";
import { GRUPOS, INFORMES } from "@/lib/reportes/catalogo";
import { hoyLocal, rangosRapidos } from "@/lib/reportes/fechas";
import { formatear } from "@/lib/reportes/formato";
import { generarInforme } from "@/lib/reportes/generar";
import { aQuery, leerParametros } from "@/lib/reportes/parametros";
import type { Formato, Informe, Tabla } from "@/lib/reportes/tipos";

const NUMERICOS: Formato[] = ["moneda", "numero", "porcentaje", "horas"];

function TablaInforme({ tabla }: { tabla: Tabla }) {
  const maximo = tabla.barra ? Math.max(0, ...tabla.filas.map((f) => Number(f[tabla.barra!] ?? 0))) : 0;
  const alinear = (formato: Formato) => (NUMERICOS.includes(formato) ? ("right" as const) : undefined);

  return (
    <div style={{ marginTop: 18 }}>
      {tabla.titulo && <h3 style={{ margin: "0 0 10px", fontSize: 15 }}>{tabla.titulo}</h3>}
      {tabla.filas.length === 0 ? (
        <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
          No hay datos en este periodo.
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                {tabla.columnas.map((c) => (
                  <th key={c.clave} style={{ textAlign: alinear(c.formato) }}>
                    {c.titulo}
                  </th>
                ))}
                {tabla.barra && <th aria-hidden style={{ width: "22%" }} />}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((f, i) => (
                <tr key={i}>
                  {tabla.columnas.map((c, j) => (
                    <td
                      key={c.clave}
                      className={NUMERICOS.includes(c.formato) ? "cifra" : undefined}
                      style={{ textAlign: alinear(c.formato), fontWeight: j === 0 ? 600 : undefined, whiteSpace: c.formato === "texto" ? undefined : "nowrap" }}
                    >
                      {formatear(f[c.clave] ?? null, c.formato)}
                    </td>
                  ))}
                  {tabla.barra && (
                    <td aria-hidden>
                      <div style={{ height: 8, borderRadius: 4, background: "var(--surface-2)" }}>
                        <div
                          style={{
                            height: 8,
                            borderRadius: 4,
                            background: "var(--accent)",
                            width: `${maximo > 0 ? Math.max(0, (Number(f[tabla.barra] ?? 0) / maximo) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {tabla.totales && (
              <tfoot>
                <tr>
                  {tabla.columnas.map((c) => (
                    <td
                      key={c.clave}
                      className={NUMERICOS.includes(c.formato) ? "cifra" : undefined}
                      style={{ textAlign: alinear(c.formato), fontWeight: 800, borderTop: "2px solid var(--rule-fuerte)", whiteSpace: "nowrap" }}
                    >
                      {tabla.totales![c.clave] == null ? "" : formatear(tabla.totales![c.clave] ?? null, c.formato)}
                    </td>
                  ))}
                  {tabla.barra && <td style={{ borderTop: "2px solid var(--rule-fuerte)" }} />}
                </tr>
              </tfoot>
            )}
          </table>
        </TarjetaTabla>
      )}
    </div>
  );
}

function VistaInforme({ informe }: { informe: Informe }) {
  return (
    <div>
      {informe.resumen.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
          {informe.resumen.map((c) => (
            <Tarjeta key={c.rotulo}>
              <div className="campo-etiqueta" style={{ letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 11 }}>
                {c.rotulo}
              </div>
              <div className="cifra" style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                {formatear(c.valor, c.formato)}
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
      {informe.tablas.map((t, i) => (
        <TablaInforme key={i} tabla={t} />
      ))}
      {informe.notas.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
          {informe.notas.map((n) => (
            <p key={n} style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)" }}>
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export default async function PaginaReportes({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil || !puede(perfil.rol, "ver_reportes")) {
    return <Aviso tono="peligro">Los reportes son solo para administradores.</Aviso>;
  }

  const { def, filtro, sedeNombre } = leerParametros(await searchParams, perfil.sedesPermitidas);

  let informe: Informe | null = null;
  let error: string | null = null;
  try {
    informe = await generarInforme(supabase, def.id, filtro);
  } catch (e) {
    error = e instanceof Error ? e.message : "error desconocido";
  }

  const hoy = hoyLocal();
  const exportar = (formato: "xlsx" | "pdf") => `/api/reportes/exportar?${aQuery(def, filtro, { formato })}`;
  const verSedes = def.usaSede && perfil.sedesPermitidas.length > 1;

  return (
    <div>
      <TituloPantalla
        icono={<BarChart3 size={24} strokeWidth={2} />}
        titulo="Reportes"
        descripcion="Ventas, caja, inventario y taller, con filtro de fechas y sede. Descargables en Excel y PDF."
        acciones={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a className="btn btn-contorno" href={exportar("xlsx")} download>
              <FileSpreadsheet size={18} strokeWidth={2} />
              Excel
            </a>
            <a className="btn btn-contorno" href={exportar("pdf")} download>
              <FileText size={18} strokeWidth={2} />
              PDF
            </a>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
        <nav aria-label="Informes" style={{ flex: "1 1 210px", maxWidth: 260, display: "grid", gap: 14 }}>
          {GRUPOS.map((g) => (
            <div key={g}>
              <div className="campo-etiqueta" style={{ letterSpacing: "0.08em", textTransform: "uppercase", fontSize: 11, marginBottom: 6 }}>
                {g}
              </div>
              <div style={{ display: "grid", gap: 2 }}>
                {INFORMES.filter((i) => i.grupo === g).map((i) => {
                  const activo = i.id === def.id;
                  return (
                    <Link
                      key={i.id}
                      href={`/reportes?${aQuery(i, filtro)}`}
                      aria-current={activo ? "page" : undefined}
                      style={{
                        display: "block",
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 14,
                        textDecoration: "none",
                        color: activo ? "var(--accent-texto)" : "var(--ink)",
                        background: activo ? "var(--accent)" : "transparent",
                        fontWeight: activo ? 700 : 500,
                      }}
                    >
                      {i.nombre}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <section style={{ flex: "999 1 560px", minWidth: 0 }}>
          <h2 style={{ margin: "0 0 4px" }}>{def.nombre}</h2>
          <p style={{ margin: "0 0 14px", color: "var(--ink-2)", fontSize: 14 }}>{def.descripcion}</p>

          {(def.usaFechas || verSedes) && (
            <Tarjeta style={{ marginBottom: 16 }}>
              <form method="get" action="/reportes" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
                <input type="hidden" name="informe" value={def.id} />
                {def.usaFechas ? (
                  <>
                    <div style={{ flex: "1 1 140px" }}>
                      <Campo etiqueta="Desde">
                        <input type="date" name="desde" defaultValue={filtro.desde} max={hoy} />
                      </Campo>
                    </div>
                    <div style={{ flex: "1 1 140px" }}>
                      <Campo etiqueta="Hasta">
                        <input type="date" name="hasta" defaultValue={filtro.hasta} />
                      </Campo>
                    </div>
                  </>
                ) : (
                  <>
                    <input type="hidden" name="desde" value={filtro.desde} />
                    <input type="hidden" name="hasta" value={filtro.hasta} />
                  </>
                )}
                {verSedes ? (
                  <div style={{ flex: "1 1 160px" }}>
                    <Campo etiqueta="Sede">
                      <select name="sede" defaultValue={filtro.sedeId ?? ""}>
                        <option value="">Todas las sedes</option>
                        {perfil.sedesPermitidas.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                  </div>
                ) : (
                  filtro.sedeId && <input type="hidden" name="sede" value={filtro.sedeId} />
                )}
                {def.id === "ventas-fecha" ? (
                  <div style={{ flex: "1 1 120px" }}>
                    <Campo etiqueta="Agrupar por">
                      <select name="agrupar" defaultValue={filtro.agrupar}>
                        <option value="dia">Día</option>
                        <option value="semana">Semana</option>
                        <option value="mes">Mes</option>
                      </select>
                    </Campo>
                  </div>
                ) : (
                  <input type="hidden" name="agrupar" value={filtro.agrupar} />
                )}
                <Boton type="submit" variante="primario">
                  Ver informe
                </Boton>
              </form>

              {def.usaFechas && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
                  {rangosRapidos(hoy).map((r) => {
                    const activo = r.desde === filtro.desde && r.hasta === filtro.hasta;
                    return (
                      <Link
                        key={r.etiqueta}
                        href={`/reportes?${aQuery(def, { ...filtro, desde: r.desde, hasta: r.hasta })}`}
                        className={`pastilla${activo ? " pastilla-activa" : ""}`}
                        style={{ height: 30, padding: "0 12px", fontSize: 13 }}
                      >
                        {r.etiqueta}
                      </Link>
                    );
                  })}
                </div>
              )}
            </Tarjeta>
          )}

          <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--ink-3)" }}>
            {[
              def.usaFechas ? `Del ${formatear(filtro.desde, "fecha")} al ${formatear(filtro.hasta, "fecha")}` : "A hoy",
              def.usaSede ? sedeNombre : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {error ? (
            <Aviso tono="peligro">No se pudo generar el informe: {error}</Aviso>
          ) : (
            informe && <VistaInforme informe={informe} />
          )}
        </section>
      </div>
    </div>
  );
}
