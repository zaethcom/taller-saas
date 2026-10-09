-- ============================================================================
-- 0043_contacto_whatsapp.sql
-- Varios destinatarios de WhatsApp para /compras en vez de un solo
-- número de proveedor (0027). Cada empresa nombra sus contactos según
-- el tipo de pedido ("Mensajero", "Almacén", "Proveedor"...) y, al
-- enviar, elige a cuál va la lista de faltantes seleccionados.
--
-- Sigue siendo un enlace wa.me armado en el navegador -- no es una
-- integración con la API de WhatsApp. Ninguna otra tabla referencia
-- un contacto, así que borrarlo es borrado real, no "activo = false".
-- ============================================================================

create table contacto_whatsapp (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references empresa(id) on delete cascade,
  nombre      text not null,
  telefono    text not null,
  creado_en   timestamptz not null default now(),
  unique (empresa_id, nombre)
);

select _aplica_rls_empresa('contacto_whatsapp');

-- El número que ya estaba configurado sigue funcionando: pasa a ser el
-- contacto "Proveedor". empresa_config.whatsapp_proveedor se queda (sin
-- uso) para no romper un despliegue anterior que todavía lo lea.
insert into contacto_whatsapp (empresa_id, nombre, telefono)
select empresa_id, 'Proveedor', whatsapp_proveedor
from empresa_config
where coalesce(trim(whatsapp_proveedor), '') <> ''
on conflict do nothing;
