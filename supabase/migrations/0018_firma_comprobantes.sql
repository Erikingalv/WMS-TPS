-- Firma digital de comprobantes desde cualquier dispositivo, después de
-- registrado el movimiento (no solo al capturarlo). `entradas` no tenía
-- columna de firma (solo `salidas` la traía desde Fase 2); se agrega para
-- que ambas puedan firmarse igual.
--
-- Como entradas/salidas son inmutables por diseño (sin política de
-- update — ver migración 0006), se agrega una función `security definer`
-- muy angosta que solo permite fijar la firma una vez, en vez de reabrir
-- el update general de la tabla.

alter table public.entradas
  add column firma_digital_url text;

create or replace function public.guardar_firma_comprobante(
  p_tipo text,
  p_id uuid,
  p_firma_digital_url text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual text;
begin
  if not is_active_user() or current_user_role() not in ('administrador', 'supervisor', 'capturista') then
    raise exception 'No autorizado';
  end if;

  if p_tipo not in ('entrada', 'salida') then
    raise exception 'Tipo inválido';
  end if;

  if p_tipo = 'entrada' then
    select firma_digital_url into v_actual from public.entradas where id = p_id;
    if not found then
      raise exception 'La entrada no existe';
    end if;
    if v_actual is not null then
      raise exception 'Este comprobante ya fue firmado';
    end if;
    update public.entradas set firma_digital_url = p_firma_digital_url where id = p_id;
  else
    select firma_digital_url into v_actual from public.salidas where id = p_id;
    if not found then
      raise exception 'La salida no existe';
    end if;
    if v_actual is not null then
      raise exception 'Este comprobante ya fue firmado';
    end if;
    update public.salidas set firma_digital_url = p_firma_digital_url where id = p_id;
  end if;
end;
$$;

grant execute on function public.guardar_firma_comprobante(text, uuid, text) to authenticated;
