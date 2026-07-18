-- Funciones RPC para Fase 2. La app NUNCA hace insert directo en
-- entradas/salidas/movimientos_internos: siempre pasa por aquí, para que
-- crear el lote, mover el inventario y registrar el movimiento ocurran en
-- una sola transacción atómica (evita condiciones de carrera entre usuarios
-- concurrentes — ver documento de diseño, sección Riesgos técnicos).
--
-- security invoker: corren con los permisos del usuario que llama, así que
-- las políticas RLS de cada tabla se siguen aplicando normalmente.

create or replace function public.usuario_actual_id()
returns uuid
language sql
security invoker
stable
as $$
  select id from public.usuarios where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------
-- registrar_entrada
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
security invoker
as $$
declare
  v_usuario_id uuid;
  v_lote_id uuid;
  v_codigo_lote text;
  v_entrada public.entradas;
begin
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

grant execute on function public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, numeric, uuid, text, date
) to authenticated;

-- ---------------------------------------------------------------
-- registrar_salida
-- ---------------------------------------------------------------
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
security invoker
as $$
declare
  v_usuario_id uuid;
  v_producto_id uuid;
  v_cliente_id uuid;
  v_disponible_piezas integer;
  v_disponible_tarimas integer;
  v_queda_algo boolean;
  v_salida public.salidas;
begin
  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  select producto_id into v_producto_id from public.lotes where id = p_lote_id;
  if v_producto_id is null then
    raise exception 'El lote no existe';
  end if;
  select cliente_id into v_cliente_id from public.productos where id = v_producto_id;

  -- FOR UPDATE bloquea la fila hasta el commit: dos salidas concurrentes del
  -- mismo lote/ubicación se serializan en vez de leer el mismo disponible.
  select cantidad_piezas, cantidad_tarimas
    into v_disponible_piezas, v_disponible_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_id
    for update;

  if v_disponible_piezas is null then
    raise exception 'Ese lote no tiene existencia en la ubicación indicada';
  end if;

  if v_disponible_piezas < p_cantidad_piezas or v_disponible_tarimas < p_cantidad_tarimas then
    raise exception 'Inventario insuficiente: disponible % piezas / % tarimas',
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

grant execute on function public.registrar_salida(
  uuid, uuid, integer, integer, text, text, text, text, uuid, text, text
) to authenticated;

-- ---------------------------------------------------------------
-- registrar_movimiento_interno
-- ---------------------------------------------------------------
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
security invoker
as $$
declare
  v_usuario_id uuid;
  v_disponible_piezas integer;
  v_disponible_tarimas integer;
  v_capacidad integer;
  v_ocupacion_destino integer;
  v_movimiento public.movimientos_internos;
begin
  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  if p_ubicacion_origen_id = p_ubicacion_destino_id then
    raise exception 'La ubicación destino debe ser distinta a la de origen';
  end if;

  select cantidad_piezas, cantidad_tarimas
    into v_disponible_piezas, v_disponible_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id
    for update;

  if v_disponible_piezas is null
     or v_disponible_piezas < p_cantidad_piezas
     or v_disponible_tarimas < p_cantidad_tarimas then
    raise exception 'Inventario insuficiente en la ubicación de origen';
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

grant execute on function public.registrar_movimiento_interno(
  uuid, uuid, uuid, integer, integer, text
) to authenticated;

-- ---------------------------------------------------------------
-- Bitácora de auditoría — trigger genérico
-- ---------------------------------------------------------------
create or replace function public.registrar_historial()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_headers json;
begin
  v_usuario_id := public.usuario_actual_id();

  begin
    v_headers := current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;

  insert into public.historial_movimientos (
    tabla_afectada, registro_id, tipo_movimiento, usuario_id, ip, dispositivo,
    datos_antes, datos_despues
  )
  values (
    TG_TABLE_NAME,
    coalesce(NEW.id, OLD.id),
    lower(TG_OP),
    v_usuario_id,
    v_headers ->> 'x-forwarded-for',
    v_headers ->> 'user-agent',
    case when TG_OP = 'INSERT' then null else to_jsonb(OLD) end,
    case when TG_OP = 'DELETE' then null else to_jsonb(NEW) end
  );

  return coalesce(NEW, OLD);
end;
$$;

create trigger clientes_historial after insert or update on public.clientes
  for each row execute function public.registrar_historial();
create trigger productos_historial after insert or update on public.productos
  for each row execute function public.registrar_historial();
create trigger ubicaciones_historial after insert or update on public.ubicaciones
  for each row execute function public.registrar_historial();
create trigger usuarios_historial after insert or update on public.usuarios
  for each row execute function public.registrar_historial();
create trigger lotes_historial after insert or update on public.lotes
  for each row execute function public.registrar_historial();
create trigger entradas_historial after insert on public.entradas
  for each row execute function public.registrar_historial();
create trigger salidas_historial after insert on public.salidas
  for each row execute function public.registrar_historial();
create trigger movimientos_internos_historial after insert on public.movimientos_internos
  for each row execute function public.registrar_historial();
