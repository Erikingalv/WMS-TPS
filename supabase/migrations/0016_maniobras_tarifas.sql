-- Cobro por maniobra (entrada/salida de tarimas), por tarima, configurable
-- por cliente igual que la tarifa de almacenaje.

alter table public.tarifas_almacenaje
  add column costo_maniobra_entrada numeric(10, 2) not null default 0,
  add column costo_maniobra_salida numeric(10, 2) not null default 0;
