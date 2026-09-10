-- ============================================================================
-- 0005_impresion.sql
-- La cola de impresión. Cualquier dispositivo -- la tablet del POS, la del
-- técnico -- escribe una fila aquí. La estación de impresión de cada sede
-- la consulta cada dos segundos y ejecuta.
--
-- La carga va YA RESUELTA: texto y números listos para imprimir. La
-- estación no consulta la base ni calcula nada -- así es tonta, casi nunca
-- cambia, y cambiar el formato de un recibo no obliga a tocar el aparato.
-- ============================================================================

create table trabajo_impresion (
  id           uuid primary key default gen_random_uuid(),
  empresa_id   uuid not null references empresa(id),
  sede_id      uuid not null references sede(id),   -- decide qué estación lo toma
  tipo         text not null check (tipo in
                 ('etiqueta_qr','recibo_venta','comprobante_recepcion',
                  'cierre_caja','abrir_cajon')),
  carga        jsonb not null,
  estado       text not null default 'pendiente' check (estado in ('pendiente','impreso','error')),
  intentos     int  not null default 0,
  error        text,
  creado_por   uuid references perfil(id),
  creado_en    timestamptz not null default now(),
  impreso_en   timestamptz
);

-- La estación pregunta por esto cada dos segundos. Que sea barato.
create index on trabajo_impresion (sede_id, creado_en) where estado = 'pendiente';

select _aplica_rls_empresa('trabajo_impresion');

-- El límite de reintentos vive en la base, no solo en la estación:
-- así ningún cliente puede reintentar infinitamente un trabajo roto.
create or replace function marcar_resultado_impresion(
  p_id uuid, p_ok boolean, p_error text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_ok then
    update trabajo_impresion
       set estado = 'impreso', impreso_en = now()
     where id = p_id;
  else
    update trabajo_impresion
       set intentos = intentos + 1,
           error = p_error,
           estado = case when intentos + 1 >= 5 then 'error' else 'pendiente' end
     where id = p_id;
  end if;
end;
$$;
