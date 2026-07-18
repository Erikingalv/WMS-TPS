-- Row Level Security — Fase 3.

alter table public.reservas enable row level security;
alter table public.auditorias enable row level security;
alter table public.auditoria_detalle enable row level security;
alter table public.alertas enable row level security;
alter table public.configuracion_alertas enable row level security;
alter table public.tarifas_almacenaje enable row level security;
alter table public.tarifa_escalones enable row level security;
alter table public.cargos_almacenaje enable row level security;

-- ---------------------------------------------------------------
-- reservas — lectura: los 4 roles · escritura: admin, supervisor, capturista
-- ---------------------------------------------------------------
create policy reservas_select on public.reservas
  for select to authenticated using (is_active_user());

create policy reservas_insert on public.reservas
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

create policy reservas_update on public.reservas
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor', 'capturista'));

-- ---------------------------------------------------------------
-- auditorías — lectura: los 4 roles · escritura: admin, supervisor
-- ---------------------------------------------------------------
create policy auditorias_select on public.auditorias
  for select to authenticated using (is_active_user());

create policy auditorias_insert on public.auditorias
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy auditorias_update on public.auditorias
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy auditoria_detalle_select on public.auditoria_detalle
  for select to authenticated using (is_active_user());

create policy auditoria_detalle_insert on public.auditoria_detalle
  for insert to authenticated
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy auditoria_detalle_update on public.auditoria_detalle
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

-- ---------------------------------------------------------------
-- alertas — lectura: los 4 roles · "atender" (update): admin, supervisor ·
-- sin insert vía RLS: solo la escribe generar_alertas() (security definer).
-- ---------------------------------------------------------------
create policy alertas_select on public.alertas
  for select to authenticated using (is_active_user());

create policy alertas_update on public.alertas
  for update to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'))
  with check (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy configuracion_alertas_select on public.configuracion_alertas
  for select to authenticated using (is_active_user());

create policy configuracion_alertas_update on public.configuracion_alertas
  for update to authenticated
  using (is_active_user() and current_user_role() = 'administrador')
  with check (is_active_user() and current_user_role() = 'administrador');

-- ---------------------------------------------------------------
-- tarifas — información comercial: visible solo para admin/supervisor;
-- escritura solo administrador.
-- ---------------------------------------------------------------
create policy tarifas_select on public.tarifas_almacenaje
  for select to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy tarifas_insert on public.tarifas_almacenaje
  for insert to authenticated
  with check (is_active_user() and current_user_role() = 'administrador');

create policy tarifas_update on public.tarifas_almacenaje
  for update to authenticated
  using (is_active_user() and current_user_role() = 'administrador')
  with check (is_active_user() and current_user_role() = 'administrador');

create policy tarifa_escalones_select on public.tarifa_escalones
  for select to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'));

create policy tarifa_escalones_insert on public.tarifa_escalones
  for insert to authenticated
  with check (is_active_user() and current_user_role() = 'administrador');

create policy tarifa_escalones_update on public.tarifa_escalones
  for update to authenticated
  using (is_active_user() and current_user_role() = 'administrador')
  with check (is_active_user() and current_user_role() = 'administrador');

create policy tarifa_escalones_delete on public.tarifa_escalones
  for delete to authenticated
  using (is_active_user() and current_user_role() = 'administrador');

-- ---------------------------------------------------------------
-- cargos_almacenaje — solo lectura para admin/supervisor; lo escribe
-- exclusivamente calcular_cargo_lote() (security definer).
-- ---------------------------------------------------------------
create policy cargos_select on public.cargos_almacenaje
  for select to authenticated
  using (is_active_user() and current_user_role() in ('administrador', 'supervisor'));
