import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatearFechaHora } from "@/lib/utils/dates";
import type { Usuario } from "@/lib/types/database";

const TABLAS = [
  "clientes",
  "productos",
  "ubicaciones",
  "usuarios",
  "lotes",
  "entradas",
  "salidas",
  "movimientos_internos",
];

const ETIQUETA_TABLA: Record<string, string> = {
  clientes: "Clientes",
  productos: "Productos",
  ubicaciones: "Ubicaciones",
  usuarios: "Usuarios",
  lotes: "Lotes",
  entradas: "Entradas",
  salidas: "Salidas",
  movimientos_internos: "Movimientos internos",
};

export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ tabla?: string; usuario_id?: string }>;
}) {
  const filtros = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("historial_movimientos")
    .select("*, usuarios(nombre)")
    .order("fecha_hora", { ascending: false })
    .limit(200);

  if (filtros.tabla) query = query.eq("tabla_afectada", filtros.tabla);
  if (filtros.usuario_id) query = query.eq("usuario_id", filtros.usuario_id);

  const [{ data: eventosRaw }, { data: usuarios }] = await Promise.all([
    query,
    supabase.from("usuarios").select("*").order("nombre"),
  ]);

  const eventos = (eventosRaw ?? []) as unknown as Array<{
    id: string;
    tabla_afectada: string;
    tipo_movimiento: string;
    fecha_hora: string;
    ip: string | null;
    dispositivo: string | null;
    datos_antes: Record<string, unknown> | null;
    datos_despues: Record<string, unknown> | null;
    usuarios: Pick<Usuario, "nombre"> | null;
  }>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Historial</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Bitácora inmutable de los últimos 200 eventos. Nada aquí se puede editar ni borrar.
        </p>
      </div>

      <form className="grid gap-4 sm:grid-cols-3 lg:items-end lg:w-fit lg:grid-cols-3">
        <Select label="Tabla" name="tabla" defaultValue={filtros.tabla ?? ""}>
          <option value="">Todas</option>
          {TABLAS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TABLA[t]}
            </option>
          ))}
        </Select>
        <Select label="Usuario" name="usuario_id" defaultValue={filtros.usuario_id ?? ""}>
          <option value="">Todos</option>
          {(usuarios ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </Select>
        <div className="flex gap-2">
          <Button type="submit">Filtrar</Button>
          <Button type="submit" variant="secondary" formAction="/historial">
            Limpiar
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        {eventos.map((ev) => (
          <details
            key={ev.id}
            className="rounded-lg border border-line bg-paper-raised px-4 py-3 open:pb-4"
          >
            <summary className="flex cursor-pointer flex-wrap items-center gap-3 text-sm [&::-webkit-details-marker]:hidden">
              <Badge tone={ev.tipo_movimiento === "insert" ? "ok" : "info"}>
                {ev.tipo_movimiento}
              </Badge>
              <span className="font-medium text-ink">{ETIQUETA_TABLA[ev.tabla_afectada] ?? ev.tabla_afectada}</span>
              <span className="text-ink-soft">{ev.usuarios?.nombre ?? "Sistema"}</span>
              <span className="ml-auto text-xs text-ink-faint">{formatearFechaHora(ev.fecha_hora)}</span>
            </summary>
            <div className="mt-3 flex flex-col gap-2 text-xs text-ink-faint">
              {(ev.ip || ev.dispositivo) && (
                <p>
                  {ev.ip && <span>IP: {ev.ip}</span>}
                  {ev.ip && ev.dispositivo && " · "}
                  {ev.dispositivo && <span className="break-all">{ev.dispositivo}</span>}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {ev.datos_antes && (
                  <div>
                    <p className="mb-1 font-semibold uppercase tracking-wide">Antes</p>
                    <pre className="overflow-x-auto rounded-md bg-paper p-2 text-[11px]">
                      {JSON.stringify(ev.datos_antes, null, 2)}
                    </pre>
                  </div>
                )}
                {ev.datos_despues && (
                  <div>
                    <p className="mb-1 font-semibold uppercase tracking-wide">Después</p>
                    <pre className="overflow-x-auto rounded-md bg-paper p-2 text-[11px]">
                      {JSON.stringify(ev.datos_despues, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </details>
        ))}
        {eventos.length === 0 && (
          <p className="rounded-xl border border-line bg-paper-raised px-4 py-10 text-center text-ink-faint">
            Sin eventos que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  );
}
