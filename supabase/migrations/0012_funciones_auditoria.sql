-- Fase 3 (continuación): iniciar/cerrar auditoría. Separado de
-- 0010_funciones_fase3.sql porque se agregó después — aplícalo junto con
-- el resto de Fase 3 si aún no lo has hecho.

create or replace function public.iniciar_auditoria(p_observaciones text default null)
returns public.auditorias
language plpgsql
security invoker
as $$
declare
  v_usuario_id uuid;
  v_auditoria public.auditorias;
begin
  v_usuario_id := public.usuario_actual_id();
  if v_usuario_id is null then
    raise exception 'No se encontró el usuario de la sesión actual';
  end if;

  insert into public.auditorias (responsable_id, observaciones)
  values (v_usuario_id, p_observaciones)
  returning * into v_auditoria;

  -- Fotografía del inventario en este momento: un renglón por cada
  -- combinación lote+ubicación con existencia.
  insert into public.auditoria_detalle (
    auditoria_id, lote_id, ubicacion_id, cantidad_sistema_piezas, cantidad_sistema_tarimas
  )
  select v_auditoria.id, ilu.lote_id, ilu.ubicacion_id, ilu.cantidad_piezas, ilu.cantidad_tarimas
  from public.inventario_lote_ubicacion ilu
  where ilu.cantidad_piezas > 0 or ilu.cantidad_tarimas > 0;

  return v_auditoria;
end;
$$;

grant execute on function public.iniciar_auditoria(text) to authenticated;

create or replace function public.cerrar_auditoria(p_auditoria_id uuid)
returns public.auditorias
language plpgsql
security invoker
as $$
declare
  v_auditoria public.auditorias;
begin
  update public.auditorias
    set estado = 'cerrada', fecha_cierre = now()
    where id = p_auditoria_id
    returning * into v_auditoria;

  if v_auditoria.id is null then
    raise exception 'La auditoría no existe';
  end if;

  return v_auditoria;
end;
$$;

grant execute on function public.cerrar_auditoria(uuid) to authenticated;
