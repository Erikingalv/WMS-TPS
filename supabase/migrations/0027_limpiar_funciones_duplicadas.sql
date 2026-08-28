-- Auditoría de fondo (agosto 2026): cada vez que una migración anterior le
-- agregó parámetros nuevos a registrar_entrada/registrar_salida/
-- corregir_entrada/corregir_salida, "create or replace function" NO
-- reemplazó la versión anterior — en Postgres, una lista de parámetros
-- distinta (aunque sea solo un parámetro extra al final) es una función
-- distinta ("sobrecarga"). El resultado: llevamos desde el inicio del
-- proyecto acumulando versiones viejas de estas funciones en la base de
-- datos, todas siguen ahí, con la lógica y validaciones de cuando se
-- escribieron (sin los candados de seguridad, sin las validaciones de
-- tarimas de la migración 0026, algunas ni siquiera con el permiso
-- puede_corregir_movimientos).
--
-- Esto no afectó el día a día: la app siempre manda todos los parámetros
-- actuales, así que PostgREST siempre elige la versión más nueva. Pero es
-- una bomba de tiempo — cualquier llamada con menos parámetros de los
-- actuales (un script, una integración futura, un cliente HTTP directo)
-- puede caer en la versión vieja sin las validaciones/candados de hoy, o
-- directamente fallar con "no se pudo elegir la función" por la
-- ambigüedad. Esta migración elimina todas las versiones viejas y deja
-- una sola función vigente por nombre, tal como debió quedar siempre.

-- registrar_entrada: 4 versiones viejas (de las migraciones 0005/0013,
-- 0015, 0017, 0022) — se queda solo la de 0025/0026 (23 parámetros).
drop function if exists public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, numeric, uuid, text, date
);
drop function if exists public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, date, time, numeric, uuid, text,
  date, integer, integer, text, text, text, text, text, text
);
drop function if exists public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, date, time, numeric, uuid, text,
  date, integer, integer, text, text, text, text, text, text, integer, integer
);
drop function if exists public.registrar_entrada(
  uuid, uuid, uuid, integer, integer, date, time, numeric, uuid, text,
  date, integer, integer, text, text, text, text, text, text, integer, integer, jsonb
);

-- registrar_salida: 4 versiones viejas (de 0005/0010/0013, 0015, 0017,
-- 0020, 0022) — se queda solo la de 0025/0026 (27 parámetros).
drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, text, text, text, text, uuid, text, text
);
drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text
);
drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer
);
drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer, integer[]
);
drop function if exists public.registrar_salida(
  uuid, uuid, integer, integer, date, time, text, text, text, text, uuid, text,
  text, integer, integer, text, text, text, text, text, text, integer, integer, integer[], integer, integer
);

-- corregir_entrada: 2 versiones viejas (de 0019/0021, 0022/0023) — se
-- queda solo la de 0024/0026 (18 parámetros).
drop function if exists public.corregir_entrada(
  uuid, integer, integer, numeric, text, integer, integer, text, text, text, text, text, text, integer, integer
);
drop function if exists public.corregir_entrada(
  uuid, integer, integer, numeric, text, integer, integer, text, text, text, text, text, text, integer, integer, jsonb
);

-- corregir_salida: 3 versiones viejas (de 0019, 0020, 0022/0023) — se
-- queda solo la de 0024/0026 (23 parámetros).
drop function if exists public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer
);
drop function if exists public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer, integer[]
);
drop function if exists public.corregir_salida(
  uuid, integer, integer, text, text, text, text, text, integer, integer, text, text, text, text, text, text, integer, integer, integer[], integer, integer
);
