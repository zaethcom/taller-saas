/**
 * GET /api/clientes?q=<documento o teléfono>
 * Busca clientes ya registrados por documento o teléfono, para no
 * duplicar registros cada vez que alguien vuelve al taller. Compara solo
 * dígitos/letras (lib/busqueda-cliente.ts), así "1.023.456" encuentra
 * "1023456" y "300 123 4567" encuentra "+57 3001234567".
 * Devuelve una lista (vacía si no hay nadie). RLS filtra por empresa.
 * `documento` se acepta como nombre viejo del parámetro.
 * Con &nombre=1 (Vender) también busca por nombre: en el mostrador
 * casi siempre se sabe cómo se llama el cliente y no su cédula. Recibir
 * no lo pide, porque allá el campo es el documento y un pasaporte con
 * letras traería nombres parecidos que nadie buscó.
 */
import { NextRequest, NextResponse } from "next/server";
import { clienteServidor } from "@/lib/supabase/servidor";
import { MIN_CARACTERES_DOCUMENTO, digitosTelefono, normalizarDocumento, patronFlexible } from "@/lib/busqueda-orden";
import { clientesCoincidentes, type ClienteBuscado } from "@/lib/busqueda-cliente";

const COLUMNAS = "id, nombre, documento, telefono, correo";
const MAXIMO = 8;

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? req.nextUrl.searchParams.get("documento"))?.trim();
  if (!q) {
    return NextResponse.json({ error: "falta qué buscar" }, { status: 400 });
  }

  const supabase = await clienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  }

  const documento = normalizarDocumento(q);
  const telefono = digitosTelefono(q);
  const palabras = q.replace(/[%_]/g, "").split(/\s+/).filter((p) => /\p{L}/u.test(p));
  const buscarNombre = req.nextUrl.searchParams.get("nombre") === "1" && palabras.join("").length >= 3;
  const [porDocumento, porTelefono, porNombre] = await Promise.all([
    documento.length >= MIN_CARACTERES_DOCUMENTO
      ? supabase.from("cliente").select(COLUMNAS).ilike("documento", patronFlexible(documento)).limit(50)
      : null,
    telefono ? supabase.from("cliente").select(COLUMNAS).ilike("telefono", patronFlexible(telefono)).limit(50) : null,
    buscarNombre
      ? palabras
          .reduce(
            (consulta, p) => consulta.ilike("nombre", `%${p}%`),
            supabase.from("cliente").select(COLUMNAS),
          )
          .order("nombre")
          .limit(MAXIMO)
      : null,
  ]);

  const filas = [...(porDocumento?.data ?? []), ...(porTelefono?.data ?? [])] as ClienteBuscado[];
  const encontrados = clientesCoincidentes(filas, q);
  const vistos = new Set(encontrados.map((c) => c.id));
  for (const c of (porNombre?.data ?? []) as ClienteBuscado[]) {
    if (!vistos.has(c.id)) encontrados.push({ ...c, coincide: "nombre" });
  }
  return NextResponse.json({ clientes: encontrados.slice(0, MAXIMO) });
}
