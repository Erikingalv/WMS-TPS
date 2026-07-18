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
