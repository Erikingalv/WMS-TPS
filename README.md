# WMS — Resguardo & Control

Warehouse Management System para una bodega de resguardo de mercancías.
Next.js (App Router) + TypeScript + TailwindCSS + Supabase. PWA instalable.

Ver el documento de diseño completo (arquitectura, ERD, casos de uso, reglas
de negocio, roadmap) para el contexto general del producto.

## Fase actual: Fase 2 — Operación diaria

**Fase 1 — Fundación**
- Autenticación con 4 roles (administrador, supervisor, capturista, consulta)
- CRUD de Clientes, Productos (con foto) y Ubicaciones
- Alta de usuarios y asignación de rol (solo administrador)
- PWA instalable con app-shell offline

**Fase 2 — Operación diaria**
- Entradas (crea lote + QR automáticamente, fotos y documentos)
- Salidas (sugerencia FIFO, firma digital, nunca deja inventario negativo)
- Movimientos internos entre ubicaciones (valida capacidad destino)
- Inventario con filtros y antigüedad por lote
- Escaneo con cámara (QR) con respaldo de captura manual
- Historial: bitácora de auditoría inmutable en todas las tablas operativas
- Dashboard con KPIs reales y actualización en vivo (Realtime)

Las operaciones que mueven inventario (`registrar_entrada`, `registrar_salida`,
`registrar_movimiento_interno`) corren como funciones RPC atómicas en
PostgreSQL — no como inserts sueltos desde el cliente — para que dos personas
capturando al mismo tiempo nunca dejen el inventario en un estado
inconsistente.

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
      clientes/ | productos/ | ubicaciones/
      entradas/ | salidas/ | movimientos/
      inventario/ | lotes/[codigo]/ | escanear/ | historial/
      usuarios/         — solo administrador
  components/
    ui/                 — primitivos (Button, Field, Card, Badge)
    layout/             — AppShell (sidebar, topbar, tema)
    clientes|productos|ubicaciones|usuarios|entradas|salidas|movimientos|escanear/
                        — formularios y widgets propios de cada módulo
  lib/
    supabase/           — clientes browser/server/admin + proxy de sesión +
                           storage (subida de archivos)
    auth/                — sesión, permisos por rol
    types/database.ts   — tipos de la base de datos (a mano; reemplazar por
                           `supabase gen types` cuando haya CLI disponible)
    qr.ts                — generación de QR (server-side, `qrcode`)
  proxy.ts               — protección de rutas (convención de Next.js 16)
supabase/
  migrations/            — esquema, RLS, funciones RPC, storage y Realtime,
                           en SQL puro
```

## Comandos

```bash
npm run dev     # servidor de desarrollo (Turbopack)
npm run build   # build de producción
npm run lint    # ESLint
```

## Próximas fases

Ver el documento de diseño: Fase 3 (reservas, auditorías, reportes, cobro de
almacenaje) y Fase 4 (endurecimiento y despliegue).
