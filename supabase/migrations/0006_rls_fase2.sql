-- Row Level Security — Fase 2.
-- Patrón: lectura para los 4 roles activos; escritura para
-- administrador/supervisor/capturista (consulta es siempre solo lectura).
-- Estas políticas también rigen las escrituras que hacen las funciones RPC
-- de 0005_funciones_fase2.sql, porque corren `security invoker`.

alter table public.lotes enable row level security;
alter table public.inventario_lote_ubicacion enable row level security;
alter table public.entradas enable row level security;
alter table public.salidas enable row level security;
alter table public.movimientos_internos enable row level security;
alter table public.archivos_adjuntos enable row level security;
alter table public.historial_movimientos enable row level security;

-- ---------------------------------------------------------------
-- lotes
-- ---------------------------------------------------------------
create policy lotes_select on public.lotes
  for select to authenticated using (is_active_user());

create policy lotes_insert on public.lotes
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

create policy lotes_update on public.lotes
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- inventario_lote_ubicacion
-- ---------------------------------------------------------------
create policy inventario_select on public.inventario_lote_ubicacion
  for select to authenticated using (is_active_user());

create policy inventario_insert on public.inventario_lote_ubicacion
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

create policy inventario_update on public.inventario_lote_ubicacion
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- entradas — inmutables: sin política de update/delete
-- ---------------------------------------------------------------
create policy entradas_select on public.entradas
  for select to authenticated using (is_active_user());

create policy entradas_insert on public.entradas
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- salidas — inmutables: sin política de update/delete
-- ---------------------------------------------------------------
create policy salidas_select on public.salidas
  for select to authenticated using (is_active_user());

create policy salidas_insert on public.salidas
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- movimientos_internos — inmutables
-- ---------------------------------------------------------------
create policy movimientos_select on public.movimientos_internos
  for select to authenticated using (is_active_user());

create policy movimientos_insert on public.movimientos_internos
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- archivos_adjuntos
-- ---------------------------------------------------------------
create policy archivos_select on public.archivos_adjuntos
  for select to authenticated using (is_active_user());

create policy archivos_insert on public.archivos_adjuntos
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- historial_movimientos — solo lectura vía RLS; la escritura ocurre
-- exclusivamente dentro de la función security definer del trigger.
-- ---------------------------------------------------------------
create policy historial_select on public.historial_movimientos
  for select to authenticated using (is_active_user());
