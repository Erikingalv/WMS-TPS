-- Salidas: además del rango (tarima_desde/tarima_hasta, ya existente),
-- ahora se puede guardar la lista exacta de tarimas que salieron —
-- necesario porque una salida no siempre es un rango continuo (ej.
-- "salieron las tarimas 1, 5, 15, 16 y 17", no "de la 1 a la 20").
--
-- tarima_desde/tarima_hasta se siguen llenando (como min/max de la lista)
-- para no romper reportes, comprobante y el resumen del historial que ya
-- los usan; tarima_numeros trae el detalle exacto.

alter table public.salidas
  add column tarima_numeros integer[];

drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer
);

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
  p_tarima_numeros integer[] default null
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
  v_tarima_desde integer;
  v_tarima_hasta integer;
  v_salida public.salidas;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
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

  insert into public.salidas (
    fecha, cliente_id, producto_id, lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas,
    destino, transportista, placas, operador, autorizo_usuario_id, observaciones,
    firma_digital_url, created_by,
    hora_carga_descarga, cajas_por_pallet, cantidad_por_caja, categoria_producto,
    lote_1, lote_2, numero_contenedor, numero_bl, presentacion,
    tarima_desde, tarima_hasta, tarima_numeros
  )
  values (
    v_fecha, v_cliente_id, v_producto_id, p_lote_id, p_ubicacion_id, p_cantidad_piezas, p_cantidad_tarimas,
    p_destino, p_transportista, p_placas, p_operador, p_autorizo_usuario_id, p_observaciones,
    p_firma_digital_url, v_usuario_id,
    p_hora_carga_descarga, p_cajas_por_pallet, p_cantidad_por_caja, p_categoria_producto,
    p_lote_1, p_lote_2, p_numero_contenedor, p_numero_bl, p_presentacion,
    v_tarima_desde, v_tarima_hasta, p_tarima_numeros
  )
  returning * into v_salida;

  return v_salida;
end;
$$;

grant execute on function public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer, integer[]
) to authenticated;

-- ---------------------------------------------------------------
-- corregir_salida: mismo tratamiento para el arreglo de tarimas.
-- ---------------------------------------------------------------
create or replace function public.corregir_salida(
  p_salida_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_destino text default null,
  p_transportista text default null,
  p_placas text default null,
  p_operador text default null,
  p_observaciones text default null,
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
  p_tarima_numeros integer[] default null
)
returns public.salidas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_salida public.salidas;
  v_delta_piezas integer;
  v_delta_tarimas integer;
  v_inv_piezas integer;
  v_inv_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_tarima_desde integer;
  v_tarima_hasta integer;
begin
  if not is_active_user() or current_user_role() <> 'administrador' then
    raise exception 'Solo un administrador puede corregir movimientos ya registrados';
  end if;

  if p_cantidad_piezas <= 0 or p_cantidad_tarimas <= 0 then
    raise exception 'Piezas y tarimas deben ser mayores a 0';
  end if;

  select * into v_salida from public.salidas where id = p_salida_id;
  if v_salida.id is null then
    raise exception 'La salida no existe';
  end if;

  if p_tarima_numeros is not null and array_length(p_tarima_numeros, 1) > 0 then
    select min(x), max(x) into v_tarima_desde, v_tarima_hasta from unnest(p_tarima_numeros) as x;
  else
    v_tarima_desde := p_tarima_desde;
    v_tarima_hasta := p_tarima_hasta;
  end if;

  v_delta_piezas := p_cantidad_piezas - v_salida.cantidad_piezas;
  v_delta_tarimas := p_cantidad_tarimas - v_salida.cantidad_tarimas;

  if v_delta_piezas <> 0 or v_delta_tarimas <> 0 then
    select cantidad_piezas, cantidad_tarimas
      into v_inv_piezas, v_inv_tarimas
      from public.inventario_lote_ubicacion
      where lote_id = v_salida.lote_id and ubicacion_id = v_salida.ubicacion_id
      for update;

    if v_inv_piezas is null then
      raise exception 'No se encontró la existencia asociada a esta salida';
    end if;

    if v_inv_piezas - v_delta_piezas < 0 or v_inv_tarimas - v_delta_tarimas < 0 then
      raise exception 'La corrección dejaría el inventario en negativo';
    end if;

    select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
      into v_reservado_piezas, v_reservado_tarimas
      from public.reservas
      where lote_id = v_salida.lote_id and ubicacion_id = v_salida.ubicacion_id and estado = 'activa';

    if v_inv_piezas - v_delta_piezas < v_reservado_piezas
       or v_inv_tarimas - v_delta_tarimas < v_reservado_tarimas then
      raise exception 'La corrección dejaría menos inventario del que ya está reservado; libera la reserva primero';
    end if;

    update public.inventario_lote_ubicacion
      set cantidad_piezas = cantidad_piezas - v_delta_piezas,
          cantidad_tarimas = cantidad_tarimas - v_delta_tarimas,
          updated_at = now()
      where lote_id = v_salida.lote_id and ubicacion_id = v_salida.ubicacion_id;

    update public.lotes
      set estado = case
        when exists (
          select 1 from public.inventario_lote_ubicacion
          where lote_id = v_salida.lote_id and (cantidad_piezas > 0 or cantidad_tarimas > 0)
        ) then 'activo' else 'agotado' end
      where id = v_salida.lote_id;
  end if;

  update public.salidas set
    cantidad_piezas = p_cantidad_piezas,
    cantidad_tarimas = p_cantidad_tarimas,
    destino = p_destino,
    transportista = p_transportista,
    placas = p_placas,
    operador = p_operador,
    observaciones = p_observaciones,
    cajas_por_pallet = p_cajas_por_pallet,
    cantidad_por_caja = p_cantidad_por_caja,
    categoria_producto = p_categoria_producto,
    lote_1 = p_lote_1,
    lote_2 = p_lote_2,
    numero_contenedor = p_numero_contenedor,
    numero_bl = p_numero_bl,
    presentacion = p_presentacion,
    tarima_desde = v_tarima_desde,
    tarima_hasta = v_tarima_hasta,
    tarima_numeros = p_tarima_numeros
  where id = p_salida_id
  returning * into v_salida;

  return v_salida;
end;
$$;

grant execute on function public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer, integer[]
) to authenticated;
