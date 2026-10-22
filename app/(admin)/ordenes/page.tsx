/**
 * El tablero de todas las órdenes de la empresa. Server Component: la
 * consulta corre en el servidor con la sesión del usuario, así que RLS
 * filtra por empresa_actual() sin que esta página tenga que acordarse
 * de agregar un .eq("empresa_id", ...) en ningún lado.
 *
 * Arriba, pastillas para filtrar por los estados de lib/estados.ts (En
 * el taller, Falta repuesto, Esperando al cliente, Listas, Entregadas,
 * Todas), cada una con su conteo, y un buscador. Editar los datos de una orden se
 * hace desde su ficha (menú "Más"), no desde aquí.
 */
import Link from "next/link";
import { ClipboardList, Inbox, Search } from "lucide-react";
import { ENTREGA_DESDE_TALLER, type Estado } from "@/lib/estados";
import { clienteServidor } from "@/lib/supabase/servidor";
import { Tarjeta, TarjetaTabla } from "@/componentes/ui/tarjeta";
import { EstadoOrden } from "@/componentes/ui/estado-orden";
import { Aviso } from "@/componentes/ui/campo";
import { Boton, BotonEnlace } from "@/componentes/ui/boton";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";

/** Cada pastilla y los estados que muestra; "todas" no filtra. */
const FILTROS = [
  { valor: "activas", etiqueta: "En el taller", estados: ["en_proceso", "falta_repuesto", "esperando_cliente"] },
  { valor: "falta", etiqueta: "Falta repuesto", estados: ["falta_repuesto"] },
  { valor: "cliente", etiqueta: "Esperando al cliente", estados: ["esperando_cliente"] },
  { valor: "listas", etiqueta: "Listas", estados: ENTREGA_DESDE_TALLER },
  { valor: "entregadas", etiqueta: "Entregadas", estados: ["entregada"] },
  { valor: "todas", etiqueta: "Todas", estados: null },
] as const satisfies readonly { valor: string; etiqueta: string; estados: readonly Estado[] | null }[];
type Filtro = (typeof FILTROS)[number]["valor"];
/** Los que llevan conteo: lo que el taller tiene entre manos. */
const CON_CONTEO: Filtro[] = ["activas", "falta", "cliente", "listas"];
const estadosDe = (f: Filtro) => FILTROS.find((x) => x.valor === f)!.estados as readonly Estado[] | null;

const normal = (t: string | null | undefined) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export default async function PaginaOrdenes({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filtro: Filtro = FILTROS.some((x) => x.valor === params.f) ? (params.f as Filtro) : "activas";
  const q = params.q?.trim() ?? "";
  const supabase = await clienteServidor();

  let consulta = supabase
    .from("orden")
    .select(
      `
      id, numero, estado, motivo, abierta_en,
      producto:producto_id ( serial, marca, modelo ),
      sede:sede_id ( nombre )
    `,
    )
    .order("abierta_en", { ascending: false });
  const estados = estadosDe(filtro);
  if (estados) consulta = consulta.in("estado", [...estados]);
  // Un número busca esa orden exacta; un texto se busca en equipo y
  // motivo entre las 300 más recientes del filtro.
  if (/^\d+$/.test(q)) consulta = consulta.eq("numero", Number(q));

  const contar = (f: Filtro) =>
    supabase
      .from("orden")
      .select("id", { count: "exact", head: true })
      .in("estado", [...(estadosDe(f) ?? [])]);
  const [{ data: ordenes, error }, ...conteos] = await Promise.all([
    consulta.limit(q && !/^\d+$/.test(q) ? 300 : 50),
    ...CON_CONTEO.map(contar),
  ]);
  const conteo: Partial<Record<Filtro, number | null>> = Object.fromEntries(
    CON_CONTEO.map((f, i) => [f, conteos[i]?.count ?? null]),
  );

  if (error) {
    return <Aviso tono="peligro">No se pudo cargar el tablero: {error.message}</Aviso>;
  }

  const texto = /^\d+$/.test(q) ? "" : normal(q);
  const filas = (ordenes ?? [])
    .filter((o) => {
      if (!texto) return true;
      const p = o.producto as unknown as { serial?: string; marca?: string; modelo?: string } | null;
      return [p?.serial, p?.marca, p?.modelo, o.motivo].some((t) => normal(t).includes(texto));
    })
    .slice(0, 50);
  const enlace = (f: Filtro) => {
    const u = new URLSearchParams();
    if (f !== "activas") u.set("f", f);
    if (q) u.set("q", q);
    const s = u.toString();
    return `/ordenes${s ? `?${s}` : ""}`;
  };

  return (
    <div>
      <TituloPantalla
        titulo="Órdenes"
        acciones={
          <BotonEnlace href="/recibir" variante="primario" icono={<Inbox size={18} strokeWidth={2} />}>
            Recibir equipo
          </BotonEnlace>
        }
      />

      <div className="fila" style={{ gap: 8, flexWrap: "wrap", marginBottom: 14, justifyContent: "space-between" }}>
        <div className="fila" style={{ gap: 6, flexWrap: "wrap" }}>
          {FILTROS.map((x) => (
            <Link key={x.valor} href={enlace(x.valor)} className={`pastilla${filtro === x.valor ? " pastilla-activa" : ""}`}>
              {x.etiqueta}
              {typeof conteo[x.valor] === "number" && <span className="cifra"> ({conteo[x.valor]})</span>}
            </Link>
          ))}
        </div>
        <form method="get" action="/ordenes" className="fila" style={{ gap: 6, flex: "1 1 240px", maxWidth: 380 }}>
          {filtro !== "activas" && <input type="hidden" name="f" value={filtro} />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Número, serial, equipo o motivo…"
            style={{ flex: 1, minWidth: 0 }}
          />
          <Boton type="submit" variante="contorno" icono={<Search size={16} strokeWidth={2} />} aria-label="Buscar" />
        </form>
      </div>

      {filas.length === 0 ? (
        <Tarjeta style={{ textAlign: "center", padding: 36, borderStyle: "dashed" }}>
          <ClipboardList size={30} strokeWidth={1.6} color="var(--ink-3)" aria-hidden />
          <p style={{ margin: "10px 0 0", fontWeight: 700 }}>
            {q ? "Ninguna orden coincide con la búsqueda" : filtro === "todas" ? "No hay órdenes todavía" : "No hay órdenes aquí"}
          </p>
          {filtro === "todas" && !q && (
            <p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
              La primera nace al recibir un equipo en caja.
            </p>
          )}
        </Tarjeta>
      ) : (
        <TarjetaTabla>
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Equipo</th>
                <th>Sede</th>
                <th>Estado</th>
                <th>Abierta</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/orden/${o.id}`} className="cifra" style={{ fontWeight: 800 }}>
                      #{o.numero}
                    </Link>
                  </td>
                  <td>
                    {/* @ts-expect-error -- join inferido como array por el tipado genérico de supabase-js */}
                    <div style={{ fontWeight: 600 }}>{o.producto?.marca} {o.producto?.modelo}</div>
                    {/* @ts-expect-error -- idem */}
                    <div className="cifra" style={{ fontSize: 12, color: "var(--ink-3)" }}>{o.producto?.serial}</div>
                    {o.motivo && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-2)",
                          marginTop: 2,
                          maxWidth: 360,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={o.motivo}
                      >
                        {o.motivo}
                      </div>
                    )}
                  </td>
                  {/* @ts-expect-error -- idem */}
                  <td>{o.sede?.nombre}</td>
                  <td>
                    <EstadoOrden estado={o.estado as Estado} />
                  </td>
                  <td className="cifra" style={{ whiteSpace: "nowrap", color: "var(--ink-2)" }}>
                    {new Date(o.abierta_en).toLocaleDateString("es-CO")}
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
