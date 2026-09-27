-- ============================================================================
-- 0026_auditoria_inventario.sql
-- Hoy `existencia` cambia en 4 sitios (venta, envío de traslado,
-- recepción de traslado, consumo en una orden) sin dejar ningún rastro
-- de quién, cuándo o por qué -- y no hay forma de ajustar una cantidad
-- a mano en absoluto. `mover_existencia` reemplaza a `consumir_repuesto`
-- (0004_caja.sql) y `sumar_existencia` (0014_traslados.sql) con una
-- sola función que hace el movimiento y su auditoría en la misma
-- transacción: no puede quedar la cantidad actualizada sin su renglón
-- de auditoría, ni viceversa.
--
-- Mismo espíritu que `orden_evento` (0001_base.sql): append-only, nunca
-- se edita ni se borra un movimiento ya escrito.
--
-- No se borran `consumir_repuesto` ni `sumar_existencia` -- quedan sin
-- uso desde el código de la aplicación (esta migración no las llama a
-- ellas, los call sites se migran en el mismo commit que trae esta
-- migración), pero borrarlas es un cambio aparte que no hace falta
-- para lo que pide esta migración.
-- ============================================================================

create table movimiento_inventario (
  id                bigserial primary key,
  empresa_id        uuid not null references empresa(id),
  sede_id           uuid references sede(id),
  repuesto_id       uuid references repuesto(id),
  articulo_id       uuid references articulo(id),
  tipo              text not null check (tipo in (
                      'recepcion','ajuste_manual','venta',
                      'traslado_envio','traslado_recepcion',
                      'consumo_orden','compra_recibida'
                    )),
  cantidad_anterior int,
  cantidad_nueva    int,
  diferencia        int,
  -- Solo para articulo_id: no tiene cantidad, tiene estado
  -- (en_stock/vendido/trasladado/anulado, 0016_articulos_inventario.sql).
  estado_anterior   text,
  estado_nuevo      text,
  motivo            text,
  autor_id          uuid references perfil(id),
  -- El id de lo que originó el movimiento -- una orden, un traslado o
  -- una repuesto_solicitud, según `tipo`. Sin FK propia a propósito:
  -- apunta a tablas distintas según el caso, como `apertura_cajon.venta_id`
  -- ya hace con un solo tipo, pero aquí son varios.
  referencia_id     uuid,
  ocurrido_en       timestamptz not null default now(),
  check (repuesto_id is not null or articulo_id is not null)
);

create index on movimiento_inventario (empresa_id, repuesto_id, ocurrido_en desc);
create index on movimiento_inventario (empresa_id, articulo_id, ocurrido_en desc);

select _aplica_rls_empresa('movimiento_inventario');

-- Mueve existencia de un repuesto (positivo o negativo) y deja auditoría
-- en la misma transacción. `p_delta` negativo es lo que antes hacía
-- consumir_repuesto; positivo, lo que hacía sumar_existencia.
--
-- A diferencia de consumir_repuesto (que dejaba una cantidad negativa
-- pasar sin avisar si a alguien se le ocurría llamarla con un delta
-- mayor a la existencia), esta sí rechaza dejar la cantidad en
-- negativo -- mismo criterio que las migraciones "endurecer_*"
-- anteriores (0010, 0011, 0015, 0017) ya aplicaron a otras funciones
-- de este mismo archivo de traslados.
create or replace function mover_existencia(
  p_repuesto_id uuid,
  p_sede_id uuid,
  p_delta int,
  p_tipo text,
  p_motivo text default null,
  p_referencia_id uuid default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_anterior int;
  v_nueva int;
begin
  -- Un delta positivo SÍ puede crear la fila (recibir algo por primera
  -- vez en una sede es legítimo -- lo que hacía sumar_existencia). Un
  -- delta negativo NO: si la fila no existe todavía, no hay nada que
  -- consumir, y un upsert con greatest(p_delta,0) la crearía en cero
  -- fingiendo un "anterior" que nunca existió -- justo el bug que
  -- consumir_repuesto no tenía (su "if not found" fallaba primero).
  if p_delta >= 0 then
    insert into existencia (repuesto_id, sede_id, empresa_id, cantidad)
    values (p_repuesto_id, p_sede_id, empresa_actual(), p_delta)
    on conflict (repuesto_id, sede_id) do update
      set cantidad = existencia.cantidad + p_delta
    returning cantidad - p_delta, cantidad into v_anterior, v_nueva;
  else
    update existencia
       set cantidad = cantidad + p_delta
     where repuesto_id = p_repuesto_id
       and sede_id = p_sede_id
       and empresa_id = empresa_actual()
    returning cantidad - p_delta, cantidad into v_anterior, v_nueva;

    if not found then
      raise exception 'no hay existencia registrada de % en la sede %', p_repuesto_id, p_sede_id;
    end if;
  end if;

  if v_nueva < 0 then
    raise exception 'No hay suficiente existencia: quedaría en % (delta %)', v_nueva, p_delta;
  end if;

  insert into movimiento_inventario (
    empresa_id, sede_id, repuesto_id, tipo,
    cantidad_anterior, cantidad_nueva, diferencia,
    motivo, autor_id, referencia_id
  ) values (
    empresa_actual(), p_sede_id, p_repuesto_id, p_tipo,
    v_anterior, v_nueva, p_delta,
    p_motivo, auth.uid(), p_referencia_id
  );

  return v_nueva;
end;
$$;

-- Revocar de public Y de anon desde el principio -- 0017 dejó anotado
-- que revocar solo de public no alcanza, porque anon tiene su propio
-- privilegio por defecto sobre funciones nuevas del esquema, no
-- heredado de public. No repetir ese error dos veces.
revoke execute on function mover_existencia(uuid, uuid, int, text, text, uuid) from public;
revoke execute on function mover_existencia(uuid, uuid, int, text, text, uuid) from anon;
grant execute on function mover_existencia(uuid, uuid, int, text, text, uuid) to authenticated;
