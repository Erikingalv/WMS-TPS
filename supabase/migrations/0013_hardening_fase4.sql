-- Fase 4: endurecimiento de seguridad, hallazgos de la auditoría de RLS.
--
-- 1) usuarios_select era demasiado restrictiva: un no-administrador solo se
--    veía a sí mismo, lo que rompía en silencio los selectores "Recibió"
--    (Entradas), "Autorizó" (Salidas) y el filtro de usuario en Historial
--    para cualquier capturista/supervisor. Ahora cualquier activo ve a los
--    demás usuarios activos; las cuentas desactivadas solo las ve el propio
--    usuario o un administrador.
--
-- 2) registrar_entrada/salida/movimiento_interno/reserva y liberar_reserva
--    corrían `security invoker`, lo que obligaba a dar permiso de insert
--    directo en entradas/salidas/movimientos_internos/reservas/lotes/
--    inventario_lote_ubicacion. Ese permiso también habilitaba a cualquier
--    capturista a hacer `supabase.from("entradas").insert(...)` a mano,
--    creando un movimiento "fantasma" sin pasar por la lógica atómica y sin
--    tocar el inventario real. Se convierten a `security definer` con su
--    propia verificación de rol adentro, y se retira el permiso de
--    escritura directa a esas tablas: de aquí en adelante solo se puede
--    escribir en ellas a través de la función correspondiente.

-- ---------------------------------------------------------------
-- 1) usuarios_select
-- ---------------------------------------------------------------
drop policy usuarios_select on public.usuarios;

create policy usuarios_select on public.usuarios
  for select to authenticated
  using (
    is_active_user()
    and (
      activo = true
      or auth_user_id = auth.uid()
      or current_user_role() = 'administrador'
    )
  );

-- ---------------------------------------------------------------
-- 2) Funciones a security definer con verificación de rol interna
-- ---------------------------------------------------------------
create or replace function public.registrar_entrada(
  p_cliente_id uuid,
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_peso_kg numeric,
  p_recibio_usuario_id uuid,
  p_observaciones text,
  p_fecha_caducidad date default null
)
returns public.entradas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_lote_id uuid;
  v_codigo_lote text;
  v_entrada public.entradas;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  v_codigo_lote := 'L-' || to_char(now(), 'YYMMDD') || '-'
    || lpad(nextval('public.lotes_folio_seq')::text, 5, '0');

  insert into public.lotes (
    producto_id, codigo_lote, fecha_ingreso, fecha_caducidad,
    piezas_inicial, tarimas_inicial, qr_payload
  )
  values (
    p_producto_id, v_codigo_lote, now(), p_fecha_caducidad,
    p_cantidad_piezas, p_cantidad_tarimas, v_codigo_lote
  )
  returning id into v_lote_id;

  insert into public.inventario_lote_ubicacion (lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas)
  values (v_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas)
  on conflict (lote_id, ubicacion_id) do update
    set cantidad_piezas = public.inventario_lote_ubicacion.cantidad_piezas + excluded.cantidad_piezas,
        cantidad_tarimas = public.inventario_lote_ubicacion.cantidad_tarimas + excluded.cantidad_tarimas,
        updated_at = now();

  insert into public.entradas (
    fecha, cliente_id, producto_id, lote_id, cantidad_piezas, cantidad_tarimas,
    peso_kg, ubicacion_id, recibio_usuario_id, observaciones, created_by
  )
  values (
    now(), p_cliente_id, p_producto_id, v_lote_id, p_cantidad_piezas, p_cantidad_tarimas,
    p_peso_kg, p_ubicacion_id, p_recibio_usuario_id, p_observaciones, v_usuario_id
  )
  returning * into v_entrada;

  return v_entrada;
end;
$$;

create or replace function public.registrar_salida(
  p_lote_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_destino text,
  p_transportista text,
  p_placas text,
  p_operador text,
  p_autorizo_usuario_id uuid,
  p_observaciones text,
  p_firma_digital_url text default null
)
returns public.salidas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_producto_id uuid;
  v_cliente_id uuid;
  v_existencia_piezas integer;
  v_existencia_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_disponible_piezas integer;
  v_disponible_tarimas integer;
  v_queda_algo boolean;
  v_salida public.salidas;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  select producto_id into v_producto_id from public.lotes where id = p_lote_id;
  if v_producto_id is null then
    raise exception 'El lote no existe';
  end if;
  select cliente_id into v_cliente_id from public.productos where id = v_producto_id;

  select cantidad_piezas, cantidad_tarimas
    into v_existencia_piezas, v_existencia_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id
    for update;

  if v_existencia_piezas is null then
    raise exception 'Ese lote no tiene existencia en la ubicación indicada';
  end if;

  select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
    into v_reservado_piezas, v_reservado_tarimas
    from public.reservas
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id and estado = 'activa';

  v_disponible_piezas := v_existencia_piezas - v_reservado_piezas;
  v_disponible_tarimas := v_existencia_tarimas - v_reservado_tarimas;

  if v_disponible_piezas < p_cantidad_piezas or v_disponible_tarimas < p_cantidad_tarimas then
    raise exception 'Inventario insuficiente: disponible % piezas / % tarimas (parte puede estar reservada)',
      v_disponible_piezas, v_disponible_tarimas;
  end if;

  update public.inventario_lote_ubicacion
    set cantidad_piezas = cantidad_piezas - p_cantidad_piezas,
        cantidad_tarimas = cantidad_tarimas - p_cantidad_tarimas,
        updated_at = now()
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id;

  select exists(
    select 1 from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and (cantidad_piezas > 0 or cantidad_tarimas > 0)
  ) into v_queda_algo;

  update public.lotes
    set estado = case when v_queda_algo then 'activo' else 'agotado' end
    where id = p_lote_id;

  insert into public.salidas (
    fecha, cliente_id, producto_id, lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas,
    destino, transportista, placas, operador, autorizo_usuario_id, observaciones,
    firma_digital_url, created_by
  )
  values (
    now(), v_cliente_id, v_producto_id, p_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas,
    p_destino, p_transportista, p_placas, p_operador, p_autorizo_usuario_id, p_observaciones,
    p_firma_digital_url, v_usuario_id
  )
  returning * into v_salida;

  return v_salida;
end;
$$;

create or replace function public.registrar_movimiento_interno(
  p_lote_id uuid,
  p_ubicacion_origen_id uuid,
  p_ubicacion_destino_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_motivo text
)
returns public.movimientos_internos
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_existencia_piezas integer;
  v_existencia_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_disponible_piezas integer;
  v_disponible_tarimas integer;
  v_capacidad integer;
  v_ocupacion_destino integer;
  v_movimiento public.movimientos_internos;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  if p_ubicacion_origen_id = p_ubicacion_destino_id then
    raise exception 'La ubicación destino debe ser distinta a la de origen';
  end if;

  select cantidad_piezas, cantidad_tarimas
    into v_existencia_piezas, v_existencia_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id
    for update;

  if v_existencia_piezas is null then
    raise exception 'Ese lote no tiene existencia en la ubicación de origen';
  end if;

  select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
    into v_reservado_piezas, v_reservado_tarimas
    from public.reservas
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id and estado = 'activa';

  v_disponible_piezas := v_existencia_piezas - v_reservado_piezas;
  v_disponible_tarimas := v_existencia_tarimas - v_reservado_tarimas;

  if v_disponible_piezas < p_cantidad_piezas or v_disponible_tarimas < p_cantidad_tarimas then
    raise exception 'Inventario insuficiente en la ubicación de origen (parte puede estar reservada)';
  end if;

  select capacidad_max_tarimas into v_capacidad
    from public.ubicaciones where id = p_ubicacion_destino_id;

  select coalesce(sum(cantidad_tarimas), 0) into v_ocupacion_destino
    from public.inventario_lote_ubicacion
    where ubicacion_id = p_ubicacion_destino_id;

  if v_ocupacion_destino + p_cantidad_tarimas > v_capacidad then
    raise exception 'La ubicación destino no tiene capacidad suficiente (% de % tarimas ocupadas)',
      v_ocupacion_destino, v_capacidad;
  end if;

  update public.inventario_lote_ubicacion
    set cantidad_piezas = cantidad_piezas - p_cantidad_piezas,
        cantidad_tarimas = cantidad_tarimas - p_cantidad_tarimas,
        updated_at = now()
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id;

  insert into public.inventario_lote_ubicacion (lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas)
  values (p_lote_id, p_ubicacion_destino_id, p_cantidad_piezas, p_cantidad_tarimas)
  on conflict (lote_id, ubicacion_id) do update
    set cantidad_piezas = public.inventario_lote_ubicacion.cantidad_piezas + excluded.cantidad_piezas,
        cantidad_tarimas = public.inventario_lote_ubicacion.cantidad_tarimas + excluded.cantidad_tarimas,
        updated_at = now();

  insert into public.movimientos_internos (
    lote_id, ubicacion_origen_id, ubicacion_destino_id, cantidad_piezas, cantidad_tarimas, motivo, usuario_id
  )
  values (
    p_lote_id, p_ubicacion_origen_id, p_ubicacion_destino_id, p_cantidad_piezas, p_cantidad_tarimas, p_motivo, v_usuario_id
  )
  returning * into v_movimiento;

  return v_movimiento;
end;
$$;

create or replace function public.registrar_reserva(
  p_lote_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_observaciones text
)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_existencia_piezas integer;
  v_existencia_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_reserva public.reservas;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  select cantidad_piezas, cantidad_tarimas
    into v_existencia_piezas, v_existencia_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id
    for update;

  if v_existencia_piezas is null then
    raise exception 'Ese lote no tiene existencia en la ubicación indicada';
  end if;

  select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
    into v_reservado_piezas, v_reservado_tarimas
    from public.reservas
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id and estado = 'activa';

  if (v_existencia_piezas - v_reservado_piezas) < p_cantidad_piezas
     or (v_existencia_tarimas - v_reservado_tarimas) < p_cantidad_tarimas then
    raise exception 'No hay disponible suficiente para reservar (disponible % pz / % tar)',
      v_existencia_piezas - v_reservado_piezas, v_existencia_tarimas - v_reservado_tarimas;
  end if;

  insert into public.reservas (
    lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas, usuario_id, observaciones
  )
  values (p_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas, v_usuario_id, p_observaciones)
  returning * into v_reserva;

  return v_reserva;
end;
$$;

create or replace function public.liberar_reserva(p_reserva_id uuid)
returns public.reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva public.reservas;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  update public.reservas
    set estado = 'liberada', fecha_liberacion = now()
    where id = p_reserva_id and estado = 'activa'
    returning * into v_reserva;

  if v_reserva.id is null then
    raise exception 'La reserva no existe o ya no está activa';
  end if;

  return v_reserva;
end;
$$;

-- ---------------------------------------------------------------
-- 3) Se retira el insert/update directo: a partir de aquí solo se escribe
--    en estas tablas a través de las funciones de arriba.
-- ---------------------------------------------------------------
drop policy lotes_insert on public.lotes;
drop policy lotes_update on public.lotes;
drop policy inventario_insert on public.inventario_lote_ubicacion;
drop policy inventario_update on public.inventario_lote_ubicacion;
drop policy entradas_insert on public.entradas;
drop policy salidas_insert on public.salidas;
drop policy movimientos_insert on public.movimientos_internos;
drop policy reservas_insert on public.reservas;
drop policy reservas_update on public.reservas;
