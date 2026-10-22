import Link from "next/link";
import { redirect } from "next/navigation";
import { Search } from "lucide-react";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { FotoProducto } from "@/componentes/ui/foto-producto";
import { Tarjeta } from "@/componentes/ui/tarjeta";
import { Etiqueta, type TonoEtiqueta } from "@/componentes/ui/etiqueta";
import { Boton } from "@/componentes/ui/boton";
import { TituloPantalla } from "@/componentes/ui/titulo-pantalla";
import { EditarProducto, type RepuestoEditable, type ArticuloEditable } from "@/componentes/inventario/editar-producto";
import { codigoArticulo } from "@/lib/codigo-interno";

/** Cómo se ve el estado de un artículo (articulo.estado, migración 0016). */
const ESTADO_ARTICULO: Record<string, { texto: string; tono: TonoEtiqueta }> = {
  en_stock: { texto: "En venta", tono: "ok" },
  trasladado: { texto: "En traslado", tono: "aviso" },
  vendido: { texto: "Vendido", tono: "neutro" },
  anulado: { texto: "Anulado", tono: "neutro" },
};

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

/** Para buscar sin importar mayúsculas ni tildes. */
const normal = (t: string | null | undefined) =>
  (t ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <Tarjeta style={{ borderStyle: "dashed", textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
      {children}
    </Tarjeta>
  );
}

/**
 * Existencias: una pestaña para repuestos (a granel, por sede) y otra
 * para equipos (cada unidad con su etiqueta), con buscador y filtro de
 * sede. Recibir mercancía tiene su propia pantalla; "En venta" y la
 * etiqueta se manejan desde el lápiz de cada tarjeta.
 */
export default async function PaginaInventario({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; q?: string; sede?: string }>;
}) {
  const params = await searchParams;
  const verEquipos = params.ver === "equipos";
  const q = normal(params.q?.trim());
  const sedeFiltro = params.sede ?? "";
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  // El layout de (admin) ya redirige si no hay perfil -- este chequeo es
  // solo para que TypeScript sepa que perfil.empresaId existe más abajo.
  if (!perfil) redirect("/login");
  const editable = puede(perfil.rol, "gestionar_inventario");

  const [{ data: existenciasTodas }, { data: articulosTodos }, { data: sedes }] = await Promise.all([
    supabase
      .from("existencia")
      // repuesto ( * ) y no la lista de columnas: en_venta (0044) puede no
      // existir todavía en la base, y pedirla por nombre rompería la página.
      .select(
        "cantidad, sede_id, repuesto:repuesto_id ( * ), sede:sede_id ( nombre )",
      )
      .order("cantidad", { ascending: true }),
    supabase
      .from("articulo")
      .select(
        "id, numero, tipo, marca, modelo, numero_serie, costo, precio_venta, condicion, categoria_id, imagen_url, estado, sede_id, sede:sede_id ( nombre )",
      )
      .order("numero", { ascending: false }),
    supabase.from("sede").select("id, nombre").order("nombre"),
  ]);

  const existencias = (existenciasTodas ?? []).filter((e) => {
    if (sedeFiltro && e.sede_id !== sedeFiltro) return false;
    if (!q) return true;
    const r = e.repuesto as unknown as { codigo?: string; descripcion?: string; marca?: string; modelo?: string } | null;
    return [r?.codigo, r?.descripcion, r?.marca, r?.modelo].some((t) => normal(t).includes(q));
  });
  const articulos = (articulosTodos ?? []).filter((a) => {
    if (sedeFiltro && a.sede_id !== sedeFiltro) return false;
    if (!q) return true;
    return [codigoArticulo(a.numero), a.tipo, a.marca, a.modelo, a.numero_serie].some((t) => normal(t).includes(q));
  });

  // Las pestañas conservan la búsqueda y la sede.
  const enlace = (ver: "repuestos" | "equipos") => {
    const p = new URLSearchParams();
    if (ver === "equipos") p.set("ver", "equipos");
    if (params.q) p.set("q", params.q);
    if (sedeFiltro) p.set("sede", sedeFiltro);
    const s = p.toString();
    return `/inventario${s ? `?${s}` : ""}`;
  };
  const filtrando = Boolean(q || sedeFiltro);

  return (
    <div>
      <TituloPantalla titulo="Existencias" />

      <form method="get" action="/inventario" className="fila" style={{ gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {verEquipos && <input type="hidden" name="ver" value="equipos" />}
        <input
          type="search"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder={verEquipos ? "Buscar por código, marca, modelo o serie…" : "Buscar por código o descripción…"}
          style={{ flex: "1 1 220px", minWidth: 0 }}
        />
        {(sedes ?? []).length > 1 && (
          <select name="sede" defaultValue={sedeFiltro} style={{ flex: "0 1 180px" }}>
            <option value="">Todas las sedes</option>
            {(sedes ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
        <Boton type="submit" variante="contorno" icono={<Search size={16} strokeWidth={2} />}>
          Buscar
        </Boton>
      </form>

      <div className="fila" style={{ gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <Link href={enlace("repuestos")} className={`pastilla${verEquipos ? "" : " pastilla-activa"}`}>
          Repuestos <span className="cifra">({existencias.length})</span>
        </Link>
        <Link href={enlace("equipos")} className={`pastilla${verEquipos ? " pastilla-activa" : ""}`}>
          Equipos <span className="cifra">({articulos.length})</span>
        </Link>
        {filtrando && (
          <Link href={verEquipos ? "/inventario?ver=equipos" : "/inventario"} style={{ fontSize: 13, marginLeft: 4 }}>
            Quitar filtros
          </Link>
        )}
      </div>

      {!verEquipos ? (
        existencias.length === 0 ? (
          <Vacio>{filtrando ? "Ningún repuesto coincide con la búsqueda." : "No hay repuestos en el catálogo."}</Vacio>
        ) : (
          <div className="rejilla-catalogo">
            {existencias.map((e, i) => {
              // @ts-expect-error -- join inferido como array
              const repuesto = e.repuesto as RepuestoEditable & { imagen_url: string | null; en_venta?: boolean };
              if (!repuesto) return null;
              const bajo = e.cantidad <= 2;
              return (
                <Tarjeta
                  key={i}
                  relleno={false}
                  style={{ padding: 11, display: "flex", flexDirection: "column", gap: 8, position: "relative" }}
                >
                  {editable && (
                    <EditarProducto
                      repuesto={repuesto}
                      // @ts-expect-error -- join inferido como array
                      existencia={{ sedeId: e.sede_id, sedeNombre: e.sede?.nombre, cantidad: e.cantidad }}
                    />
                  )}
                  <FotoProducto
                    tipo="repuesto"
                    id={repuesto.id}
                    empresaId={perfil.empresaId}
                    imagenUrl={repuesto.imagen_url}
                    editable={editable}
                  />
                  <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>{repuesto.descripcion}</div>
                  <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                    {repuesto.codigo}
                    {/* @ts-expect-error -- join inferido como array */}
                    {e.sede?.nombre ? ` · ${e.sede.nombre}` : ""}
                  </div>
                  <div className="fila" style={{ justifyContent: "space-between", gap: 6 }}>
                    <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                      {fmt(repuesto.precio_venta)}
                    </span>
                    <Etiqueta tono={e.cantidad <= 0 ? "neutro" : bajo ? "aviso" : "ok"}>
                      <span className="cifra">{e.cantidad <= 0 ? "Agotado" : e.cantidad}</span>
                    </Etiqueta>
                  </div>
                  {repuesto.en_venta === false && <Etiqueta tono="neutro">No en venta</Etiqueta>}
                </Tarjeta>
              );
            })}
          </div>
        )
      ) : articulos.length === 0 ? (
        <Vacio>
          {filtrando ? "Ningún equipo coincide con la búsqueda." : "Todavía no se ha recibido ningún equipo para la venta."}
        </Vacio>
      ) : (
        <div className="rejilla-catalogo">
          {articulos.map((a) => (
            <Tarjeta
              key={a.id}
              relleno={false}
              style={{ padding: 11, display: "flex", flexDirection: "column", gap: 8, position: "relative" }}
            >
              {editable && <EditarProducto articulo={a as ArticuloEditable} />}
              <FotoProducto
                tipo="articulo"
                id={a.id}
                empresaId={perfil.empresaId}
                imagenUrl={a.imagen_url}
                editable={editable}
              />
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.25 }}>
                {[a.marca, a.modelo].filter(Boolean).join(" ") || a.tipo}
              </div>
              <div className="cifra" style={{ fontSize: 11, color: "var(--ink-3)", marginTop: -4 }}>
                {codigoArticulo(a.numero)}
                {/* @ts-expect-error -- join inferido como array */}
                {a.sede?.nombre ? ` · ${a.sede.nombre}` : ""}
              </div>
              <div className="fila" style={{ justifyContent: "space-between", gap: 6 }}>
                <span className="cifra" style={{ fontSize: 15, fontWeight: 800 }}>
                  {fmt(a.precio_venta ?? 0)}
                </span>
                <Etiqueta tono={ESTADO_ARTICULO[a.estado]?.tono ?? "neutro"}>
                  {ESTADO_ARTICULO[a.estado]?.texto ?? a.estado}
                </Etiqueta>
              </div>
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}
