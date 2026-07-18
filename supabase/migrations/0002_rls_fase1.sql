-- Row Level Security — Fase 1.
-- Regla transversal: una cuenta desactivada (usuarios.activo = false) pierde
-- acceso de lectura/escritura aunque su sesión de Supabase Auth siga vigente.

create or replace function public.is_active_user()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select activo from public.usuarios where auth_user_id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_active_user() to authenticated;

alter table public.usuarios enable row level security;
alter table public.clientes enable row level security;
alter table public.productos enable row level security;
alter table public.ubicaciones enable row level security;

-- ---------------------------------------------------------------
-- usuarios
-- ---------------------------------------------------------------
create policy usuarios_select on public.usuarios
  for select to authenticated
  using (
    is_active_user()
    and (auth_user_id = auth.uid() or current_user_role() = 'administrador')
  );

create policy usuarios_insert on public.usuarios
  for insert to authenticated
  with check (is_active_user() and current_user_role() = 'administrador');

create policy usuarios_update on public.usuarios
  for update to authenticated
  using (is_active_user() and current_user_role() = 'administrador')
  with check (is_active_user() and current_user_role() = 'administrador');

-- Sin política de delete: las cuentas se desactivan (activo = false), no se
-- eliminan, para conservar la autoría de todo lo que hayan registrado.

-- ---------------------------------------------------------------
-- clientes — lectura: los 4 roles · escritura: admin, supervisor, capturista
-- ---------------------------------------------------------------
create policy clientes_select on public.clientes
  for select to authenticated
  using (is_active_user());

create policy clientes_insert on public.clientes
  for insert to authenticated
  with check (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

create policy clientes_update on public.clientes
  for update to authenticated
  using (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  )
  with check (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

-- ---------------------------------------------------------------
-- productos — mismas reglas que clientes
-- ---------------------------------------------------------------
create policy productos_select on public.productos
  for select to authenticated
  using (is_active_user());

create policy productos_insert on public.productos
  for insert to authenticated
  with check (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

create policy productos_update on public.productos
  for update to authenticated
  using (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  )
  with check (
    is_active_user()
    and current_user_role() in ('administrador', 'supervisor', 'capturista')
  );

-- ---------------------------------------------------------------
-- ubicaciones — lectura: los 4 roles · escritura: admin, supervisor
-- ---------------------------------------------------------------
create policy ubicaciones_select on public.ubicaciones
  for select to authenticated
  using (is_active_user());

create policy ubicaciones_insert on public.ubicaciones
  for insert to authenticated
  with check (
    is_active_user() and current_user_role() in ('administrador', 'supervisor')
  );

create policy ubicaciones_update on public.ubicaciones
  for update to authenticated
  using (
    is_active_user() and current_user_role() in ('administrador', 'supervisor')
  )
  with check (
    is_active_user() and current_user_role() in ('administrador', 'supervisor')
  );
