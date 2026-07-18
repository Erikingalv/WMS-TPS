# WMS — Resguardo & Control

Warehouse Management System para una bodega de resguardo de mercancías.
Next.js (App Router) + TypeScript + TailwindCSS + Supabase. PWA instalable.

Ver el documento de diseño completo (arquitectura, ERD, casos de uso, reglas
de negocio, roadmap) para el contexto general del producto.

## Fase actual: Fase 1 — Fundación

- Autenticación con 4 roles (administrador, supervisor, capturista, consulta)
- Dashboard con KPIs reales de catálogo
- CRUD de Clientes, Productos (con foto) y Ubicaciones
- Alta de usuarios y asignación de rol (solo administrador)
- PWA instalable con app-shell offline

## Poner en marcha

1. **Instala dependencias**

   ```bash
   npm install
   ```

2. **Crea tu proyecto Supabase** (ver `supabase/README.md` para el paso a
   paso) y copia `.env.example` a `.env.local` con tus credenciales:

   ```bash
   cp .env.example .env.local
   ```

3. **Aplica las migraciones** — pega y ejecuta en orden los archivos de
   `supabase/migrations/` en el SQL Editor de tu proyecto (no hay CLI de
   Supabase instalada en esta máquina; ver `supabase/README.md`).

4. **Arranca el servidor de desarrollo**

   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000).

## Estructura

```
src/
  app/
    login/              — página de acceso
    (app)/              — área autenticada (sidebar + topbar)
      dashboard/
      clientes/
      productos/
      ubicaciones/
      usuarios/         — solo administrador
  components/
    ui/                 — primitivos (Button, Field, Card, Badge)
    layout/             — AppShell (sidebar, topbar, tema)
    clientes|productos|ubicaciones|usuarios/ — formularios y widgets propios
  lib/
    supabase/           — clientes browser/server/admin + proxy de sesión
    auth/                — sesión, permisos por rol
    types/database.ts   — tipos de la base de datos (a mano; reemplazar por
                           `supabase gen types` cuando haya CLI disponible)
  proxy.ts               — protección de rutas (convención de Next.js 16)
supabase/
  migrations/            — esquema, RLS y storage, en SQL puro
```

## Comandos

```bash
npm run dev     # servidor de desarrollo (Turbopack)
npm run build   # build de producción
npm run lint    # ESLint
```

## Próximas fases

Ver el documento de diseño: Fase 2 (entradas, salidas, inventario, QR),
Fase 3 (reservas, auditorías, reportes, cobro de almacenaje) y Fase 4
(endurecimiento y despliegue).
