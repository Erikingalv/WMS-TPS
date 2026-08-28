-- Auditoría general de inventario (agosto 2026): se encontraron salidas
-- reales con números de tarima fuera del rango físico del lote (p.ej. dos
-- lotes de Sesajal con los rangos de tarima cruzados entre sí por error de
-- captura) y una salida con muchos más números de tarima capturados que
-- tarimas reales (55 tarimas pero 820 números). Estos errores de captura no
-- rompen el conteo agregado (piezas/tarimas siguen cuadrando en
-- inventario_lote_ubicacion, por eso pasaban inadvertidos), pero sí
-- corrompen silenciosamente el desglose por tarima individual: una tarima
-- que ya salió se sigue mostrando "disponible", y el faltante de piezas se
-- le termina cargando de golpe a una tarima cualquiera (ver también el
-- ajuste en inventarioDetallado.ts para las salidas sin número capturado).
--
-- Esta migración agrega validación en las funciones de registro/corrección
-- para atajar este tipo de error de captura en el momento, en vez de dejar
-- que corrompa el inventario en silencio.

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

  -- Si se capturó un rango físico de tarimas que cuadra con el total, las
  -- excepciones parciales con número deben caer dentro de ese rango — si
  -- no, el número no corresponde a ninguna tarima real de este movimiento.
  if p_tarima_desde is not null and p_tarima_hasta is not null
     and (p_tarima_hasta - p_tarima_desde + 1) = p_cantidad_tarimas then
    if exists (
      select 1 from jsonb_array_elements(p_tarimas_parciales) elem
      where (elem->>'numero_tarima') is not null
        and ((elem->>'numero_tarima')::integer < p_tarima_desde or (elem->>'numero_tarima')::integer > p_tarima_hasta)
    ) then
      raise exception 'El número de tarima de una excepción parcial está fuera del rango físico capturado (% - %)', p_tarima_desde, p_tarima_hasta;
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
-- corregir_entrada: misma validación de rango físico.
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

  if p_tarima_desde is not null and p_tarima_hasta is not null
     and (p_tarima_hasta - p_tarima_desde + 1) = p_cantidad_tarimas then
    if exists (
      select 1 from jsonb_array_elements(p_tarimas_parciales) elem
      where (elem->>'numero_tarima') is not null
        and ((elem->>'numero_tarima')::integer < p_tarima_desde or (elem->>'numero_tarima')::integer > p_tarima_hasta)
    ) then
      raise exception 'El número de tarima de una excepción parcial está fuera del rango físico capturado (% - %)', p_tarima_desde, p_tarima_hasta;
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
-- registrar_salida: valida que los números de tarima capturados
-- correspondan al rango físico real del lote (no al de otro lote por
-- error de captura) y que su cantidad coincida con cantidad_tarimas.
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
  v_lote_tarima_desde integer;
  v_lote_tarima_hasta integer;
  v_lote_tarimas_inicial integer;
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

  select producto_id, tarima_desde, tarima_hasta, tarimas_inicial
    into v_producto_id, v_lote_tarima_desde, v_lote_tarima_hasta, v_lote_tarimas_inicial
    from public.lotes where id = p_lote_id;
  if v_producto_id is null then
    raise exception 'El lote no existe';
  end if;
  select cliente_id into v_cliente_id from public.productos where id = v_producto_id;

  -- Los números de tarima capturados deben ser del lote que se está
  -- sacando, no de otro (error real encontrado: dos lotes con rangos de
  -- tarima cruzados por captura equivocada) — y su cantidad debe coincidir
  -- con cantidad_tarimas, si no el desglose por tarima queda inconsistente.
  if p_tarima_numeros is not null and array_length(p_tarima_numeros, 1) > 0 then
    if array_length(p_tarima_numeros, 1) <> p_cantidad_tarimas then
      raise exception 'Capturaste % número(s) de tarima pero % tarima(s) en total; deben coincidir', array_length(p_tarima_numeros, 1), p_cantidad_tarimas;
    end if;

    if v_lote_tarima_desde is not null and v_lote_tarima_hasta is not null
       and (v_lote_tarima_hasta - v_lote_tarima_desde + 1) = v_lote_tarimas_inicial then
      if exists (
        select 1 from unnest(p_tarima_numeros) as n
        where n < v_lote_tarima_desde or n > v_lote_tarima_hasta
      ) then
        raise exception 'Alguno de los números de tarima capturados está fuera del rango físico de este lote (% - %); revisa que sea el lote correcto', v_lote_tarima_desde, v_lote_tarima_hasta;
      end if;
    end if;
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

-- ---------------------------------------------------------------
-- corregir_salida: misma validación de rango físico / cantidad.
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
  v_lote_tarima_desde integer;
  v_lote_tarima_hasta integer;
  v_lote_tarimas_inicial integer;
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

  select tarima_desde, tarima_hasta, tarimas_inicial
    into v_lote_tarima_desde, v_lote_tarima_hasta, v_lote_tarimas_inicial
    from public.lotes where id = v_salida.lote_id;

  if p_tarima_numeros is not null and array_length(p_tarima_numeros, 1) > 0 then
    if array_length(p_tarima_numeros, 1) <> p_cantidad_tarimas then
      raise exception 'Capturaste % número(s) de tarima pero % tarima(s) en total; deben coincidir', array_length(p_tarima_numeros, 1), p_cantidad_tarimas;
    end if;

    if v_lote_tarima_desde is not null and v_lote_tarima_hasta is not null
       and (v_lote_tarima_hasta - v_lote_tarima_desde + 1) = v_lote_tarimas_inicial then
      if exists (
        select 1 from unnest(p_tarima_numeros) as n
        where n < v_lote_tarima_desde or n > v_lote_tarima_hasta
      ) then
        raise exception 'Alguno de los números de tarima capturados está fuera del rango físico de este lote (% - %); revisa que sea el lote correcto', v_lote_tarima_desde, v_lote_tarima_hasta;
      end if;
    end if;
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
