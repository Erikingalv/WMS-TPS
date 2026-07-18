# Migraciones

No hay Supabase CLI ni Docker instalados en esta máquina, así que las
migraciones se aplican a mano desde el **SQL Editor** del panel de Supabase
(Project → SQL Editor → New query). Cuando el proyecto tenga CLI disponible,
esta misma carpeta funciona con `supabase db push` sin cambios.

## Aplicar Fase 1

1. Abre el SQL Editor de tu proyecto en supabase.com.
2. Pega y ejecuta `migrations/0001_schema_fase1.sql`.
3. Pega y ejecuta `migrations/0002_rls_fase1.sql`.
4. Pega y ejecuta `migrations/0003_storage_fase1.sql` (crea el bucket
   público `productos` para las fotografías).

## Aplicar Fase 2

5. `migrations/0004_schema_fase2.sql` — lotes, inventario en vivo, entradas,
   salidas, movimientos internos, adjuntos y bitácora.
6. `migrations/0005_funciones_fase2.sql` — funciones RPC atómicas
   (`registrar_entrada`, `registrar_salida`, `registrar_movimiento_interno`)
   y el trigger genérico de auditoría sobre todas las tablas operativas.
7. `migrations/0006_rls_fase2.sql`
8. `migrations/0007_storage_fase2.sql` — bucket `documentos` (fotos y
   papeles de entradas/salidas).
9. `migrations/0008_realtime_fase2.sql` — habilita Realtime para que el
   dashboard se actualice en vivo entre usuarios.

## Aplicar Fase 3

10. `migrations/0009_schema_fase3.sql` — reservas, auditorías, alertas,
    tarifas de almacenaje y cargos.
11. `migrations/0010_funciones_fase3.sql` — `registrar_reserva`,
    `liberar_reserva`, `generar_alertas`, `calcular_cargo_lote` /
    `calcular_cargos_almacenaje`; también reemplaza `registrar_salida` y
    `registrar_movimiento_interno` de Fase 2 para que descuenten lo
    reservado del disponible. Al final intenta habilitar `pg_cron` y
    programar las tareas diarias (alertas 7am, cargos 6am) — si tu proyecto
    no tiene esa extensión disponible, actívala primero en
    **Database → Extensions** y vuelve a correr solo las dos sentencias
    `select cron.schedule(...)` del final del archivo.
12. `migrations/0011_rls_fase3.sql`
13. `migrations/0012_funciones_auditoria.sql` — `iniciar_auditoria` (toma la
    fotografía del inventario) y `cerrar_auditoria`.

## Crear el primer administrador

El trigger `on_auth_user_created` crea automáticamente una fila en
`public.usuarios` cada vez que se crea un usuario en Supabase Auth, con rol
`consulta` por defecto (o el rol indicado en `raw_user_meta_data`).

Para tu primer administrador:

1. **Authentication → Users → Add user** en el panel de Supabase. Crea el
   usuario con tu correo y una contraseña.
2. Ve al **SQL Editor** y sube ese usuario a administrador:

   ```sql
   update public.usuarios
   set rol = 'administrador'
   where correo = 'tu-correo@ejemplo.com';
   ```

3. Desde ahí, ya puedes crear el resto de usuarios (con su rol) directamente
   desde el módulo **Usuarios** de la aplicación — no hace falta volver a
   tocar el SQL Editor.
