-- Bucket público para fotografías de producto (Fase 1). Los documentos de
-- entradas/salidas (facturas, cartas porte, etc.) se agregan en Fase 2 con
-- su propio bucket privado.

insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

create policy productos_fotos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'productos' and is_active_user());

create policy productos_fotos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'productos'
    and is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

create policy productos_fotos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'productos'
    and is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

create policy productos_fotos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'productos'
    and is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );
