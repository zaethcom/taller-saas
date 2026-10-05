# Taller SaaS — guía para Claude Code

POS y servicio técnico trazable por QR, para talleres con dos sedes. Ver
`README.md` para arquitectura, estructura de carpetas y decisiones ya
tomadas — este archivo cubre el plano de construcción vigente y las
convenciones a seguir al escribir código nuevo.

## El plano de construcción

El trabajo avanza por planes con fases, cada fase en su propia rama y su
propio PR contra `main` — nunca varias fases mezcladas en un commit. El
documento fuente de cada plan vive en `C:\Users\ZAETH\.claude\plans\` (no
se versiona en este repo); los PRs de cada fase citan qué archivo y qué
puntos del documento del cliente resuelven.

### Plan 1 — Trazabilidad real del taller

Ocho fases: catálogos → diagnóstico propio → cotización desde catálogo →
navegación compartida → consumo real conectado al costo → cierre del
ciclo de faltantes → POS por QR con cobro itemizado → historial visible.

**Completadas (Fases 1-7):**

| Fase | Qué entrega | PR |
|---|---|---|
| 1 | Catálogos `servicio` y `mano_obra` + CRUD y páginas admin (`/servicios`, `/mano-obra`) | #17 |
| 2 | `diagnostico` como paso propio, separado de la cotización (`PATCH /api/ordenes/[id]/diagnostico`) | #21 |
| 3 | Cotización construida desde el catálogo (`/orden/[id]/cotizacion`), con línea libre opcional | #21 |
| 4 | `CabeceraOrden` compartida (número, estado, cliente/equipo, copiar enlace) en las cuatro pantallas de etapa | #22 |
| 5 | `orden_item` + `recalcularTotalOrden`: consumir un repuesto o registrar servicio/mano de obra afecta de verdad `orden.total` | #27 |
| 6 | Cierra el ciclo `faltante → solicitado → recibido → consumido` de `repuesto_solicitud` | #27 |
| 7 | POS (`/entregar`) busca por QR/token y cobra `orden_item` itemizado, no un cargo único "Saldo orden #N" | #27 |

Las Fases 5-7 se ejecutaron tal cual estaban diseñadas en el plan fuente,
como la Fase B del Plan 3 (ver abajo) — se agruparon en un solo PR porque
comparten el mismo diseño de datos (`orden_item`) y no tenía sentido
partirlas.

**Pendiente (Fase 8):**

| Fase | Qué falta |
|---|---|
| 8 | Historial de `orden_evento` visible para técnico/admin en el hub de la orden — no depende de nada de las Fases 5-7, se puede mergear cuando convenga |

Fuera de alcance de este plan (deliberado, no olvidado): los estados
"Control de calidad" y "Terminado" — cambiarían `lib/estados.ts` y todo lo
que depende de la máquina de estados; se evalúan después de validar el
resto con el cliente.

### Plan 2 — Etiquetas de marca y configuración de impresoras

Completado. Código de entrada (`${prefijo}${numero}`) en la etiqueta QR,
etiqueta de código de barras por repuesto, e `impresora_sede` configurable
desde `/sedes` en vez de solo `estacion/config.json`. Extendido después
(fuera de este plan original) con logo real impreso — commits
`a71f97d`/`698cbad` — y etiquetas en PPLB para la impresora Argox real de
Polaco Scooter en vez de ZPL, que era la que el plan original asumía.

### Plan 3 — Mejoras POS y taller (documento de 9 puntos del cliente)

Completado. Documento fuente:
`C:\Users\ZAETH\.claude\plans\spicy-percolating-eich.md` (no versionado
en este repo).

| Fase | Qué entrega | PR |
|---|---|---|
| A1 | Tipo de equipo según el negocio configurado + escaneo de código de barras en `/recibir` | #25 |
| A2 | `orden_acceso`: PIN/patrón del equipo, dato sensible, se purga al entregar | #26 |
| B | Fases 5-7 del Plan 1 (`orden_item`, ciclo de faltantes, cobro itemizado por QR) | #27 |
| C | Turno de caja bloqueante visible, monto recibido editable, recibo opcional sin afectar el cajón | #28 |
| D | Tarjetas de producto compactas en `/vender` | #29 |
| E | Recepción de mercancía: cantidad (N unidades → N etiquetas) + condición del artículo | #30 |
| F1 | Seguimiento del cliente: logo, diagnóstico, motivo | #31 |
| F2 | Reaprobación de costos agregados después de aprobar la cotización (`orden_item.requiere_aprobacion`) | #32 |
| F3 | Mensajería cliente ↔ taller en el enlace de seguimiento, async y sin notificaciones push | #33 |

Las nueve fases se mergearon en secuencia por dependencias (A1 → B → A2 →
D → E → F2 → C → F1 → F3), con renumeración de migraciones donde dos
fases ramificaron del mismo punto y reclamaron el mismo número
(`0036`-`0041` quedaron secuenciales en el orden de merge, no en el
orden en que se escribieron) y resolución manual de conflictos en los
archivos de seguimiento (`F1`/`F2`/`F3` tocan los mismos dos archivos
desde ramas que no se veían entre sí).

Pendiente de la sesión que mergeó esto: la prueba manual con datos
desechables en producción que pide la convención de abajo para A2, B, C
y F2 (tocan dinero, estado de la orden o datos sensibles) — se aplicaron
las migraciones y se verificó que todo compila/builda junto, pero nadie
probó el flujo completo a mano todavía.

## Convenciones del proyecto

- **Una fase, una rama, un PR contra `main`.** Si una fase depende de la
  anterior (p. ej. Fase 4 tocando páginas que reescribió la Fase 3),
  decirlo explícito en el PR y ramificar desde esa rama, no desde `main`.
- **Verificación antes de cada commit de fase:** `npx tsc --noEmit`,
  `npx eslint` sobre los archivos tocados, `npx vitest run`, `npm run build`.
  Ninguna fase se mergea sin que las cuatro pasen.
- **Las migraciones son el orden de verdad del esquema.** Nunca editar
  tablas desde el panel de Supabase sin escribir la migración
  correspondiente; numeración secuencial en `supabase/migrations/`.
- **Aislamiento por empresa vía RLS, no en el código de la aplicación**
  (`select _aplica_rls_empresa('tabla')` en cada migración de tabla nueva).
- **Catálogos nuevos siguen el patrón `categoria`/`metodo_pago`:** tabla
  simple, RLS por empresa, columna `activo` en vez de borrado real, CRUD
  con el mismo guardado de `23503` (FK en uso) → `409`.
- **Roles y permisos en un solo lugar:** `lib/permisos.ts` (`Rol`,
  `Accion`, `puede()`). Ninguna pantalla ni ruta decide por su cuenta qué
  rol puede qué.
- **La máquina de estados de la orden vive solo en `lib/estados.ts`.**
  Ninguna pantalla ni ruta escribe `estado = 'x'` directo — todo pasa por
  `transicionar()`.
- **La web nunca habla de bytes de impresora.** Encolar con
  `lib/impresion.ts`; la traducción a ESC/POS o PPLB vive solo en
  `estacion/`.
- **DIAN y WhatsApp son stubs a propósito** (`lib/dian/proveedor.ts`,
  `lib/mensajeria/whatsapp.ts`) — no implementar a mano, son decisión de
  negocio pendiente (elegir integrador / conseguir cuenta Meta).
- **Snapshots, no referencias vivas, para lo que ya se cobró o imprimió.**
  `orden_item.descripcion` (Fase 5) sigue el mismo patrón que
  `cotizacion_item`: guarda el texto legible en el momento, no depende de
  que el catálogo no cambie después.
- **Probar manualmente contra datos desechables en producción antes de
  mergear** cualquier fase que toque dinero o estado de la orden (Fase 5,
  6, 7 de este plan) — no basta con las pruebas automatizadas.
