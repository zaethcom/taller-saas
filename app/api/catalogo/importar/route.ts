/**
 * POST /api/catalogo/importar -- cargar un catálogo en Excel (hojas
 * Repuestos, Accesorios y Servicios) en la empresa del usuario.
 *
 * multipart/form-data con `archivo` (.xlsx) y `modo`:
 *   - "previsualizar" (por defecto): lee el archivo y dice qué haría --
 *     cuántas categorías, repuestos y servicios nuevos o a actualizar, y
 *     qué filas se omiten -- sin escribir nada.
 *   - "importar": hace la carga. El `codigo` es la llave, así que
 *     repetir la importación actualiza en vez de duplicar.
 *
 * No toca existencias: el catálogo dice qué se vende y a cuánto; las
 * unidades entran por /recepcion-mercancia.
 */
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import {
  HOJAS_REPUESTO,
  HOJA_SERVICIO,
  enLotes,
  leerCatalogo,
  normalizarEncabezado,
  type Fila,
} from "@/lib/catalogo-importar";

export const runtime = "nodejs";

const TAMANO_MAXIMO = 4 * 1024 * 1024;
const LOTE = 500;

/** El valor "visible" de una celda: resultado de fórmula, texto de un enlace o de texto enriquecido. */
function valorCelda(v: ExcelJS.CellValue): unknown {
  if (v == null) return null;
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v.toISOString();
  if ("result" in v) return valorCelda(v.result as ExcelJS.CellValue);
  if ("richText" in v) return v.richText.map((t) => t.text).join("");
  if ("text" in v) return v.text;
  return null;
}

function filasDeHoja(hoja: ExcelJS.Worksheet): Fila[] {
  const encabezados: string[] = [];
  hoja.getRow(1).eachCell({ includeEmpty: true }, (celda, col) => {
    encabezados[col] = normalizarEncabezado(String(valorCelda(celda.value) ?? ""));
  });
  const filas: Fila[] = [];
  for (let r = 2; r <= hoja.rowCount; r++) {
    const fila: Fila = {};
    hoja.getRow(r).eachCell({ includeEmpty: false }, (celda, col) => {
      const clave = encabezados[col];
      if (clave) fila[clave] = valorCelda(celda.value);
    });
    filas.push(fila);
  }
  return filas;
}

/** Supabase devuelve máximo 1000 filas por consulta: leer todas por páginas. */
async function todas<T>(consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export async function POST(req: Request) {
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }
  if (!puede(perfil.rol, "gestionar_inventario")) {
    return NextResponse.json({ error: "no autorizado" }, { status: 403 });
  }

  const form = await req.formData();
  const archivo = form.get("archivo");
  const importar = form.get("modo") === "importar";
  if (!(archivo instanceof File)) {
    return NextResponse.json({ error: "falta el archivo" }, { status: 400 });
  }
  if (archivo.size > TAMANO_MAXIMO) {
    return NextResponse.json({ error: "el archivo pasa de 4 MB" }, { status: 400 });
  }

  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return NextResponse.json({ error: "no se pudo leer el archivo; debe ser un Excel .xlsx" }, { status: 400 });
  }

  const hojas: Record<string, { filas: Fila[] }> = {};
  for (const nombre of [...HOJAS_REPUESTO, HOJA_SERVICIO]) {
    const hoja = libro.getWorksheet(nombre);
    if (hoja) hojas[nombre] = { filas: filasDeHoja(hoja) };
  }
  if (Object.keys(hojas).length === 0) {
    return NextResponse.json(
      { error: `el archivo no tiene ninguna de las hojas ${[...HOJAS_REPUESTO, HOJA_SERVICIO].join(", ")}` },
      { status: 400 },
    );
  }

  const catalogo = leerCatalogo(hojas);

  try {
    const [categoriasActuales, repuestosActuales, serviciosActuales] = await Promise.all([
      todas<{ id: string; nombre: string }>((a, b) =>
        supabase.from("categoria").select("id, nombre").eq("empresa_id", perfil.empresaId).range(a, b),
      ),
      todas<{ codigo: string }>((a, b) =>
        supabase.from("repuesto").select("codigo").eq("empresa_id", perfil.empresaId).range(a, b),
      ),
      todas<{ id: string; codigo: string | null }>((a, b) =>
        supabase.from("servicio").select("id, codigo").eq("empresa_id", perfil.empresaId).range(a, b),
      ),
    ]);

    const categoriaPorNombre = new Map(categoriasActuales.map((c) => [c.nombre.toLowerCase(), c.id]));
    const codigosRepuesto = new Set(repuestosActuales.map((r) => r.codigo.toUpperCase()));
    const servicioPorCodigo = new Map(
      serviciosActuales.filter((s) => s.codigo).map((s) => [s.codigo!.toUpperCase(), s.id]),
    );

    const categoriasNuevas = catalogo.categorias.filter((c) => !categoriaPorNombre.has(c.toLowerCase()));
    const repuestosNuevos = catalogo.repuestos.filter((r) => !codigosRepuesto.has(r.codigo.toUpperCase())).length;
    const serviciosExistentes = catalogo.servicios.filter((s) => s.codigo && servicioPorCodigo.has(s.codigo.toUpperCase()));

    const resumen = {
      categoriasNuevas: categoriasNuevas.length,
      categorias: catalogo.categorias.length,
      repuestosNuevos,
      repuestosActualizados: catalogo.repuestos.length - repuestosNuevos,
      enVenta: catalogo.repuestos.filter((r) => r.enVenta).length,
      serviciosNuevos: catalogo.servicios.length - serviciosExistentes.length,
      serviciosActualizados: serviciosExistentes.length,
      omitidas: catalogo.omitidas,
      hojas: Object.keys(hojas),
    };

    if (!importar) {
      return NextResponse.json({ ...resumen, importado: false });
    }

    // 1. Categorías que faltan.
    if (categoriasNuevas.length) {
      const { data, error } = await supabase
        .from("categoria")
        .insert(categoriasNuevas.map((nombre) => ({ empresa_id: perfil.empresaId, nombre })))
        .select("id, nombre");
      if (error) throw new Error(`categorías: ${error.message}`);
      for (const c of data ?? []) categoriaPorNombre.set(c.nombre.toLowerCase(), c.id);
    }

    // 2. Repuestos y accesorios: upsert por (empresa_id, codigo).
    const filasRepuesto = catalogo.repuestos.map((r) => ({
      empresa_id: perfil.empresaId,
      codigo: r.codigo,
      descripcion: r.descripcion,
      precio_venta: r.precioVenta,
      costo: r.costo,
      marca: r.marca,
      modelo: r.modelo,
      observacion: r.observacion,
      en_venta: r.enVenta,
      categoria_id: r.categoria ? (categoriaPorNombre.get(r.categoria.toLowerCase()) ?? null) : null,
    }));
    for (const lote of enLotes(filasRepuesto, LOTE)) {
      const { error } = await supabase.from("repuesto").upsert(lote, { onConflict: "empresa_id,codigo" });
      if (error) throw new Error(`repuestos: ${error.message}`);
    }

    // 3. Servicios: no tienen código único en la base, así que se
    //    actualiza por id el que ya existe con ese código y se crea el resto.
    const filaServicio = (s: (typeof catalogo.servicios)[number]) => ({
      empresa_id: perfil.empresaId,
      codigo: s.codigo,
      nombre: s.nombre,
      descripcion: s.descripcion,
      precio: s.precio,
      costo_estimado: s.costoEstimado,
      tiempo_estimado_minutos: s.tiempoEstimadoMinutos,
      activo: s.activo,
    });
    const actualizar = serviciosExistentes.map((s) => ({ id: servicioPorCodigo.get(s.codigo!.toUpperCase())!, ...filaServicio(s) }));
    const crear = catalogo.servicios.filter((s) => !serviciosExistentes.includes(s)).map(filaServicio);
    for (const lote of enLotes(actualizar, LOTE)) {
      const { error } = await supabase.from("servicio").upsert(lote, { onConflict: "id" });
      if (error) throw new Error(`servicios: ${error.message}`);
    }
    for (const lote of enLotes(crear, LOTE)) {
      const { error } = await supabase.from("servicio").insert(lote);
      if (error) throw new Error(`servicios: ${error.message}`);
    }

    return NextResponse.json({ ...resumen, importado: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error al importar" }, { status: 500 });
  }
}
