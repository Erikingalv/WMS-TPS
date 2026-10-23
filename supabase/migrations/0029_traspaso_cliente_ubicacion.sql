-- Traspaso de material entre clientes (y/o naves).
--
-- Cuando el material se pasa de una nave a otra, cambia el cliente y con él
-- el cobro de almacenaje. Hasta ahora el cliente de un lote era fijo (lo
-- define su producto). Este traspaso cambia el cliente de UN lote completo
-- a partir de una fecha: al cliente anterior se le cobra hasta el día
-- anterior y al nuevo desde esa fecha, sin alterar los cobros de días
-- pasados (el reporte de cobro lee esta tabla para saber quién era el
-- dueño cada día).
--
-- El lote pasa a un producto del cliente destino con el mismo SKU (se crea
-- si no existía), así que inventario, salidas y reportes ya lo ven bajo el
-- cliente nuevo. Las entradas y salidas anteriores conservan el cliente
-- que tenían cuando ocurrieron.
--
-- Opcionalmente cambia también la ubicación (todo lo que haya del lote en
-- la ubicación de origen), reutilizando registrar_movimiento_interno.

create table public.traspasos_cliente (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  fecha date not null, -- el cliente destino es el dueño desde este día
  cliente_origen_id uuid not null references public.clientes (id) on delete restrict,
  cliente_destino_id uuid not null references public.clientes (id) on delete restrict,
  producto_origen_id uuid not null references public.productos (id) on delete restrict,
  producto_destino_id uuid not null references public.productos (id) on delete restrict,
  motivo text,
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

create index traspasos_cliente_lote_idx on public.traspasos_cliente (lote_id, fecha);

alter table public.traspasos_cliente enable row level security;

create policy traspasos_cliente_select on public.traspasos_cliente
  for select to authenticated using (is_active_user());
-- Sin política de insert/update/delete: solo se escribe vía traspasar_lote.

create or replace function public.traspasar_lote(
  p_lote_id uuid,
  p_cliente_destino_id uuid default null,
  p_fecha date default null,
  p_ubicacion_origen_id uuid default null,
  p_ubicacion_destino_id uuid default null,
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
  v_cambia_cliente boolean;
  v_cambia_ubicacion boolean;
  v_fecha date;
  v_ultimo date;
  v_ex_piezas integer;
  v_ex_tarimas integer;
begin
  if not is_active_user() or not public.puede_corregir_movimientos() then
    raise exception 'No tienes permiso para traspasar material';
  end if;

  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  select * into v_lote from public.lotes where id = p_lote_id for update;
  if v_lote.id is null then
    raise exception 'El lote no existe';
  end if;

  select * into v_prod_origen from public.productos where id = v_lote.producto_id;

  v_cambia_cliente := p_cliente_destino_id is not null and p_cliente_destino_id <> v_prod_origen.cliente_id;
  v_cambia_ubicacion := p_ubicacion_destino_id is not null;

  if not v_cambia_cliente and not v_cambia_ubicacion then
    raise exception 'No hay nada que cambiar: elige otro cliente y/o otra ubicación';
  end if;

  if v_cambia_ubicacion and p_ubicacion_origen_id is null then
    raise exception 'Indica de qué ubicación sale el material';
  end if;

  if v_cambia_cliente then
    v_fecha := coalesce(p_fecha, current_date);

    if not exists (select 1 from public.clientes where id = p_cliente_destino_id and activo) then
      raise exception 'El cliente destino no existe o está inactivo';
    end if;
    if v_fecha > current_date then
      raise exception 'La fecha del traspaso no puede ser futura';
    end if;
    if v_fecha < v_lote.fecha_ingreso::date then
      raise exception 'La fecha del traspaso no puede ser anterior a la entrada del lote';
    end if;
    select max(fecha) into v_ultimo from public.traspasos_cliente where lote_id = p_lote_id;
    if v_ultimo is not null and v_fecha <= v_ultimo then
      raise exception 'Este lote ya tiene un traspaso con fecha igual o posterior; usa una fecha más reciente';
    end if;

    -- El mismo producto (SKU) bajo el cliente destino; se crea si no existe.
    select id into v_prod_destino_id
      from public.productos
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

    insert into public.traspasos_cliente (
      lote_id, fecha, cliente_origen_id, cliente_destino_id,
      producto_origen_id, producto_destino_id, motivo, usuario_id
    )
    values (
      p_lote_id, v_fecha, v_prod_origen.cliente_id, p_cliente_destino_id,
      v_prod_origen.id, v_prod_destino_id, p_motivo, v_usuario_id
    );

    update public.lotes set producto_id = v_prod_destino_id where id = p_lote_id;
  end if;

  if v_cambia_ubicacion then
    select cantidad_piezas, cantidad_tarimas
      into v_ex_piezas, v_ex_tarimas
      from public.inventario_lote_ubicacion
      where lote_id = p_lote_id and ubicacion_id = p_ubicacion_origen_id;

    if v_ex_piezas is null or (v_ex_piezas = 0 and v_ex_tarimas = 0) then
      raise exception 'Ese lote no tiene existencia en la ubicación de origen';
    end if;

    -- Mueve todo lo que hay del lote en esa ubicación; si algo falla
    -- (capacidad, reservas) se deshace también el cambio de cliente.
    perform public.registrar_movimiento_interno(
      p_lote_id, p_ubicacion_origen_id, p_ubicacion_destino_id,
      v_ex_piezas, v_ex_tarimas, coalesce(p_motivo, 'Traspaso de material')
    );
  end if;

  return jsonb_build_object('cliente_cambiado', v_cambia_cliente, 'ubicacion_cambiada', v_cambia_ubicacion);
end;
$$;

grant execute on function public.traspasar_lote(uuid, uuid, date, uuid, uuid, text) to authenticated;
