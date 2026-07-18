-- Fase 4: índices para las consultas reales que hace la app (dashboard,
-- listas filtradas por estado/fecha/usuario). Con el volumen de datos de
-- ahora no se nota, pero evita que se vuelva lento según crece la bodega.

-- Redundante: `cargos_almacenaje` ya tiene `unique (lote_id)`, que crea su
-- propio índice — este índice duplicado solo agregaba overhead de escritura.
drop index if exists public.cargos_lote_idx;

-- lotes.estado se filtra en casi cada pantalla (dashboard, salidas,
-- movimientos, cálculo de cargos); "activo" es, con mucho, el valor más
-- consultado.
create index lotes_estado_activo_idx on public.lotes (estado) where estado = 'activo';

-- Reportes y bitácora filtran por fecha/usuario.
create index movimientos_internos_created_idx on public.movimientos_internos (created_at);
create index historial_usuario_idx on public.historial_movimientos (usuario_id);
