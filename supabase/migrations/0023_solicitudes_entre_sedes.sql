-- ============================================================================
-- 0023_solicitudes_entre_sedes.sql
-- Pedirle un repuesto a la otra sede antes de salir a comprarlo.
--
-- El inventario a granel es por sede (existencia, clave (repuesto_id, sede_id))
-- y cada consumo descuenta de la sede propia. Cuando el almacén vive en un
-- local y las reparaciones ocurren en el otro, al técnico solo le quedaban dos
-- caminos: consumir de una existencia que no tiene, o marcar faltante -- que
-- significa comprar algo que la empresa ya posee, a treinta metros.
--
-- Esta migración mete el paso que faltaba al principio del ciclo. Ver la
-- máquina de estados completa en lib/solicitudes.ts, que es la fuente única:
-- aquí solo está el check que impide que la base guarde un estado que ese
-- archivo no reconoce.
-- ============================================================================

alter table repuesto_solicitud
  -- Un pedido al almacén puede no venir de una orden: en el mostrador se
  -- acaba algo y hay que registrarlo igual. Las filas viejas siguen
  -- teniendo su orden, que es de donde nacieron.
  alter column orden_id drop not null;

alter table repuesto_solicitud
  -- Qué repuesto del catálogo, cuando se sabe. Un faltante puede seguir
  -- siendo texto libre (algo que no está dado de alta todavía), pero para
  -- pedirlo a otra sede hay que poder mirar SU existencia y trasladarlo.
  add column repuesto_id         uuid references repuesto(id),
  add column sede_solicitante_id uuid references sede(id),
  add column sede_proveedora_id  uuid references sede(id),
  -- El traslado que lo despachó, para poder cerrar la solicitud cuando
  -- el destino confirme la recepción.
  add column traslado_id         uuid references traslado(id),
  add column despachado_en       timestamptz;

-- Pedirle algo a la propia sede no significa nada.
alter table repuesto_solicitud
  add constraint repuesto_solicitud_sedes_distintas
  check (sede_proveedora_id is null
         or sede_solicitante_id is null
         or sede_proveedora_id <> sede_solicitante_id);

-- Un pedido a otra sede necesita saber QUÉ repuesto es: sin repuesto_id no
-- se puede consultar existencia ni armar el traslado.
alter table repuesto_solicitud
  add constraint repuesto_solicitud_pedido_necesita_repuesto
  check (estado <> 'pedido_a_sede' or repuesto_id is not null);

-- El estado era texto libre con un comentario al lado. Se cierra: un typo
-- dejaba una fila fuera de todas las bandejas, invisible para siempre.
alter table repuesto_solicitud
  add constraint repuesto_solicitud_estado_check
  check (estado in ('pedido_a_sede','en_traslado','faltante','solicitado','recibido','consumido'));

-- La bandeja del almacén: "qué me están pidiendo". Es la consulta que se
-- hace cada vez que alguien abre esa pantalla.
create index on repuesto_solicitud (sede_proveedora_id, estado);
