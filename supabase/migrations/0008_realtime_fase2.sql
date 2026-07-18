-- Habilita Realtime para que el dashboard y otras vistas se actualicen en
-- vivo cuando cualquier usuario registra un movimiento.
alter publication supabase_realtime add table public.entradas;
alter publication supabase_realtime add table public.salidas;
alter publication supabase_realtime add table public.movimientos_internos;
alter publication supabase_realtime add table public.inventario_lote_ubicacion;
