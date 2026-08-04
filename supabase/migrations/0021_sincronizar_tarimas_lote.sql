-- corregir_entrada actualizaba el rango de tarimas de la entrada pero no el
-- del lote (`lotes.tarima_desde/tarima_hasta`), que es lo que realmente lee
-- el reporte de Inventario para desglosar por tarima individual. Una
-- corrección de rango desde "Editar entrada" quedaba en el renglón de la
-- entrada pero no se reflejaba en el reporte. Como cada lote tiene
-- exactamente una entrada (se crean juntos en registrar_entrada), el rango
-- del lote debe ser siempre el mismo que el de su entrada.

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

  -- El rango de tarimas del lote debe quedar igual al de su única entrada.
  update public.lotes
    set tarima_desde = p_tarima_desde,
        tarima_hasta = p_tarima_hasta
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
    tarima_hasta = p_tarima_hasta
  where id = p_entrada_id
  returning * into v_entrada;

  return v_entrada;
end;
$$;
