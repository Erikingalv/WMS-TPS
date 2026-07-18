-- Fase 1: fundación — usuarios/roles, clientes, productos, ubicaciones.
-- Fases posteriores agregan lotes, movimientos, reservas, auditorías, etc.
-- (ver documento de diseño, sección "Base de datos & ERD").

create extension if not exists pgcrypto;

create type public.rol_usuario as enum (
  'administrador',
  'supervisor',
  'capturista',
  'consulta'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- usuarios — extiende auth.users con rol de negocio
-- ---------------------------------------------------------------
create table public.usuarios (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre text not null,
  correo text not null,
  rol public.rol_usuario not null default 'consulta',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger usuarios_set_updated_at
  before update on public.usuarios
  for each row execute function public.set_updated_at();

-- Crea automáticamente el registro de negocio cuando se crea un auth.users.
-- El rol y nombre iniciales se leen de raw_user_meta_data (los fija el
-- servidor al invitar/crear el usuario desde el panel de Administración).
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.usuarios (auth_user_id, nombre, correo, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', split_part(new.email, '@', 1)),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'rol')::public.rol_usuario, 'consulta')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Devuelve el rol del usuario autenticado; security definer para poder
-- leer public.usuarios desde dentro de las políticas RLS de esa misma tabla
-- sin recursión.
create or replace function public.current_user_role()
returns public.rol_usuario
language sql
security definer
set search_path = public
stable
as $$
  select rol from public.usuarios where auth_user_id = auth.uid();
$$;

grant execute on function public.current_user_role() to authenticated;

-- ---------------------------------------------------------------
-- clientes
-- ---------------------------------------------------------------
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  empresa text,
  rfc text,
  direccion text,
  contacto text,
  correo text,
  telefono text,
  observaciones text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clientes_set_updated_at
  before update on public.clientes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- productos
-- ---------------------------------------------------------------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete restrict,
  nombre text not null,
  sku text not null,
  descripcion text,
  unidad text not null default 'pieza',
  peso_kg numeric(10, 3),
  largo_cm numeric(10, 2),
  ancho_cm numeric(10, 2),
  alto_cm numeric(10, 2),
  foto_url text,
  codigo_barras text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cliente_id, sku)
);

create index productos_cliente_id_idx on public.productos (cliente_id);

create trigger productos_set_updated_at
  before update on public.productos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------
-- ubicaciones
-- ---------------------------------------------------------------
create table public.ubicaciones (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  zona text,
  capacidad_max_tarimas integer not null check (capacidad_max_tarimas > 0),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ubicaciones_set_updated_at
  before update on public.ubicaciones
  for each row execute function public.set_updated_at();
