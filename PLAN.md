# Plan 1 — Trazabilidad real del taller: fases pendientes (5-8)

Documento fuente completo:
`C:\Users\ZAETH\.claude\plans\vivid-splashing-elephant.md` (no versionado
en este repo). Este archivo resume solo lo que falta — Fases 1-4 ya están
mergeadas (ver `CLAUDE.md`).

## Por qué estas cuatro fases, en este orden

El problema central que el cliente describió y que las Fases 1-4 todavía
no resuelven: **"el inventario no se agrega a la factura ni a ningún
lado."** Consumir un repuesto durante la reparación ya dispara
`mover_existencia` y descuenta el stock correctamente, pero nunca toca
`cotizacion.total` — ese número se escribe una sola vez al enviar la
cotización y nada lo recalcula después. Las Fases 5-8 conectan esa pieza
y todo lo que depende de ella:

- Fase 5 crea la fuente de verdad del costo real (`orden_item` +
  `orden.total`).
- Fase 6 y 7 son consecuencia directa de que Fase 5 exista: sin
  `orden_item` no hay nada que marque `repuesto_solicitud` como
  `"consumido"` (Fase 6), ni nada real que el POS pueda cobrar itemizado
  en vez de un cargo único (Fase 7).
- Fase 8 es la más independiente de las cuatro — solo expone
  `orden_evento`, que ya existe desde la v1 — pero se deja al final
  porque no bloquea ni es bloqueada por nada del dinero.

## Diseño de datos que las cuatro fases comparten

**`orden_item`** — lo que REALMENTE se usó/hizo durante la reparación,
distinto de `cotizacion_item` (la propuesta enviada antes de aprobar).
Resuelve el caso "se cotizaron 2, se usaron 3": la cotización queda como
histórico de lo propuesto, `orden_item` acumula la realidad y es lo que
finalmente se cobra.

```sql
create table orden_item (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  orden_id     uuid not null references orden(id) on delete cascade,
  tipo         text not null check (tipo in ('repuesto','servicio','mano_obra')),
  repuesto_id  uuid references repuesto(id),
  servicio_id  uuid references servicio(id),
  mano_obra_id uuid references mano_obra(id),
  descripcion  text not null,        -- snapshot legible, no depende de que el catálogo no cambie
  cantidad     int not null default 1,
  precio_unit  numeric(12,2) not null,
  subtotal     numeric(12,2) not null,
  creado_por   uuid references perfil(id),
  creado_en    timestamptz not null default now()
);
create index on orden_item (orden_id);
select _aplica_rls_empresa('orden_item');

alter table orden add column total numeric(12,2) not null default 0;
```

`orden.total` se recalcula (nunca se edita a mano) con un helper
`lib/orden-total.ts: recalcularTotalOrden(supabase, ordenId)` que suma
`orden_item.subtotal` y hace `update orden set total = ...` — se llama
desde cada ruta que inserta un `orden_item`. Esto reemplaza a
`cotizacion.total` como la fuente de verdad de lo que se cobra; la
cotización sigue existiendo tal cual, como la propuesta enviada al
cliente (no se toca su inmutabilidad una vez enviada).

`orden_para_tecnico` (vista de `0003_vista_tecnico.sql`) necesita ganar
`o.total` en su `select` para que el hub y la cabecera puedan mostrarlo
(ya ganó `o.token_publico` en la Fase 4, `0033_vista_tecnico_token.sql`).

## Fase 5 — Consumo real conectado al costo de la orden

- `app/api/ordenes/[id]/repuestos/route.ts`, acción `"consumir"`: después
  del `mover_existencia` + insert en `orden_repuesto` (sin cambios ahí),
  agrega un insert en `orden_item` (`tipo:'repuesto'`, `precio_unit` =
  `repuesto.precio_venta` en ese momento, `subtotal = cantidad*precio_unit`)
  y llama a `recalcularTotalOrden`.
- Nueva ruta `app/api/ordenes/[id]/items/route.ts`
  (`POST { tipo:'servicio'|'mano_obra', id, cantidad }`) para registrar un
  servicio realizado o mano de obra aplicada durante la reparación — no
  toca inventario, solo inserta `orden_item` + recalcula total.
- `repuestos/page.tsx` gana dos bloques nuevos junto al de "Consumir del
  inventario": "Agregar servicio realizado" y "Agregar mano de obra",
  cada uno un buscador simple contra su catálogo (mismo patrón de
  búsqueda que ya usa la página para repuestos).
- El hub y `CabeceraOrden` (Fase 4) muestran `orden.total` corriendo — hoy
  no se muestra en ningún lado.

**Migración nueva:** tabla `orden_item` + columna `orden.total` (arriba).

## Fase 6 — Cierra el ciclo faltante → recibido → consumido

- Cuando se consume un repuesto (Fase 5) y existe una
  `repuesto_solicitud` de esa orden en estado `"recibido"` para ese mismo
  repuesto, se marca como `"consumido"` en la misma transacción de la
  ruta de consumir. Esto completa el ciclo que el propio esquema ya
  documenta (`faltante -> solicitado -> recibido -> consumido`) y que hoy
  nunca llega al final.
- `/compras` ya filtra `.neq("estado", "consumido")`
  (`app/(admin)/compras/page.tsx:76`) — con este cambio esa fila por fin
  desaparece de la lista cuando corresponde, en vez de quedar fantasma
  como `"recibido"` para siempre.

**Depende de:** Fase 5 (necesita que exista el insert de consumo al que
enganchar este cierre de ciclo).

## Fase 7 — POS: buscar por QR/token y cobrar itemizado

- `app/api/ordenes/buscar/route.ts` acepta además `?token=` (adicional a
  `?numero=`) para resolver por `token_publico` — mismo patrón de lookup
  que ya usa `app/api/ordenes/por-token/route.ts`.
- La respuesta cambia de `totalCotizado`/`saldoPendiente` (basado en
  `cotizacion.total`) a usar `orden.total` (la realidad acumulada en
  `orden_item`) como base del saldo.
- `app/(pos)/entregar/page.tsx`: agrega un botón "Escanear QR" que
  reutiliza el mismo `BarcodeDetector` de
  `app/(taller)/escanear/page.tsx`, junto al campo de número existente.
- Al cobrar (`entregar()`), en vez de un único `venta_item` "Saldo orden
  #N", se envían tantos `venta_item` como filas tenga `orden_item` (con
  su `repuesto_id` cuando aplique) — el cajero ve y cobra exactamente lo
  que se usó, sin volver a digitarlo.

**Depende de:** Fase 5 (no hay `orden_item` que cobrar itemizado sin
ella). No depende de la Fase 6.

## Fase 8 — Historial visible para el staff

- El hub (`orden/[id]/page.tsx`) gana una sección "Historial" que lista
  `orden_evento` de esa orden (ya se escribe en cada transición —
  `supabase/migrations/0001_base.sql:83-94`), reutilizando el mismo
  formato de timeline que ya renderiza
  `app/(publico)/seguimiento/[token]/page.tsx:116-147`, pero del lado del
  técnico/admin.
- Nueva ruta `GET /api/ordenes/[id]/eventos` (equivalente interno a lo
  que ya hace `app/api/seguimiento/[token]/route.ts:39-44`, pero
  autenticado en vez de por token público).

**Depende de:** nada de las Fases 5-7. Se puede mergear en cualquier
momento, incluso antes, si conviene por prioridad.

## Verificación

Mismo patrón que las fases anteriores: `npx tsc --noEmit`, `npx eslint`
sobre los archivos tocados, `npx vitest run`, `npm run build`. Cada fase
es su propia rama desde `main` y su propio PR — no se mergea nada sin que
las cuatro verificaciones pasen. Dado que las Fases 5, 6 y 7 tocan dinero
y estado de la orden, probar cada una manualmente contra datos
desechables en producción antes de mergear, como se hizo con
`mover_existencia` en la ronda anterior.

La prueba integral (equipo de muestra: entrada → QR → diagnóstico →
cotización → aprobación → reparación con consumo real → verificar
inventario/orden/cuenta → escanear QR en POS → cobrar → entregar →
cerrar) queda como la verificación final, una vez mergeadas las 8 fases
del Plan 1.
