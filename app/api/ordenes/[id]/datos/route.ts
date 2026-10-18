/**
 * GET   /api/ordenes/<id>/datos -- lo que se capturó al recibir, para corregirlo.
 * PATCH /api/ordenes/<id>/datos
 * Body: { cliente: {nombre, documento, telefono, correo},
 *         equipo: {serial, tipo, marca, modelo},
 *         orden: {motivo, infoAdicional, telefonoAlterno},
 *         valorServicio: number | null,
 *         acceso?: {tipo, valor, nota?} | null }   (sin `acceso`: no se toca)
 *
 * Corregir un error de la recepción (lib/orden-edicion.ts). El cliente
 * y el equipo se corrigen en su propio registro, así que el cambio se
 * ve también en sus otras órdenes. Una orden entregada ya no se edita.
 *
 * El valor del servicio es el orden_item que /api/ordenes crea al
 * recibir; solo se cambia antes de cotizar (después el valor sale de la
 * cotización y de lo que se usó). Los abonos y pagos no se tocan aquí:
 * el valor no puede quedar por debajo de lo ya pagado.
 *
 * Cada corrección queda en el historial de la orden con quién la hizo
 * y qué cambió, sin los valores del acceso al equipo.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { clienteServidor } from "@/lib/supabase/servidor";
import { obtenerPerfilActual } from "@/lib/perfil";
import { puede } from "@/lib/permisos";
import { esFinal, type Estado } from "@/lib/estados";
import { recalcularTotalOrden } from "@/lib/orden-total";
import { obtenerCuentaOrden } from "@/lib/cuenta-orden";
import {
  calcularCambios,
  normalizarDatos,
  notaEdicion,
  validarDatos,
  type DatosEdicion,
} from "@/lib/orden-edicion";

/** Antes de cotizar, el valor del servicio todavía es el que se puso al recibir. */
const ESTADOS_VALOR_EDITABLE: Estado[] = ["recibida", "en_diagnostico"];

interface FilaOrden {
  id: string;
  numero: number;
  estado: Estado;
  motivo: string;
  info_adicional: string | null;
  telefono_alterno: string | null;
  total: number;
  fase: { nombre: string } | null;
  producto: {
    id: string;
    serial: string;
    tipo: string;
    marca: string | null;
    modelo: string | null;
    cliente: { id: string; nombre: string; documento: string | null; telefono: string | null; correo: string | null };
  };
}

async function leerOrden(supabase: SupabaseClient, id: string) {
  const { data } = await supabase
    .from("orden")
    .select(
      `id, numero, estado, motivo, info_adicional, telefono_alterno, total,
       fase:fase_id ( nombre ),
       producto:producto_id ( id, serial, tipo, marca, modelo,
         cliente:cliente_id ( id, nombre, documento, telefono, correo ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  // El join de Supabase infiere arreglos aunque las relaciones sean 1:1.
  const orden = data as unknown as FilaOrden;

  // El ítem "valor del servicio" de la recepción: el primer servicio
  // escrito a mano (sin catálogo) de la orden.
  const { data: item } = await supabase
    .from("orden_item")
    .select("id, descripcion, subtotal")
    .eq("orden_id", id)
    .eq("tipo", "servicio")
    .is("servicio_id", null)
    .is("repuesto_id", null)
    .is("mano_obra_id", null)
    .order("creado_en", { ascending: true })
    .limit(1)
    .maybeSingle();

  const valorEditable = ESTADOS_VALOR_EDITABLE.includes(orden.estado);
  const p = orden.producto;
  const datos: DatosEdicion = normalizarDatos({
    cliente: {
      nombre: p.cliente.nombre,
      documento: p.cliente.documento ?? "",
      telefono: p.cliente.telefono ?? "",
      correo: p.cliente.correo ?? "",
    },
    equipo: { serial: p.serial, tipo: p.tipo, marca: p.marca ?? "", modelo: p.modelo ?? "" },
    orden: {
      motivo: orden.motivo,
      infoAdicional: orden.info_adicional ?? "",
      telefonoAlterno: orden.telefono_alterno ?? "",
    },
    valorServicio: valorEditable ? Number(item?.subtotal ?? 0) : null,
  });
  return { orden, item, datos };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!puede(perfil.rol, "editar_orden")) {
    return NextResponse.json({ error: "tu rol no puede corregir órdenes" }, { status: 403 });
  }

  const leida = await leerOrden(supabase, id);
  if (!leida) return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  const { orden, datos } = leida;

  // Para avisar que corregir al cliente también cambia sus otras órdenes.
  const { data: equipos } = await supabase.from("producto").select("id").eq("cliente_id", orden.producto.cliente.id);
  const { count } = await supabase
    .from("orden")
    .select("id", { count: "exact", head: true })
    .in("producto_id", (equipos ?? []).map((e) => e.id))
    .neq("id", id);

  return NextResponse.json({
    numero: orden.numero,
    estado: orden.estado,
    editable: !esFinal(orden.estado),
    otrasOrdenesCliente: count ?? 0,
    puedeEditarAcceso: puede(perfil.rol, "ver_acceso_dispositivo"),
    ...datos,
  });
}

type TipoAcceso = "pin" | "patron" | "contrasena" | "otro";
const TIPOS_ACCESO: TipoAcceso[] = ["pin", "patron", "contrasena", "otro"];

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await clienteServidor();
  const perfil = await obtenerPerfilActual(supabase);
  if (!perfil) return NextResponse.json({ error: "no autenticado" }, { status: 401 });
  if (!puede(perfil.rol, "editar_orden")) {
    return NextResponse.json({ error: "tu rol no puede corregir órdenes" }, { status: 403 });
  }

  const body = (await req.json()) as DatosEdicion & {
    acceso?: { tipo: TipoAcceso; valor: string; nota?: string } | null;
  };

  const leida = await leerOrden(supabase, id);
  if (!leida) return NextResponse.json({ error: "orden no encontrada" }, { status: 404 });
  const { orden, item, datos: antes } = leida;
  if (esFinal(orden.estado)) {
    return NextResponse.json({ error: "la orden ya se entregó: sus datos no se pueden cambiar" }, { status: 409 });
  }

  const despues = normalizarDatos({ ...body, valorServicio: antes.valorServicio === null ? null : body.valorServicio });
  const faltas = validarDatos(despues);
  if (faltas.length > 0) return NextResponse.json({ error: faltas.join(". ") }, { status: 400 });

  const cambios = calcularCambios(antes, despues);

  // Acceso al equipo: dato sensible, mismo permiso que para verlo.
  let acceso: { tipo: TipoAcceso; valor: string; nota: string | null } | null | undefined = undefined;
  if (body.acceso !== undefined) {
    if (!puede(perfil.rol, "ver_acceso_dispositivo")) {
      return NextResponse.json({ error: "tu rol no puede cambiar el acceso al equipo" }, { status: 403 });
    }
    if (body.acceso && body.acceso.valor?.trim()) {
      if (!TIPOS_ACCESO.includes(body.acceso.tipo)) {
        return NextResponse.json({ error: "tipo de acceso no válido" }, { status: 400 });
      }
      acceso = { tipo: body.acceso.tipo, valor: body.acceso.valor.trim(), nota: body.acceso.nota?.trim() || null };
    } else {
      acceso = null;
    }
  }

  if (cambios.lista.length === 0 && acceso === undefined) {
    return NextResponse.json({ ok: true, cambios: 0 });
  }

  // El valor no puede quedar por debajo de lo que el cliente ya pagó.
  if (cambios.valorServicio !== null) {
    const cuenta = await obtenerCuentaOrden(supabase, id);
    const nuevoTotal = Number(orden.total) - Number(item?.subtotal ?? 0) + cambios.valorServicio;
    if (cuenta && nuevoTotal < cuenta.pagado) {
      return NextResponse.json(
        {
          error: `El cliente ya pagó $${Math.round(cuenta.pagado).toLocaleString("es-CO")}: el valor no puede quedar por debajo de eso`,
        },
        { status: 400 },
      );
    }
  }

  // Primero el equipo: el serial es lo único que puede chocar con otro registro.
  if (Object.keys(cambios.equipo).length > 0) {
    const e = cambios.equipo;
    const { error } = await supabase
      .from("producto")
      .update({
        ...(e.serial !== undefined && { serial: e.serial }),
        ...(e.tipo !== undefined && { tipo: e.tipo }),
        ...(e.marca !== undefined && { marca: e.marca || null }),
        ...(e.modelo !== undefined && { modelo: e.modelo || null }),
      })
      .eq("id", orden.producto.id);
    if (error) {
      const msg = error.code === "23505" ? "Ese serial ya lo tiene otro equipo de la empresa" : error.message;
      return NextResponse.json({ error: msg }, { status: error.code === "23505" ? 409 : 500 });
    }
  }

  if (Object.keys(cambios.cliente).length > 0) {
    const c = cambios.cliente;
    const { error } = await supabase
      .from("cliente")
      .update({
        ...(c.nombre !== undefined && { nombre: c.nombre }),
        ...(c.documento !== undefined && { documento: c.documento || null }),
        ...(c.telefono !== undefined && { telefono: c.telefono || null }),
        ...(c.correo !== undefined && { correo: c.correo || null }),
      })
      .eq("id", orden.producto.cliente.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Object.keys(cambios.orden).length > 0) {
    const o = cambios.orden;
    const { error } = await supabase
      .from("orden")
      .update({
        ...(o.motivo !== undefined && { motivo: o.motivo }),
        ...(o.infoAdicional !== undefined && { info_adicional: o.infoAdicional || null }),
        ...(o.telefonoAlterno !== undefined && { telefono_alterno: o.telefonoAlterno || null }),
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // El ítem del valor lleva el motivo como descripción (así lo crea la
  // recepción): si se corrige el motivo, se corrige también ahí.
  const descripcionItem =
    cambios.orden.motivo !== undefined && item?.descripcion === antes.orden.motivo
      ? despues.orden.motivo
      : (item?.descripcion ?? despues.orden.motivo);
  if (cambios.valorServicio !== null) {
    const v = cambios.valorServicio;
    if (item && v > 0) {
      await supabase
        .from("orden_item")
        .update({ cantidad: 1, precio_unit: v, subtotal: v, descripcion: descripcionItem })
        .eq("id", item.id);
    } else if (item) {
      await supabase.from("orden_item").delete().eq("id", item.id);
    } else if (v > 0) {
      await supabase.from("orden_item").insert({
        empresa_id: perfil.empresaId,
        orden_id: id,
        tipo: "servicio",
        descripcion: despues.orden.motivo,
        cantidad: 1,
        precio_unit: v,
        subtotal: v,
        creado_por: perfil.id,
      });
    }
    await recalcularTotalOrden(supabase, id);
  } else if (item && descripcionItem !== item.descripcion) {
    await supabase.from("orden_item").update({ descripcion: descripcionItem }).eq("id", item.id);
  }

  const lista = [...cambios.lista];
  if (acceso !== undefined) {
    if (acceso === null) {
      await supabase.from("orden_acceso").delete().eq("orden_id", id);
    } else {
      const fila = { empresa_id: perfil.empresaId, orden_id: id, ...acceso, creado_por: perfil.id };
      const { error } = await supabase.from("orden_acceso").upsert(fila, { onConflict: "orden_id" });
      // Sin la migración 0057 la base rechaza "pin" y "contrasena" (23514):
      // igual que al recibir, se guarda como "otro" con el tipo en la nota.
      if (error?.code === "23514" && fila.tipo !== "otro") {
        const etiqueta = fila.tipo === "pin" ? "PIN" : fila.tipo === "contrasena" ? "Contraseña" : "Patrón";
        await supabase
          .from("orden_acceso")
          .upsert(
            { ...fila, tipo: "otro", nota: fila.nota ? `${etiqueta} · ${fila.nota}` : etiqueta },
            { onConflict: "orden_id" },
          );
      } else if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    // Nunca el valor en el historial: solo que cambió.
    lista.push({ campo: "acceso al equipo", antes: "…", despues: acceso ? "actualizado" : "quitado" });
  }

  await supabase.from("orden_evento").insert({
    empresa_id: perfil.empresaId,
    orden_id: id,
    de_estado: orden.estado,
    a_estado: orden.estado,
    de_fase: orden.fase?.nombre ?? null,
    a_fase: orden.fase?.nombre ?? null,
    autor_id: perfil.id,
    nota: notaEdicion(lista, perfil.nombre),
  });

  return NextResponse.json({ ok: true, cambios: lista.length });
}
