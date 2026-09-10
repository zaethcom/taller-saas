/**
 * Entrega: cobra el saldo pendiente vía /api/ventas (tipo "servicio",
 * ordenId), captura firma y foto de salida, y llama a
 * /api/ordenes/[id]/transicion con aEstado: "entregada" -- esa ruta ya
 * verifica saldo_en_cero, tiene_firma y tiene_foto_salida antes de
 * dejar cerrar la orden. Ver Fase 8 del plano de construcción.
 */
export default function PaginaEntregar() {
  return (
    <div>
      <h1>Entregar</h1>
      <p style={{ opacity: 0.7 }}>
        Buscar la orden, cobrar el saldo pendiente, capturar firma y foto de salida, y cerrar.
        La transición a &quot;entregada&quot; la bloquea el servidor si falta cualquiera de esas
        tres cosas -- no hace falta duplicar esa validación aquí.
      </p>
    </div>
  );
}
