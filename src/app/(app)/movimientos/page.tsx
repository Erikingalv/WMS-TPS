import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFechaHora } from "@/lib/utils/dates";
import type { Lote, Ubicacion } from "@/lib/types/database";

type MovimientoFila = {
  id: string;
  created_at: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  lotes: Pick<Lote, "codigo_lote"> | null;
  origen: Pick<Ubicacion, "codigo"> | null;
  destino: Pick<Ubicacion, "codigo"> | null;
};

export default async function MovimientosPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeCrear = usuario ? tienePermiso(usuario.rol, PUEDE_EDITAR_CLIENTES) : false;

  const { data } = await supabase
    .from("movimientos_internos")
    .select("id, created_at, cantidad_piezas, cantidad_tarimas, lote_id, ubicacion_origen_id, ubicacion_destino_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const ids = new Set<string>();
  (data ?? []).forEach((m) => {
    ids.add(m.ubicacion_origen_id);
    ids.add(m.ubicacion_destino_id);
  });

  const [{ data: lotesRaw }, { data: ubicacionesRaw }] = await Promise.all([
    supabase.from("lotes").select("id, codigo_lote"),
    supabase.from("ubicaciones").select("id, codigo"),
  ]);

  const mapaLotes = new Map((lotesRaw ?? []).map((l) => [l.id, l.codigo_lote]));
  const mapaUbicaciones = new Map((ubicacionesRaw ?? []).map((u) => [u.id, u.codigo]));

  const movimientos: MovimientoFila[] = (data ?? []).map((m) => ({
    id: m.id,
    created_at: m.created_at,
    cantidad_piezas: m.cantidad_piezas,
    cantidad_tarimas: m.cantidad_tarimas,
    lotes: mapaLotes.has(m.lote_id) ? { codigo_lote: mapaLotes.get(m.lote_id)! } : null,
    origen: mapaUbicaciones.has(m.ubicacion_origen_id)
      ? { codigo: mapaUbicaciones.get(m.ubicacion_origen_id)! }
      : null,
    destino: mapaUbicaciones.has(m.ubicacion_destino_id)
      ? { codigo: mapaUbicaciones.get(m.ubicacion_destino_id)! }
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Movimientos internos</h1>
          <p className="mt-1 text-sm text-ink-soft">Últimos 100 reacomodos</p>
        </div>
        {puedeCrear && (
          <ButtonLink href="/movimientos/nuevo">
            <Plus size={17} /> Nuevo movimiento
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">De</th>
              <th className="px-4 py-3">A</th>
              <th className="px-4 py-3">Cantidad</th>
            </tr>
          </thead>
          <tbody>
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3 text-ink-soft">{formatearFechaHora(m.created_at)}</td>
                <td className="px-4 py-3">
                  <a
                    href={m.lotes ? `/lotes/${m.lotes.codigo_lote}` : undefined}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {m.lotes?.codigo_lote ?? "—"}
                  </a>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.origen?.codigo ?? "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.destino?.codigo ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {m.cantidad_piezas} pz · {m.cantidad_tarimas} tar
                </td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay movimientos internos.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
