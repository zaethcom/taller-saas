-- ============================================================================
-- 0031_impresora_sede.sql
-- Configuración de las impresoras de cada sede, editable desde la web
-- en vez de un archivo config.json que solo se puede tocar a mano en el
-- dispositivo. Mismo shape que ConfigImpresora de estacion/destino.ts
-- (host/puerto/protocolo) para no traducir nada entre los dos lados:
-- "crudo" es una impresora de red real por IP; "puente_android" es una
-- impresora USB local, servida por el puente Android que ya existe.
-- ============================================================================

create table impresora_sede (
  sede_id             uuid primary key references sede(id) on delete cascade,
  empresa_id          uuid not null references empresa(id),
  tickets_host        text,
  tickets_puerto      int not null default 9100,
  tickets_protocolo   text not null default 'crudo' check (tickets_protocolo in ('crudo','puente_android')),
  etiquetas_host      text,
  etiquetas_puerto    int not null default 9100,
  etiquetas_protocolo text not null default 'crudo' check (etiquetas_protocolo in ('crudo','puente_android')),
  actualizado_en      timestamptz not null default now()
);

select _aplica_rls_empresa('impresora_sede');
