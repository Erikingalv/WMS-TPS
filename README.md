# WMS — Resguardo & Control

Warehouse Management System para una bodega de resguardo de mercancías.
Next.js (App Router) + TypeScript + TailwindCSS + Supabase. PWA instalable.

Ver el documento de diseño completo (arquitectura, ERD, casos de uso, reglas
de negocio, roadmap) para el contexto general del producto.

## Fase actual: Fase 3 — Control y valor agregado

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

**Fase 3 — Control y valor agregado**
- Reservas: apartan inventario para un cliente; salidas y movimientos
  respetan lo reservado al calcular disponible
- Auditorías: fotografía del inventario, conteo físico por renglón,
  diferencias automáticas, cierre
- Alertas: antigüedad, ocupación, inventario bajo y caducidad — generación
  automática diaria (`pg_cron`) más botón manual
- Tarifas de almacenaje por cliente con escalones, y cálculo automático del
  costo acumulado por lote (también programado a diario)
- Reportes de inventario, entradas, salidas, movimientos y ocupación,
  exportables a PDF y Excel con filtros

Las operaciones que mueven inventario (`registrar_entrada`, `registrar_salida`,
`registrar_movimiento_interno`, `registrar_reserva`) corren como funciones RPC
atómicas en PostgreSQL — no como inserts sueltos desde el cliente — para que
dos personas capturando al mismo tiempo nunca dejen el inventario en un
estado inconsistente, y para que una reserva bloquee disponibilidad de forma
confiable.

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
      entradas/ | salidas/ | movimientos/ | reservas/
      inventario/ | lotes/[codigo]/ | escanear/ | historial/
      auditorias/ | alertas/ | tarifas/ | reportes/
      usuarios/         — solo administrador
    api/reportes/        — Route Handler: genera y descarga PDF/Excel
  components/
    ui/                 — primitivos (Button, Field, Card, Badge)
    layout/             — AppShell (sidebar, topbar, tema)
    clientes|productos|ubicaciones|usuarios|entradas|salidas|movimientos|
    escanear|reservas|auditorias|alertas|tarifas/
                        — formularios y widgets propios de cada módulo
  lib/
    supabase/           — clientes browser/server/admin + proxy de sesión +
                           storage (subida de archivos)
    auth/                — sesión, permisos por rol
    types/database.ts   — tipos de la base de datos (a mano; reemplazar por
                           `supabase gen types` cuando haya CLI disponible)
    qr.ts                — generación de QR (server-side, `qrcode`)
    inventario.ts        — existencia disponible neta de reservas activas
    reportes/             — helpers de generación de PDF (`pdf-lib`) y Excel
                           (`exceljs`)
  proxy.ts               — protección de rutas (convención de Next.js 16)
supabase/
  migrations/            — esquema, RLS, funciones RPC, storage, Realtime y
                           tareas programadas (`pg_cron`), en SQL puro
```

## Comandos

```bash
npm run dev     # servidor de desarrollo (Turbopack)
npm run build   # build de producción
npm run lint    # ESLint
```

## Próximas fases

Ver el documento de diseño: Fase 4 (optimización, pruebas, seguridad y
despliegue). El cobro de almacenaje calcula el costo acumulado por lote pero
**no factura** — la facturación automática es un desarrollo futuro explícito
del documento de diseño.
