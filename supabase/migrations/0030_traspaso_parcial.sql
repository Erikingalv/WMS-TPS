-- Traspaso PARCIAL: pasar solo algunas tarimas (y sus piezas) de un lote a
-- otro cliente y/u otra ubicación, sin mover el resto.
--
-- Se registra con los mismos movimientos de siempre, así el inventario, los
-- reportes y el cobro cuadran sin casos especiales:
--   * una SALIDA del lote original (al día del traspaso: ahí deja de cobrarse
--     almacenaje de esas tarimas al cliente anterior), y
--   * una ENTRADA a un lote nuevo del cliente destino, con la misma
--     información de la entrada original (BL, contenedor, cajas...) — desde
--     ese día se le cobra al cliente nuevo.
-- Ambas se marcan es_traspaso para que el reporte de cobro NO cobre maniobra
-- por moverlas de una nave a otra.

alter table public.entradas add column es_traspaso boolean not null default false;
alter table public.salidas add column es_traspaso boolean not null default false;

create or replace function public.traspasar_parcial(
  p_lote_id uuid,
  p_cliente_destino_id uuid,
  p_ubicacion_origen_id uuid,
  p_ubicacion_destino_id uuid,
  p_cantidad_tarimas integer,
  p_cantidad_piezas integer,
  p_fecha date default null,
  p_tarima_numeros integer[] default null,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid;
  v_lote public.lotes;
  v_prod_origen public.productos;
  v_prod_destino_id uuid;
  v_entrada_origen public.entradas;
  v_cliente_destino_nombre text;
  v_ex_piezas integer;
  v_ex_tarimas integer;
  v_reservado_piezas integer;
  v_reservado_tarimas integer;
  v_fecha date;
  v_hora time;
  v_fecha_ts timestamptz;
  v_lote_nuevo_id uuid;
  v_codigo_nuevo text;
  v_ubicacion_nueva uuid;
  v_t_desde integer;
  v_t_hasta integer;
  v_nuevo_desde integer;
  v_nuevo_hasta integer;
  v_grupo uuid := gen_random_uuid();
begin
  if not is_active_user() or not public.puede_corregir_movimientos() then
    raise exception 'No tienes permiso para traspasar material';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  if p_cantidad_tarimas is null or p_cantidad_tarimas < 1 then
    raise exception 'Indica cuántas tarimas pasan al otro cliente (mínimo 1)';
  end if;
  if p_cantidad_piezas is null or p_cantidad_piezas < 1 then
    raise exception 'Indica cuántas piezas pasan al otro cliente';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id for update;
  if v_lote.id is null then
    raise exception 'El lote no existe';
  end if;
  select * into v_prod_origen from public.productos where id = v_lote.producto_id;

  if p_cliente_destino_id = v_prod_origen.cliente_id then
    raise exception 'El cliente nuevo es el mismo que el actual; para cambiar solo de ubicación usa Movimientos';
  end if;
  select nombre into v_cliente_destino_nombre from public.clientes where id = p_cliente_destino_id and activo;
  if v_cliente_destino_nombre is null then
    raise exception 'El cliente destino no existe o está inactivo';
  end if;

  v_fecha := coalesce(p_fecha, current_date);
  if v_fecha > current_date then
    raise exception 'La fecha del traspaso no puede ser futura';
  end if;
  if v_fecha < v_lote.fecha_ingreso::date then
    raise exception 'La fecha del traspaso no puede ser anterior a la entrada del lote';
  end if;

  -- Existencia en la ubicación de origen, neta de reservas.
  select cantidad_piezas, cantidad_tarimas into v_ex_piezas, v_ex_tarimas
    from public.inventario_lote_ubicacion
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id
    for update;
  if v_ex_piezas is null then
    raise exception 'Ese lote no tiene existencia en la ubicación de origen';
  end if;

  select coalesce(sum(cantidad_piezas), 0), coalesce(sum(cantidad_tarimas), 0)
    into v_reservado_piezas, v_reservado_tarimas
    from public.reservas
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id and estado = 'activa';

  if v_ex_piezas - v_reservado_piezas < p_cantidad_piezas
     or v_ex_tarimas - v_reservado_tarimas < p_cantidad_tarimas then
    raise exception 'Inventario insuficiente: disponible % piezas / % tarimas (parte puede estar reservada)',
      v_ex_piezas - v_reservado_piezas, v_ex_tarimas - v_reservado_tarimas;
  end if;

  -- No dejar tarimas "vacías" ni piezas sin tarima en el lote original.
  if p_cantidad_piezas = v_ex_piezas and p_cantidad_tarimas < v_ex_tarimas then
    raise exception 'Estás pasando todas las piezas pero no todas las tarimas: ajusta las cantidades';
  end if;
  if p_cantidad_tarimas = v_ex_tarimas and p_cantidad_piezas < v_ex_piezas then
    raise exception 'Estás pasando todas las tarimas pero no todas las piezas: ajusta las cantidades';
  end if;

  -- Números de tarima que pasan (opcional): misma validación que en salidas.
  if p_tarima_numeros is not null and array_length(p_tarima_numeros, 1) > 0 then
    if array_length(p_tarima_numeros, 1) <> p_cantidad_tarimas then
      raise exception 'Capturaste % número(s) de tarima pero pasan % tarima(s); deben coincidir',
        array_length(p_tarima_numeros, 1), p_cantidad_tarimas;
    end if;
    if v_lote.tarima_desde is not null and v_lote.tarima_hasta is not null
       and (v_lote.tarima_hasta - v_lote.tarima_desde + 1) = v_lote.tarimas_inicial then
      if exists (
        select 1 from unnest(p_tarima_numeros) as n
        where n < v_lote.tarima_desde or n > v_lote.tarima_hasta
      ) then
        raise exception 'Alguno de los números de tarima está fuera del rango físico de este lote (% - %)',
          v_lote.tarima_desde, v_lote.tarima_hasta;
      end if;
    end if;
    select min(x), max(x) into v_t_desde, v_t_hasta from unnest(p_tarima_numeros) as x;
    -- El lote nuevo conserva el rango solo si son tarimas consecutivas.
    if v_t_hasta - v_t_desde + 1 = p_cantidad_tarimas then
      v_nuevo_desde := v_t_desde;
      v_nuevo_hasta := v_t_hasta;
    end if;
  end if;

  select * into v_entrada_origen from public.entradas where lote_id = p_lote_id limit 1;

  -- Producto del cliente destino (mismo SKU); se crea si no existe.
  select id into v_prod_destino_id from public.productos
    where cliente_id = p_cliente_destino_id and sku = v_prod_origen.sku;
  if v_prod_destino_id is null then
    insert into public.productos (
      cliente_id, nombre, sku, descripcion, unidad, peso_kg, largo_cm, ancho_cm,
      alto_cm, foto_url, codigo_barras, activo, stock_minimo_piezas
    )
    values (
      p_cliente_destino_id, v_prod_origen.nombre, v_prod_origen.sku, v_prod_origen.descripcion,
      v_prod_origen.unidad, v_prod_origen.peso_kg, v_prod_origen.largo_cm, v_prod_origen.ancho_cm,
      v_prod_origen.alto_cm, v_prod_origen.foto_url, v_prod_origen.codigo_barras, true,
      v_prod_origen.stock_minimo_piezas
    )
    returning id into v_prod_destino_id;
  end if;

  -- Fecha/hora del traspaso (hora de la nave si es hoy; mediodía si es un día pasado).
  if v_fecha = current_date then
    v_hora := (now() at time zone 'America/Mexico_City')::time(0);
  else
    v_hora := time '12:00';
  end if;
  v_fecha_ts := (v_fecha + v_hora)::timestamptz;
  v_ubicacion_nueva := coalesce(p_ubicacion_destino_id, p_ubicacion_origen_id);

  -- 1) Salida del lote original.
  update public.inventario_lote_ubicacion
    set cantidad_piezas = cantidad_piezas - p_cantidad_piezas,
        cantidad_tarimas = cantidad_tarimas - p_cantidad_tarimas,
        updated_at = now()
    where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id;

  update public.lotes
    set estado = case when exists (
      select 1 from public.inventario_lote_ubicacion
      where lote_id = p_lote_id and (cantidad_piezas > 0 or cantidad_tarimas > 0)
    ) then 'activo' else 'agotado' end
    where id = p_lote_id;

  insert into public.salidas (
    fecha, cliente_id, producto_id, lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas,
    destino, observaciones, created_by, hora_carga_descarga,
    cajas_por_pallet, cantidad_por_caja, categoria_producto, lote_1, lote_2,
    numero_contenedor, numero_bl, presentacion,
    tarima_desde, tarima_hasta, tarima_numeros, grupo_id, es_traspaso
  )
  values (
    v_fecha_ts, v_prod_origen.cliente_id, v_prod_origen.id, p_lote_id, p_ubicacion_origen_id,
    p_cantidad_piezas, p_cantidad_tarimas,
    'Traspaso a ' || v_cliente_destino_nombre, p_motivo, v_usuario_id, v_hora,
    v_entrada_origen.cajas_por_pallet, v_entrada_origen.cantidad_por_caja, v_entrada_origen.categoria_producto,
    v_entrada_origen.lote_1, v_entrada_origen.lote_2, v_entrada_origen.numero_contenedor,
    v_entrada_origen.numero_bl, v_entrada_origen.presentacion,
    v_t_desde, v_t_hasta, p_tarima_numeros, v_grupo, true
  );

  -- 2) Lote nuevo del cliente destino, con su entrada.
  v_codigo_nuevo := 'L-' || to_char(now(), 'YYMMDD') || '-'
    || lpad(nextval('public.lotes_folio_seq')::text, 5, '0');

  insert into public.lotes (
    producto_id, codigo_lote, fecha_ingreso, fecha_caducidad,
    piezas_inicial, tarimas_inicial, qr_payload, tarima_desde, tarima_hasta
  )
  values (
    v_prod_destino_id, v_codigo_nuevo, v_fecha_ts, v_lote.fecha_caducidad,
    p_cantidad_piezas, p_cantidad_tarimas, v_codigo_nuevo, v_nuevo_desde, v_nuevo_hasta
  )
  returning id into v_lote_nuevo_id;

  insert into public.inventario_lote_ubicacion (lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas)
  values (v_lote_nuevo_id, v_ubicacion_nueva, p_cantidad_piezas, p_cantidad_tarimas);

  insert into public.entradas (
    fecha, cliente_id, producto_id, lote_id, cantidad_piezas, cantidad_tarimas,
    ubicacion_id, recibio_usuario_id, observaciones, created_by, hora_carga_descarga,
    cajas_por_pallet, cantidad_por_caja, categoria_producto, lote_1, lote_2,
    numero_contenedor, numero_bl, presentacion, tarima_desde, tarima_hasta, grupo_id, es_traspaso
  )
  values (
    v_fecha_ts, p_cliente_destino_id, v_prod_destino_id, v_lote_nuevo_id, p_cantidad_piezas, p_cantidad_tarimas,
    v_ubicacion_nueva, v_usuario_id,
    'Traspaso desde ' || v_lote.codigo_lote || ' (cliente anterior)' || coalesce(' · ' || p_motivo, ''),
    v_usuario_id, v_hora,
    v_entrada_origen.cajas_por_pallet, v_entrada_origen.cantidad_por_caja, v_entrada_origen.categoria_producto,
    v_entrada_origen.lote_1, v_entrada_origen.lote_2, v_entrada_origen.numero_contenedor,
    v_entrada_origen.numero_bl, v_entrada_origen.presentacion, v_nuevo_desde, v_nuevo_hasta,
    gen_random_uuid(), true
  );

  return jsonb_build_object('codigo_lote_nuevo', v_codigo_nuevo, 'lote_nuevo_id', v_lote_nuevo_id);
end;
$$;

grant execute on function public.traspasar_parcial(
  uuid, uuid, uuid, uuid, integer, integer, date, integer[], text
) to authenticated;
