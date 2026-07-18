-- Bucket para fotografías y documentos de entradas/salidas (factura, carta
-- porte, packing list, orden de compra). Público como el de productos, por
-- simplicidad y consistencia — las rutas usan UUIDs no adivinables. Si en el
-- futuro se requiere blindar el acceso, migrar a bucket privado + URLs
-- firmadas sin tocar el resto de la app (el storage_path no cambia).

insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', true)
on conflict (id) do nothing;

create policy documentos_select on storage.objects
  for select to authenticated
  using (bucket_id = 'documentos' and is_active_user());

create policy documentos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documentos'
    and is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

create policy documentos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documentos'
    and is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );
