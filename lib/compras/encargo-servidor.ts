/**
 * Cobros de un encargo de mostrador (0064_encargo_cobro.sql): el abono
 * al pedirlo y el saldo al entregarlo. Cada uno es una venta tipo
 * "encargo" ligada al encargo, con su pago: entra al turno de caja como
 * cualquier venta e imprime su recibo con valor, lo abonado y el saldo.
 * La validación (turno abierto, método, efectivo que alcanza) es la
 * misma de los abonos a una orden (lib/abono.ts).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { encolarImpresion } from "@/lib/impresion";
import type { AbonoValidado } from "@/lib/abono";
import { cuentaEncargo, descripcionEncargo, type CuentaEncargo } from "./encargo";

export interface EncargoCobro {
  id: string;
  descripcion: string;
  producto: string | null;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  precio_venta: number | null;
}

/** Lo que vale el encargo y lo que ya se pagó (ventas no anuladas ligadas a él). */
export async function obtenerCuentaEncargo(
  supabase: SupabaseClient,
  encargo: { id: string; precio_venta: number | null },
): Promise<CuentaEncargo> {
  const { data } = await supabase.from("venta").select("total").eq("solicitud_id", encargo.id).eq("anulada", false);
  return cuentaEncargo(encargo.precio_venta, (data ?? []).map((v) => Number(v.total)));
}

export async function registrarPagoEncargo(
  supabase: SupabaseClient,
  p: {
    pago: AbonoValidado;
    encargo: EncargoCobro;
    /** Cuenta ANTES de este pago. */
    cuenta: CuentaEncargo;
    empresaId: string;
    sedeId: string;
    userId: string;
    cajero: string | null;
    /** "ABONO" al pedirlo; "SALDO" al entregarlo. */
    etiqueta: "ABONO" | "SALDO";
    imprimir: boolean;
  },
): Promise<{ ok: true; ventaId: string; numero: number } | { ok: false; error: string }> {
  const { pago, encargo, cuenta } = p;
  const nombre = encargo.producto ?? encargo.descripcion;
  const descripcion = `${p.etiqueta === "ABONO" ? "Abono" : "Saldo"} ${descripcionEncargo({
    descripcion: nombre,
    clienteNombre: encargo.cliente_nombre,
    clienteTelefono: encargo.cliente_telefono,
  })}`;

  const { data: venta, error } = await supabase
    .from("venta")
    .insert({
      empresa_id: p.empresaId,
      sede_id: p.sedeId,
      turno_id: pago.turnoId,
      solicitud_id: encargo.id,
      cliente_id: encargo.cliente_id,
      tipo: "encargo",
      total: pago.monto,
      creada_por: p.userId,
    })
    .select("id, numero")
    .single();
  if (error || !venta) return { ok: false, error: error?.message ?? "no se pudo registrar el pago" };

  await supabase.from("venta_item").insert({
    venta_id: venta.id,
    descripcion,
    cantidad: 1,
    precio_unit: pago.monto,
  });
  await supabase.from("pago").insert({
    venta_id: venta.id,
    medio: pago.metodo.nombre,
    monto: pago.monto,
    es_efectivo: pago.metodo.es_efectivo,
    metodo_pago_id: pago.metodoPagoId,
  });

  await encolarImpresion(supabase, {
    empresaId: p.empresaId,
    sedeId: p.sedeId,
    tipo: "recibo_venta",
    creadoPor: p.userId,
    carga: {
      numeroVenta: venta.numero,
      items: [{ descripcion, cantidad: 1, precioUnit: pago.monto }],
      total: pago.monto,
      etiquetaTotal: p.etiqueta,
      medioPago: pago.metodo.nombre,
      abreCajon: pago.metodo.es_efectivo,
      cajero: p.cajero,
      montoRecibido: pago.montoRecibido,
      cambio: pago.montoRecibido != null ? pago.montoRecibido - pago.monto : null,
      cuentaOrden: {
        titulo: `Encargo: ${nombre}`,
        etiquetaValor: "Valor",
        valor: cuenta.valor,
        abonadoAntes: cuenta.pagado,
        estePago: pago.monto,
        saldo: Math.max(0, cuenta.valor - cuenta.pagado - pago.monto),
      },
      imprimir: p.imprimir,
    },
  });

  return { ok: true, ventaId: venta.id, numero: venta.numero };
}
