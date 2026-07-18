-- Funciones RPC de Fase 3: reservas, alertas y cobro por almacenaje.

-- ---------------------------------------------------------------
-- registrar_reserva / liberar_reserva
-- ---------------------------------------------------------------
create or replace function public.registrar_reserva(
  p_lote_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_observaciones text
)
returns public.reservas
language plpgsql
security invoker
as $$
declare
  v_usuario_id uuid;
  v_existencia_piezas integer;
  v_existencia_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_reserva public.reservas;
begin
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

grant execute on function public.registrar_reserva(uuid, uuid, integer, integer, text) to authenticated;

create or replace function public.liberar_reserva(p_reserva_id uuid)
returns public.reservas
language plpgsql
security invoker
as $$
declare
  v_reserva public.reservas;
begin
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

grant execute on function public.liberar_reserva(uuid) to authenticated;

-- ---------------------------------------------------------------
-- registrar_salida / registrar_movimiento_interno — se reemplazan para que
-- el disponible descuente también lo reservado (mismo nombre y firma que en
-- Fase 2, por eso `create or replace`).
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
  v_existencia_piezas integer;
  v_existencia_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
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
security invoker
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

-- ---------------------------------------------------------------
-- generar_alertas — antigüedad, ocupación, inventario bajo, caducidad.
-- No duplica: solo abre una alerta nueva si no hay una abierta del mismo
-- tipo+referencia. security definer para que el cron (sin sesión de
-- usuario) pueda ejecutarla; si la llama un usuario autenticado, exige
-- rol administrador/supervisor.
-- ---------------------------------------------------------------
create or replace function public.generar_alertas()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_config record;
begin
  if auth.uid() is not null and public.current_user_role() not in ('administrador', 'supervisor') then
    raise exception 'No autorizado';
  end if;

  select * into v_config from public.configuracion_alertas limit 1;
  if not found then
    insert into public.configuracion_alertas default values returning * into v_config;
  end if;

  insert into public.alertas (tipo, referencia_tabla, referencia_id, mensaje, nivel)
  select
    'dias_almacenados',
    'lotes',
    l.id,
    'Lote ' || l.codigo_lote || ' lleva ' || extract(day from now() - l.fecha_ingreso)::int || ' días almacenado',
    case
      when extract(day from now() - l.fecha_ingreso) >= v_config.umbral_dias_rojo then 'critico'
      when extract(day from now() - l.fecha_ingreso) >= v_config.umbral_dias_naranja then 'warning'
      else 'info'
    end
  from public.lotes l
  where l.estado = 'activo'
    and extract(day from now() - l.fecha_ingreso) >= v_config.umbral_dias_amarillo
    and not exists (
      select 1 from public.alertas a
      where a.tipo = 'dias_almacenados' and a.referencia_id = l.id and not a.atendida
    );

  insert into public.alertas (tipo, referencia_tabla, referencia_id, mensaje, nivel)
  select
    'ocupacion',
    'ubicaciones',
    u.id,
    'Ubicación ' || u.codigo || ' al ' ||
      round(100.0 * coalesce(sum(ilu.cantidad_tarimas), 0) / u.capacidad_max_tarimas)::text || '% de capacidad',
    'warning'
  from public.ubicaciones u
  left join public.inventario_lote_ubicacion ilu on ilu.ubicacion_id = u.id
  where u.activo
  group by u.id, u.codigo, u.capacidad_max_tarimas
  having 100.0 * coalesce(sum(ilu.cantidad_tarimas), 0) / u.capacidad_max_tarimas >= v_config.umbral_ocupacion_pct
    and not exists (
      select 1 from public.alertas a
      where a.tipo = 'ocupacion' and a.referencia_id = u.id and not a.atendida
    );

  insert into public.alertas (tipo, referencia_tabla, referencia_id, mensaje, nivel)
  select
    'caducidad',
    'lotes',
    l.id,
    'Lote ' || l.codigo_lote || ' caduca el ' || to_char(l.fecha_caducidad, 'DD/MM/YYYY'),
    case when l.fecha_caducidad <= current_date then 'critico' else 'warning' end
  from public.lotes l
  where l.estado = 'activo'
    and l.fecha_caducidad is not null
    and l.fecha_caducidad <= current_date + (v_config.umbral_caducidad_dias || ' days')::interval
    and not exists (
      select 1 from public.alertas a
      where a.tipo = 'caducidad' and a.referencia_id = l.id and not a.atendida
    );

  insert into public.alertas (tipo, referencia_tabla, referencia_id, mensaje, nivel)
  select
    'inventario_bajo',
    'productos',
    p.id,
    'Producto ' || p.nombre || ' (' || p.sku || ') con ' || coalesce(sum(ilu.cantidad_piezas), 0)::text ||
      ' piezas — por debajo del mínimo de ' || p.stock_minimo_piezas::text,
    'warning'
  from public.productos p
  left join public.lotes l on l.producto_id = p.id and l.estado = 'activo'
  left join public.inventario_lote_ubicacion ilu on ilu.lote_id = l.id
  where p.activo and p.stock_minimo_piezas is not null
  group by p.id, p.nombre, p.sku, p.stock_minimo_piezas
  having coalesce(sum(ilu.cantidad_piezas), 0) < p.stock_minimo_piezas
    and not exists (
      select 1 from public.alertas a
      where a.tipo = 'inventario_bajo' and a.referencia_id = p.id and not a.atendida
    );
end;
$$;

grant execute on function public.generar_alertas() to authenticated;

create or replace function public.marcar_alerta_atendida(p_alerta_id uuid)
returns public.alertas
language plpgsql
security invoker
as $$
declare
  v_usuario_id uuid;
  v_alerta public.alertas;
begin
  v_usuario_id := public.usuario_actual_id();
  update public.alertas
    set atendida = true, atendida_por = v_usuario_id, atendida_at = now()
    where id = p_alerta_id
    returning * into v_alerta;
  return v_alerta;
end;
$$;

grant execute on function public.marcar_alerta_atendida(uuid) to authenticated;

-- ---------------------------------------------------------------
-- calcular_cargo_lote / calcular_cargos_almacenaje — cobro acumulado.
-- Los escalones de tarifa siempre se interpretan en tarifa diaria
-- equivalente por tarima (ver comentario en tarifa_escalones); la
-- "tarimas_promedio" usada es la ocupación actual del lote, no un promedio
-- histórico ponderado.
-- ---------------------------------------------------------------
create or replace function public.calcular_cargo_lote(p_lote_id uuid)
returns public.cargos_almacenaje
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote record;
  v_cliente_id uuid;
  v_tarifa record;
  v_tarimas numeric;
  v_dias integer;
  v_total numeric := 0;
  v_escalon record;
  v_inicio integer;
  v_fin integer;
  v_dias_en_escalon integer;
  v_cargo public.cargos_almacenaje;
begin
  select l.*, p.cliente_id into v_lote
    from public.lotes l
    join public.productos p on p.id = l.producto_id
    where l.id = p_lote_id;

  if v_lote.id is null then
    raise exception 'El lote no existe';
  end if;
  v_cliente_id := v_lote.cliente_id;

  select coalesce(sum(cantidad_tarimas), 0) into v_tarimas
    from public.inventario_lote_ubicacion where lote_id = p_lote_id;

  v_dias := greatest(0, extract(day from now() - v_lote.fecha_ingreso)::int);

  select * into v_tarifa
    from public.tarifas_almacenaje
    where cliente_id = v_cliente_id and activo
    order by created_at desc
    limit 1;

  if v_tarifa.id is null or v_tarimas = 0 then
    -- Sin tarifa configurada (o sin existencia ya): no se genera cargo.
    delete from public.cargos_almacenaje where lote_id = p_lote_id;
    return null;
  end if;

  for v_escalon in
    select * from public.tarifa_escalones
    where tarifa_id = v_tarifa.id
    order by dia_inicio
  loop
    v_inicio := greatest(v_escalon.dia_inicio, 0);
    v_fin := least(coalesce(v_escalon.dia_fin, v_dias - 1), v_dias - 1);
    if v_fin >= v_inicio then
      v_dias_en_escalon := v_fin - v_inicio + 1;
      if not v_escalon.es_gratis then
        v_total := v_total + (v_dias_en_escalon * v_escalon.costo_por_tarima * v_tarimas);
      end if;
    end if;
  end loop;

  insert into public.cargos_almacenaje (
    lote_id, cliente_id, tarifa_id, periodo_desde, periodo_hasta, dias, tarimas_promedio, costo_calculado
  )
  values (
    p_lote_id, v_cliente_id, v_tarifa.id, v_lote.fecha_ingreso::date, current_date, v_dias, v_tarimas, v_total
  )
  on conflict (lote_id) do update
    set tarifa_id = excluded.tarifa_id,
        periodo_hasta = excluded.periodo_hasta,
        dias = excluded.dias,
        tarimas_promedio = excluded.tarimas_promedio,
        costo_calculado = excluded.costo_calculado,
        updated_at = now()
  returning * into v_cargo;

  return v_cargo;
end;
$$;

grant execute on function public.calcular_cargo_lote(uuid) to authenticated;

create or replace function public.calcular_cargos_almacenaje()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lote_id uuid;
begin
  if auth.uid() is not null and public.current_user_role() not in ('administrador', 'supervisor') then
    raise exception 'No autorizado';
  end if;

  for v_lote_id in select id from public.lotes where estado = 'activo' loop
    perform public.calcular_cargo_lote(v_lote_id);
  end loop;
end;
$$;

grant execute on function public.calcular_cargos_almacenaje() to authenticated;

-- ---------------------------------------------------------------
-- Auditoría (bitácora) sobre las tablas nuevas de Fase 3
-- ---------------------------------------------------------------
create trigger reservas_historial after insert or update on public.reservas
  for each row execute function public.registrar_historial();
create trigger auditorias_historial after insert or update on public.auditorias
  for each row execute function public.registrar_historial();
create trigger auditoria_detalle_historial after insert or update on public.auditoria_detalle
  for each row execute function public.registrar_historial();
create trigger tarifas_historial after insert or update on public.tarifas_almacenaje
  for each row execute function public.registrar_historial();

-- ---------------------------------------------------------------
-- Tareas programadas (requieren la extensión pg_cron habilitada en el
-- proyecto — Database → Extensions en el panel de Supabase si esta
-- sentencia falla).
-- ---------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'wms-generar-alertas-diario',
  '0 7 * * *',
  $$select public.generar_alertas();$$
);

select cron.schedule(
  'wms-calcular-cargos-diario',
  '0 6 * * *',
  $$select public.calcular_cargos_almacenaje();$$
);
