# Plan 1 — Trazabilidad real del taller: solo falta la Fase 8

Documento fuente completo: `C:\Users\ZAETH\.claude\plans\vivid-splashing-elephant.md`
(no versionado en este repo). Las Fases 1-7 ya están mergeadas (ver
`CLAUDE.md`) — las Fases 5-7 se ejecutaron tal cual este documento las
diseñó, agrupadas en un solo PR (#27, Fase B del Plan 3) porque
comparten el mismo diseño de datos (`orden_item`) y no tenía sentido
partirlas en tres.

## Fase 8 — Historial visible para el staff

No depende de nada de las Fases 5-7 ya mergeadas — es la más
independiente de las cuatro originales, por eso quedó para el final.

- El hub (`orden/[id]/page.tsx`) gana una sección "Historial" que lista
  `orden_evento` de esa orden (ya se escribe en cada transición —
  `supabase/migrations/0001_base.sql:83-94`), reutilizando el mismo
  formato de timeline que ya renderiza
  `app/(publico)/seguimiento/[token]/page.tsx`, pero del lado del
  técnico/admin.
- Nueva ruta `GET /api/ordenes/[id]/eventos` (equivalente interno a lo
  que ya hace `app/api/seguimiento/[token]/route.ts`, pero autenticado
  en vez de por token público).

## Verificación

Mismo patrón de siempre: `npx tsc --noEmit`, `npx eslint` sobre los
archivos tocados, `npx vitest run`, `npm run build` antes de mergear.
Esta fase no toca dinero ni estado de la orden (solo lee `orden_evento`,
nunca lo escribe), así que no necesita la prueba manual en producción
que sí pidieron las Fases 5-7.

La prueba integral completa (equipo de muestra: entrada → QR →
diagnóstico → cotización → aprobación → reparación con consumo real →
verificar inventario/orden/cuenta → escanear QR en POS → cobrar →
entregar → cerrar) sigue pendiente como verificación final de todo el
Plan 1 — las Fases 5-7 se desplegaron a producción pero todavía no se
probaron a mano de punta a punta (ver la nota en `CLAUDE.md`, sección
Plan 3).
