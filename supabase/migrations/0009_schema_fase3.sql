-- Fase 3: reservas, auditorías, alertas y cobro por almacenaje.

alter table public.productos
  add column stock_minimo_piezas integer;

-- ---------------------------------------------------------------
-- reservas — aparta inventario para un cliente; mientras esté activa,
-- ese inventario deja de estar disponible para salidas/movimientos.
-- ---------------------------------------------------------------
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  ubicacion_id uuid not null references public.ubicaciones (id) on delete restrict,
  cantidad_piezas integer not null check (cantidad_piezas > 0),
  cantidad_tarimas integer not null check (cantidad_tarimas > 0),
  fecha_reserva timestamptz not null default now(),
  fecha_liberacion timestamptz,
  estado text not null default 'activa' check (estado in ('activa', 'liberada', 'consumida')),
  usuario_id uuid not null references public.usuarios (id),
  observaciones text
);

create index reservas_lote_ubicacion_idx on public.reservas (lote_id, ubicacion_id) where estado = 'activa';

-- ---------------------------------------------------------------
-- auditorías — conteo físico vs sistema
-- ---------------------------------------------------------------
create table public.auditorias (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio timestamptz not null default now(),
  fecha_cierre timestamptz,
  responsable_id uuid not null references public.usuarios (id),
  estado text not null default 'en_proceso' check (estado in ('en_proceso', 'cerrada')),
  observaciones text
);

create table public.auditoria_detalle (
  id uuid primary key default gen_random_uuid(),
  auditoria_id uuid not null references public.auditorias (id) on delete cascade,
  lote_id uuid not null references public.lotes (id) on delete restrict,
  ubicacion_id uuid not null references public.ubicaciones (id) on delete restrict,
  cantidad_sistema_piezas integer not null,
  cantidad_sistema_tarimas integer not null,
  cantidad_fisica_piezas integer,
  cantidad_fisica_tarimas integer,
  diferencia_piezas integer generated always as (cantidad_fisica_piezas - cantidad_sistema_piezas) stored,
  diferencia_tarimas integer generated always as (cantidad_fisica_tarimas - cantidad_sistema_tarimas) stored,
  observaciones text,
  contado_por uuid references public.usuarios (id),
  contado_at timestamptz,
  unique (auditoria_id, lote_id, ubicacion_id)
);

create index auditoria_detalle_auditoria_idx on public.auditoria_detalle (auditoria_id);

-- ---------------------------------------------------------------
-- alertas
-- ---------------------------------------------------------------
create table public.alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('dias_almacenados', 'ocupacion', 'inventario_bajo', 'caducidad')),
  referencia_tabla text not null,
  referencia_id uuid not null,
  mensaje text not null,
  nivel text not null default 'info' check (nivel in ('info', 'warning', 'critico')),
  atendida boolean not null default false,
  atendida_por uuid references public.usuarios (id),
  atendida_at timestamptz,
  created_at timestamptz not null default now()
);

create index alertas_abiertas_idx on public.alertas (tipo, referencia_id) where not atendida;
create index alertas_created_idx on public.alertas (created_at desc);

create table public.configuracion_alertas (
  id uuid primary key default gen_random_uuid(),
  umbral_dias_amarillo integer not null default 30,
  umbral_dias_naranja integer not null default 60,
  umbral_dias_rojo integer not null default 90,
  umbral_ocupacion_pct integer not null default 90,
  umbral_caducidad_dias integer not null default 7,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger configuracion_alertas_set_updated_at
  before update on public.configuracion_alertas
  for each row execute function public.set_updated_at();

insert into public.configuracion_alertas default values;

-- ---------------------------------------------------------------
-- tarifas de almacenaje — por cliente, con escalones
-- ---------------------------------------------------------------
create table public.tarifas_almacenaje (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  nombre text not null,
  periodicidad text not null default 'diario' check (periodicidad in ('diario', 'semanal', 'mensual')),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tarifas_cliente_idx on public.tarifas_almacenaje (cliente_id);

create trigger tarifas_set_updated_at
  before update on public.tarifas_almacenaje
  for each row execute function public.set_updated_at();

create table public.tarifa_escalones (
  id uuid primary key default gen_random_uuid(),
  tarifa_id uuid not null references public.tarifas_almacenaje (id) on delete cascade,
  dia_inicio integer not null check (dia_inicio >= 0),
  dia_fin integer check (dia_fin is null or dia_fin >= dia_inicio),
  costo_por_tarima numeric(10, 2) not null default 0,
  es_gratis boolean not null default false
);

create index tarifa_escalones_tarifa_idx on public.tarifa_escalones (tarifa_id);

-- ---------------------------------------------------------------
-- cargos_almacenaje — cálculo acumulado por lote
-- ---------------------------------------------------------------
create table public.cargos_almacenaje (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  tarifa_id uuid references public.tarifas_almacenaje (id),
  periodo_desde date not null,
  periodo_hasta date not null,
  dias integer not null,
  tarimas_promedio numeric(10, 2) not null,
  costo_calculado numeric(12, 2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'facturado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Un renglón por lote: cada recálculo actualiza el acumulado "a hoy", no
  -- apila historial. Facturación por periodos es un desarrollo futuro
  -- (ver documento de diseño, sección Escalabilidad).
  unique (lote_id)
);

create trigger cargos_set_updated_at
  before update on public.cargos_almacenaje
  for each row execute function public.set_updated_at();

create index cargos_cliente_idx on public.cargos_almacenaje (cliente_id);
create index cargos_lote_idx on public.cargos_almacenaje (lote_id);
