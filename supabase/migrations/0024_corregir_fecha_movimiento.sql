-- Permite corregir la fecha/hora de una entrada o salida ya registrada
-- (mismo permiso puede_corregir_movimientos de la migración 0023).
--
-- En entradas, la fecha también se refleja en `lotes.fecha_ingreso` — es
-- la fuente que usan reportes, alertas y el cálculo de cargos por días de
-- almacenaje (ver diasDesde() en el código), así que si no se sincroniza
-- ahí la corrección no tendría ningún efecto real en el sistema.

create or replace function public.corregir_entrada(
  p_entrada_id uuid,
  p_cantidad_piezas integer,
  p_cantidad_tarimas integer,
  p_peso_kg numeric default null,
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
  p_tarimas_parciales jsonb default '[]'::jsonb,
  p_fecha_movimiento date default null,
  p_hora_carga_descarga time default null
)
returns public.entradas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entrada public.entradas;
  v_delta_piezas integer;
  v_delta_tarimas integer;
  v_inv_piezas integer;
  v_inv_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_num_parciales integer;
  v_suma_parciales integer;
  v_fecha_final timestamptz;
  v_hora_final time;
begin
  if not is_active_user() or not public.puede_corregir_movimientos() then
    raise exception 'No tienes permiso para corregir movimientos ya registrados';
  end if;

  if p_cantidad_piezas <= 0 or p_cantidad_tarimas <= 0 then
    raise exception 'Piezas y tarimas deben ser mayores a 0';
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

  select * into v_entrada from public.entradas where id = p_entrada_id;
  if v_entrada.id is null then
    raise exception 'La entrada no existe';
  end if;

  if p_fecha_movimiento is not null and p_hora_carga_descarga is not null then
    v_fecha_final := (p_fecha_movimiento + p_hora_carga_descarga)::timestamptz;
    v_hora_final := p_hora_carga_descarga;
  else
    v_fecha_final := v_entrada.fecha;
    v_hora_final := v_entrada.hora_carga_descarga;
  end if;

  v_delta_piezas := p_cantidad_piezas - v_entrada.cantidad_piezas;
  v_delta_tarimas := p_cantidad_tarimas - v_entrada.cantidad_tarimas;

  if v_delta_piezas <> 0 or v_delta_tarimas <> 0 then
    select cantidad_piezas, cantidad_tarimas
      into v_inv_piezas, v_inv_tarimas
      from public.inventario_lote_ubicacion
      where lote_id = v_entrada.lote_id and ubicacion_id = v_entrada.ubicacion_id
      for update;

    if v_inv_piezas is null then
      raise exception 'No se encontró la existencia asociada a esta entrada (¿ya se movió a otra ubicación?)';
    end if;

    if v_inv_piezas + v_delta_piezas < 0 or v_inv_tarimas + v_delta_tarimas < 0 then
      raise exception 'La corrección dejaría el inventario en negativo: ya salió más de lo que quedaría con la cantidad corregida';
    end if;

    select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
      into v_reservado_piezas, v_reservado_tarimas
      from public.reservas
      where lote_id = v_entrada.lote_id and ubicacion_id = v_entrada.ubicacion_id and estado = 'activa';

    if v_inv_piezas + v_delta_piezas < v_reservado_piezas
       or v_inv_tarimas + v_delta_tarimas < v_reservado_tarimas then
      raise exception 'La corrección dejaría menos inventario del que ya está reservado; libera la reserva primero';
    end if;

    update public.inventario_lote_ubicacion
      set cantidad_piezas = cantidad_piezas + v_delta_piezas,
          cantidad_tarimas = cantidad_tarimas + v_delta_tarimas,
          updated_at = now()
      where lote_id = v_entrada.lote_id and ubicacion_id = v_entrada.ubicacion_id;

    update public.lotes
      set piezas_inicial = piezas_inicial + v_delta_piezas,
          tarimas_inicial = tarimas_inicial + v_delta_tarimas,
          estado = case
            when exists (
              select 1 from public.inventario_lote_ubicacion
              where lote_id = v_entrada.lote_id and (cantidad_piezas > 0 or cantidad_tarimas > 0)
            ) then 'activo' else 'agotado' end
      where id = v_entrada.lote_id;
  end if;

  update public.lotes
    set tarima_desde = p_tarima_desde,
        tarima_hasta = p_tarima_hasta,
        tarimas_parciales = p_tarimas_parciales,
        fecha_ingreso = v_fecha_final
    where id = v_entrada.lote_id;

  update public.entradas set
    cantidad_piezas = p_cantidad_piezas,
    cantidad_tarimas = p_cantidad_tarimas,
    peso_kg = p_peso_kg,
    observaciones = p_observaciones,
    cajas_por_pallet = p_cajas_por_pallet,
    cantidad_por_caja = p_cantidad_por_caja,
    categoria_producto = p_categoria_producto,
    lote_1 = p_lote_1,
    lote_2 = p_lote_2,
    numero_contenedor = p_numero_contenedor,
    numero_bl = p_numero_bl,
    presentacion = p_presentacion,
    tarima_desde = p_tarima_desde,
    tarima_hasta = p_tarima_hasta,
    tarimas_parciales = p_tarimas_parciales,
    fecha = v_fecha_final,
    hora_carga_descarga = v_hora_final
  where id = p_entrada_id
  returning * into v_entrada;

  return v_entrada;
end;
$$;

grant execute on function public.corregir_entrada(
  uuid, integer, integer, numeric, text, integer, integer, text, text, text, text, text, text, integer, integer, jsonb, date, time
) to authenticated;

-- ---------------------------------------------------------------
-- corregir_salida: mismo agregado de fecha/hora, sin tocar lotes (la
-- fecha de salida no alimenta ningún campo espejo en el lote).
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
  p_tarima_numeros integer[] default null,
  p_piezas_tarima_parcial integer default null,
  p_numero_tarima_parcial integer default null,
  p_fecha_movimiento date default null,
  p_hora_carga_descarga time default null
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
  v_fecha_final timestamptz;
  v_hora_final time;
begin
  if not is_active_user() or not public.puede_corregir_movimientos() then
    raise exception 'No tienes permiso para corregir movimientos ya registrados';
  end if;

  if p_cantidad_piezas <= 0 or p_cantidad_tarimas <= 0 then
    raise exception 'Piezas y tarimas deben ser mayores a 0';
  end if;

  if p_piezas_tarima_parcial is not null and p_piezas_tarima_parcial > p_cantidad_piezas then
    raise exception 'Las piezas de la tarima parcial no pueden superar el total de piezas de la salida';
  end if;

  select * into v_salida from public.salidas where id = p_salida_id;
  if v_salida.id is null then
    raise exception 'La salida no existe';
  end if;

  if p_fecha_movimiento is not null and p_hora_carga_descarga is not null then
    v_fecha_final := (p_fecha_movimiento + p_hora_carga_descarga)::timestamptz;
    v_hora_final := p_hora_carga_descarga;
  else
    v_fecha_final := v_salida.fecha;
    v_hora_final := v_salida.hora_carga_descarga;
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
    tarima_numeros = p_tarima_numeros,
    piezas_tarima_parcial = p_piezas_tarima_parcial,
    numero_tarima_parcial = p_numero_tarima_parcial,
    fecha = v_fecha_final,
    hora_carga_descarga = v_hora_final
  where id = p_salida_id
  returning * into v_salida;

  return v_salida;
end;
$$;

grant execute on function public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer, integer[], integer, integer, date, time
) to authenticated;
