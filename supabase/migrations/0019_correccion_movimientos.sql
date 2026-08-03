-- Corrección de entradas/salidas ya registradas — solo administrador.
--
-- entradas/salidas son inmutables por diseño (migración 0006: sin política
-- de update para nadie). Aquí se agrega la ÚNICA forma de corregirlas: dos
-- funciones `security definer` restringidas a rol administrador que, si la
-- cantidad cambia, propagan el ajuste a `inventario_lote_ubicacion` y a
-- `lotes.piezas_inicial/tarimas_inicial` — así una corrección (ej. "eran 19
-- tarimas, no 20") queda reflejada correctamente en inventario, reportes y
-- cálculo de cargos, no solo en el renglón de la entrada/salida.
--
-- Se valida que la corrección no deje el inventario negativo ni por debajo
-- de lo que ya está reservado. Se agrega trigger de auditoría en update
-- (antes solo existía en insert) para que quede registro de qué cambió y
-- quién lo corrigió.

drop trigger entradas_historial on public.entradas;
create trigger entradas_historial after insert or update on public.entradas
  for each row execute function public.registrar_historial();

drop trigger salidas_historial on public.salidas;
create trigger salidas_historial after insert or update on public.salidas
  for each row execute function public.registrar_historial();

-- ---------------------------------------------------------------
-- corregir_entrada
-- ---------------------------------------------------------------
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
  p_tarima_hasta integer default null
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
begin
  if not is_active_user() or current_user_role() <> 'administrador' then
    raise exception 'Solo un administrador puede corregir movimientos ya registrados';
  end if;

  if p_cantidad_piezas <= 0 or p_cantidad_tarimas <= 0 then
    raise exception 'Piezas y tarimas deben ser mayores a 0';
  end if;

  select * into v_entrada from public.entradas where id = p_entrada_id;
  if v_entrada.id is null then
    raise exception 'La entrada no existe';
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
    tarima_hasta = p_tarima_hasta
  where id = p_entrada_id
  returning * into v_entrada;

  return v_entrada;
end;
$$;

grant execute on function public.corregir_entrada(
  uuid, integer, integer, numeric, text, integer, integer, text, text, text, text, text, text, integer, integer
) to authenticated;

-- ---------------------------------------------------------------
-- corregir_salida — misma idea, ajuste en dirección opuesta sobre
-- inventario_lote_ubicacion (más salida = menos inventario disponible).
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
  p_tarima_hasta integer default null
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

  -- Delta positivo = ahora salió más que antes = se resta más del inventario.
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
    tarima_desde = p_tarima_desde,
    tarima_hasta = p_tarima_hasta
  where id = p_salida_id
  returning * into v_salida;

  return v_salida;
end;
$$;

grant execute on function public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer
) to authenticated;
