-- Fase 2: lotes, inventario en vivo, entradas, salidas, movimientos
-- internos, adjuntos y bitácora de auditoría.

create sequence public.lotes_folio_seq;

create table public.lotes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references public.productos (id) on delete restrict,
  codigo_lote text not null unique,
  fecha_ingreso timestamptz not null default now(),
  fecha_caducidad date,
  piezas_inicial integer not null check (piezas_inicial > 0),
  tarimas_inicial integer not null check (tarimas_inicial > 0),
  estado text not null default 'activo' check (estado in ('activo', 'agotado')),
  qr_payload text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lotes_producto_id_idx on public.lotes (producto_id);
create index lotes_fecha_ingreso_idx on public.lotes (fecha_ingreso);

create trigger lotes_set_updated_at
  before update on public.lotes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- inventario_lote_ubicacion — existencia viva por lote y ubicación
-- ---------------------------------------------------------------
create table public.inventario_lote_ubicacion (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  ubicacion_id uuid not null references public.ubicaciones (id) on delete restrict,
  cantidad_piezas integer not null default 0 check (cantidad_piezas >= 0),
  cantidad_tarimas integer not null default 0 check (cantidad_tarimas >= 0),
  updated_at timestamptz not null default now(),
  unique (lote_id, ubicacion_id)
);

create index inventario_ubicacion_idx on public.inventario_lote_ubicacion (ubicacion_id);

-- ---------------------------------------------------------------
-- entradas
-- ---------------------------------------------------------------
create table public.entradas (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  producto_id uuid not null references public.productos (id) on delete restrict,
  lote_id uuid not null references public.lotes (id) on delete restrict,
  cantidad_piezas integer not null check (cantidad_piezas > 0),
  cantidad_tarimas integer not null check (cantidad_tarimas > 0),
  peso_kg numeric(10, 3),
  ubicacion_id uuid not null references public.ubicaciones (id) on delete restrict,
  recibio_usuario_id uuid references public.usuarios (id),
  observaciones text,
  created_by uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

create index entradas_lote_idx on public.entradas (lote_id);
create index entradas_fecha_idx on public.entradas (fecha);
create index entradas_cliente_idx on public.entradas (cliente_id);

-- ---------------------------------------------------------------
-- salidas
-- ---------------------------------------------------------------
create table public.salidas (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  producto_id uuid not null references public.productos (id) on delete restrict,
  lote_id uuid not null references public.lotes (id) on delete restrict,
  ubicacion_id uuid not null references public.ubicaciones (id) on delete restrict,
  cantidad_piezas integer not null check (cantidad_piezas > 0),
  cantidad_tarimas integer not null check (cantidad_tarimas > 0),
  destino text,
  transportista text,
  placas text,
  operador text,
  autorizo_usuario_id uuid references public.usuarios (id),
  observaciones text,
  firma_digital_url text,
  created_by uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

create index salidas_lote_idx on public.salidas (lote_id);
create index salidas_fecha_idx on public.salidas (fecha);
create index salidas_cliente_idx on public.salidas (cliente_id);

-- ---------------------------------------------------------------
-- movimientos_internos — reubicación sin afectar el total del lote
-- ---------------------------------------------------------------
create table public.movimientos_internos (
  id uuid primary key default gen_random_uuid(),
  lote_id uuid not null references public.lotes (id) on delete restrict,
  ubicacion_origen_id uuid not null references public.ubicaciones (id) on delete restrict,
  ubicacion_destino_id uuid not null references public.ubicaciones (id) on delete restrict,
  cantidad_piezas integer not null check (cantidad_piezas > 0),
  cantidad_tarimas integer not null check (cantidad_tarimas > 0),
  motivo text,
  usuario_id uuid not null references public.usuarios (id),
  created_at timestamptz not null default now()
);

create index movimientos_lote_idx on public.movimientos_internos (lote_id);

-- ---------------------------------------------------------------
-- archivos_adjuntos — fotos y documentos de entradas/salidas
-- ---------------------------------------------------------------
create table public.archivos_adjuntos (
  id uuid primary key default gen_random_uuid(),
  entidad_tipo text not null check (entidad_tipo in ('entrada', 'salida')),
  entidad_id uuid not null,
  tipo_documento text not null default 'foto'
    check (tipo_documento in ('factura', 'carta_porte', 'packing_list', 'orden_compra', 'foto', 'otro')),
  storage_path text not null,
  nombre_archivo text,
  subido_por uuid references public.usuarios (id),
  created_at timestamptz not null default now()
);

create index archivos_adjuntos_entidad_idx on public.archivos_adjuntos (entidad_tipo, entidad_id);

-- ---------------------------------------------------------------
-- historial_movimientos — bitácora de auditoría, append-only
-- ---------------------------------------------------------------
create table public.historial_movimientos (
  id uuid primary key default gen_random_uuid(),
  tabla_afectada text not null,
  registro_id uuid,
  tipo_movimiento text not null,
  usuario_id uuid references public.usuarios (id),
  fecha_hora timestamptz not null default now(),
  ip text,
  dispositivo text,
  datos_antes jsonb,
  datos_despues jsonb
);

create index historial_registro_idx on public.historial_movimientos (tabla_afectada, registro_id);
create index historial_fecha_idx on public.historial_movimientos (fecha_hora desc);
