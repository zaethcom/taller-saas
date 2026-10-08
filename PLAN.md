# Plan 1 — Trazabilidad real del taller: código completo

Documento fuente completo: `C:\Users\ZAETH\.claude\plans\vivid-splashing-elephant.md`
(no versionado en este repo). Las ocho fases están mergeadas en `main`
(ver la tabla en `CLAUDE.md`): las Fases 5-7 en un solo PR (#27, Fase B
del Plan 3) porque comparten el mismo diseño de datos (`orden_item`), y
la Fase 8 (historial de `orden_evento` para el staff) en #36.

## Lo único pendiente: la prueba integral a mano

Las Fases 5-7 del Plan 1 y las Fases A2, B, C y F2 del Plan 3 tocan
dinero, estado de la orden o datos sensibles. Están desplegadas en
producción con sus migraciones aplicadas, pero nadie las probó todavía
de punta a punta con datos desechables, como pide la convención de
`CLAUDE.md`.

Ciclo a recorrer con un equipo de muestra:

1. Recibir el equipo con PIN/patrón de acceso (A2) → se imprime el QR.
2. Diagnóstico → cotización desde catálogo → aprobación del cliente.
3. Reparación con consumo real de repuestos: verificar que baja el
   inventario y que sube `orden.total` (Fase 5).
4. Agregar un repuesto después de aprobar: debe pedir reaprobación al
   cliente en el enlace de seguimiento (F2).
5. Escanear el QR en el POS, cobrar itemizado con turno de caja abierto
   y monto recibido editable (Fases 7 y C).
6. Entregar y cerrar: confirmar que el PIN se borró (A2) y que el
   historial de la orden muestra todo el recorrido (Fase 8).
