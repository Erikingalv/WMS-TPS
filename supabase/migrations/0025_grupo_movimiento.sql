-- Un embarque o viaje consolidado (varios productos y/o clientes en el
-- mismo camión) hoy genera una fila de `entradas`/`salidas` por producto
-- (necesario: cada producto es su propio lote, con su propio seguimiento
-- de tarimas, cargos, etc.) — pero de cara al usuario debe verse y
-- documentarse como UN SOLO movimiento, no uno por producto.
--
-- `grupo_id` marca qué filas pertenecen al mismo movimiento consolidado
-- (todas las líneas capturadas juntas en un mismo envío del formulario
-- comparten el mismo grupo_id). Un movimiento capturado solo (sin
-- consolidar) también recibe su propio grupo_id — así "¿tiene hermanos
-- este movimiento?" es siempre la misma pregunta (¿hay más filas con este
-- grupo_id?), sin casos especiales.

alter table public.entradas add column grupo_id uuid;
alter table public.salidas add column grupo_id uuid;

create index entradas_grupo_idx on public.entradas (grupo_id);
create index salidas_grupo_idx on public.salidas (grupo_id);

-- Movimientos ya existentes: cada uno es su propio grupo de 1.
update public.entradas set grupo_id = id where grupo_id is null;
update public.salidas set grupo_id = id where grupo_id is null;

-- ---------------------------------------------------------------
-- registrar_entrada: agrega p_grupo_id.
-- ---------------------------------------------------------------
create or replace function public.registrar_entrada(
  p_cliente_id uuid,
  p_producto_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_fecha_movimiento date,
  p_hora_carga_descarga time,
  p_peso_kg numeric,
  p_recibio_usuario_id uuid,
  p_observaciones text,
  p_fecha_caducidad date default null,
  p_cajas_por_pallet integer default null,
  p_cantidad_por_caja integer default null,
  p_categoria_producto text default null,
  p_lote_1 text default null,
  p_lote_2 text default null,
  p_numero_contenedor text default null,
  p_numero_bl text default null,
  p_presentacion text default null,
  p_tarima_desde integer default null,
  p_tarima_hasta integer default null,
  p_tarimas_parciales jsonb default '[]'::jsonb,
  p_grupo_id uuid default null
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
  v_fecha timestamptz;
  v_entrada public.entradas;
  v_num_parciales integer;
  v_suma_parciales integer;
  v_grupo_id uuid;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  select count(*), coalesce(sum((elem->>'piezas')::integer), 0)
    into v_num_parciales, v_suma_parciales
    from jsonb_array_elements(p_tarimas_parciales) elem;

  if v_num_parciales > 0 then
    if exists (select 1 from jsonb_array_elements(p_tarimas_parciales) elem where (elem->>'piezas')::integer <= 0) then
      raise exception 'Las piezas de una tarima parcial deben ser mayores a 0';
    end if;
    if v_num_parciales > p_cantidad_tarimas then
      raise exception 'No puede haber más tarimas parciales que tarimas totales';
    end if;
    if v_suma_parciales > p_cantidad_piezas then
      raise exception 'La suma de piezas de las tarimas parciales no puede superar el total de piezas';
    end if;
  end if;

  v_fecha := (p_fecha_movimiento + p_hora_carga_descarga)::timestamptz;

  v_codigo_lote := 'L-' || to_char(now(), 'YYMMDD') || '-'
    || lpad(nextval('public.lotes_folio_seq')::text, 5, '0');

  insert into public.lotes (
    producto_id, codigo_lote, fecha_ingreso, fecha_caducidad,
    piezas_inicial, tarimas_inicial, qr_payload, tarima_desde, tarima_hasta,
    tarimas_parciales
  )
  values (
    p_producto_id, v_codigo_lote, v_fecha, p_fecha_caducidad,
    p_cantidad_piezas, p_cantidad_tarimas, v_codigo_lote, p_tarima_desde, p_tarima_hasta,
    p_tarimas_parciales
  )
  returning id into v_lote_id;

  insert into public.inventario_lote_ubicacion (lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas)
  values (v_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas)
  on conflict (lote_id, ubicacion_id) do update
    set cantidad_piezas = public.inventario_lote_ubicacion.cantidad_piezas + excluded.cantidad_piezas,
        cantidad_tarimas = public.inventario_lote_ubicacion.cantidad_tarimas + excluded.cantidad_tarimas,
        updated_at = now();

  v_grupo_id := coalesce(p_grupo_id, gen_random_uuid());

  insert into public.entradas (
    fecha, cliente_id, producto_id, lote_id, cantidad_piezas, cantidad_tarimas,
    peso_kg, ubicacion_id, recibio_usuario_id, observaciones, created_by,
    hora_carga_descarga, cajas_por_pallet, cantidad_por_caja, categoria_producto,
    lote_1, lote_2, numero_contenedor, numero_bl, presentacion,
    tarima_desde, tarima_hasta, tarimas_parciales, grupo_id
  )
  values (
    v_fecha, p_cliente_id, p_producto_id, v_lote_id, p_cantidad_piezas, p_cantidad_tarimas,
    p_peso_kg, p_ubicacion_id, p_recibio_usuario_id, p_observaciones, v_usuario_id,
    p_hora_carga_descarga, p_cajas_por_pallet, p_cantidad_por_caja, p_categoria_producto,
    p_lote_1, p_lote_2, p_numero_contenedor, p_numero_bl, p_presentacion,
    p_tarima_desde, p_tarima_hasta, p_tarimas_parciales, v_grupo_id
  )
  returning * into v_entrada;

  return v_entrada;
end;
$$;

grant execute on function public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, date, time, numeric, uuid, text,
  date, integer, integer, text, text, text, text, text, text, integer, integer, jsonb, uuid
) to authenticated;

-- ---------------------------------------------------------------
-- registrar_salida: agrega p_grupo_id.
-- ---------------------------------------------------------------
create or replace function public.registrar_salida(
  p_lote_id uuid,
  p_ubicacion_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_fecha_movimiento date,
  p_hora_carga_descarga time,
  p_destino text,
  p_transportista text,
  p_placas text,
  p_operador text,
  p_autorizo_usuario_id uuid,
  p_observaciones text,
  p_firma_digital_url text default null,
  p_cajas_por_pallet integer default null,
  p_cantidad_por_caja integer default null,
  p_categoria_producto text default null,
  p_lote_1 text default null,
  p_lote_2 text default null,
  p_numero_contenedor text default null,
  p_numero_bl text default null,
  p_presentacion text default null,
  p_tarima_desde integer default null,
  p_tarima_hasta integer default null,
  p_tarima_numeros integer[] default null,
  p_piezas_tarima_parcial integer default null,
  p_numero_tarima_parcial integer default null,
  p_grupo_id uuid default null
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
  v_fecha timestamptz;
  v_salida public.salidas;
  v_tarima_desde integer;
  v_tarima_hasta integer;
  v_grupo_id uuid;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  if p_piezas_tarima_parcial is not null and p_piezas_tarima_parcial > p_cantidad_piezas then
    raise exception 'Las piezas de la tarima parcial no pueden superar el total de piezas de la salida';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  v_fecha := (p_fecha_movimiento + p_hora_carga_descarga)::timestamptz;

  if p_tarima_numeros is not null and array_length(p_tarima_numeros, 1) > 0 then
    select min(x), max(x) into v_tarima_desde, v_tarima_hasta from unnest(p_tarima_numeros) as x;
  else
    v_tarima_desde := p_tarima_desde;
    v_tarima_hasta := p_tarima_hasta;
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

  v_grupo_id := coalesce(p_grupo_id, gen_random_uuid());

  insert into public.salidas (
    fecha, cliente_id, producto_id, lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas,
    destino, transportista, placas, operador, autorizo_usuario_id, observaciones,
    firma_digital_url, created_by,
    hora_carga_descarga, cajas_por_pallet, cantidad_por_caja, categoria_producto,
    lote_1, lote_2, numero_contenedor, numero_bl, presentacion,
    tarima_desde, tarima_hasta, tarima_numeros, piezas_tarima_parcial, numero_tarima_parcial, grupo_id
  )
  values (
    v_fecha, v_cliente_id, v_producto_id, p_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas,
    p_destino, p_transportista, p_placas, p_operador, p_autorizo_usuario_id, p_observaciones,
    p_firma_digital_url, v_usuario_id,
    p_hora_carga_descarga, p_cajas_por_pallet, p_cantidad_por_caja, p_categoria_producto,
    p_lote_1, p_lote_2, p_numero_contenedor, p_numero_bl, p_presentacion,
    v_tarima_desde, v_tarima_hasta, p_tarima_numeros, p_piezas_tarima_parcial, p_numero_tarima_parcial, v_grupo_id
  )
  returning * into v_salida;

  return v_salida;
end;
$$;

grant execute on function public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer, integer[], integer, integer, uuid
) to authenticated;
