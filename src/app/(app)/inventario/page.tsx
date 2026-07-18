import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { diasDesde } from "@/lib/utils/dates";
import type { Cliente, Lote, Producto, Ubicacion } from "@/lib/types/database";

type FilaInventario = {
  id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  lotes:
    | (Pick<Lote, "codigo_lote" | "fecha_ingreso" | "estado" | "producto_id"> & {
        productos:
          | (Pick<Producto, "nombre" | "sku" | "cliente_id"> & {
              clientes: Pick<Cliente, "nombre"> | null;
            })
          | null;
      })
    | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

function tonoPorDias(dias: number) {
  if (dias >= 90) return "crit" as const;
  if (dias >= 30) return "warn" as const;
  return "ok" as const;
}

export default async function InventarioPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente_id?: string; producto_id?: string; ubicacion_id?: string; lote?: string }>;
}) {
  const filtros = await searchParams;
  const supabase = await createClient();

  const [{ data: filasRaw }, { data: clientes }, { data: productos }, { data: ubicaciones }] =
    await Promise.all([
      supabase
        .from("inventario_lote_ubicacion")
        .select(
          "id, cantidad_piezas, cantidad_tarimas, lotes(codigo_lote, fecha_ingreso, estado, producto_id, productos(nombre, sku, cliente_id, clientes(nombre))), ubicaciones(codigo)"
        )
        .or("cantidad_piezas.gt.0,cantidad_tarimas.gt.0"),
      supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
      supabase.from("ubicaciones").select("*").eq("activo", true).order("codigo"),
    ]);

  let filas = (filasRaw ?? []) as unknown as FilaInventario[];

  if (filtros.cliente_id) {
    filas = filas.filter((f) => f.lotes?.productos?.cliente_id === filtros.cliente_id);
  }
  if (filtros.producto_id) {
    filas = filas.filter((f) => f.lotes?.producto_id === filtros.producto_id);
  }
  if (filtros.ubicacion_id) {
    const codigo = (ubicaciones ?? []).find((u) => u.id === filtros.ubicacion_id)?.codigo;
    filas = filas.filter((f) => f.ubicaciones?.codigo === codigo);
  }
  if (filtros.lote) {
    const q = filtros.lote.toLowerCase();
    filas = filas.filter((f) => f.lotes?.codigo_lote.toLowerCase().includes(q));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Inventario</h1>
        <p className="mt-1 text-sm text-ink-soft">{filas.length} existencias activas</p>
      </div>

      <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
        <Select label="Cliente" name="cliente_id" defaultValue={filtros.cliente_id ?? ""}>
          <option value="">Todos</option>
          {(clientes ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <Select label="Producto" name="producto_id" defaultValue={filtros.producto_id ?? ""}>
          <option value="">Todos</option>
          {(productos ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </Select>
        <Select label="Ubicación" name="ubicacion_id" defaultValue={filtros.ubicacion_id ?? ""}>
          <option value="">Todas</option>
          {(ubicaciones ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-soft" htmlFor="lote">
            Lote
          </label>
          <input
            id="lote"
            name="lote"
            defaultValue={filtros.lote ?? ""}
            placeholder="L-260718…"
            className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent-soft"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Filtrar</Button>
          <Button type="submit" variant="secondary" formAction="/inventario">
            Limpiar
          </Button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Piezas</th>
              <th className="px-4 py-3">Tarimas</th>
              <th className="px-4 py-3">Días</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const dias = f.lotes ? diasDesde(f.lotes.fecha_ingreso) : 0;
              return (
                <tr key={f.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                  <td className="px-4 py-3 text-ink">{f.lotes?.productos?.clientes?.nombre ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {f.lotes?.productos?.nombre ?? "—"}{" "}
                    <span className="font-mono text-xs text-ink-faint">{f.lotes?.productos?.sku}</span>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={f.lotes ? `/lotes/${f.lotes.codigo_lote}` : undefined}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {f.lotes?.codigo_lote ?? "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {f.ubicaciones?.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink">{f.cantidad_piezas}</td>
                  <td className="px-4 py-3 tabular-nums text-ink">{f.cantidad_tarimas}</td>
                  <td className="px-4 py-3">
                    <Badge tone={tonoPorDias(dias)}>{dias}</Badge>
                  </td>
                </tr>
              );
            })}
            {filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-faint">
                  Sin existencias que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
