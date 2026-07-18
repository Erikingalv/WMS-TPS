# Migraciones — Fase 1

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
