import { createClient } from "@/lib/supabase/server";
import { RecalcularCargosButton } from "@/components/tarifas/RecalcularCargosButton";
import { Badge } from "@/components/ui/Badge";
import { formatearFecha } from "@/lib/utils/dates";
import type { Cliente, Lote, TarifaAlmacenaje } from "@/lib/types/database";

type CargoFila = {
  id: string;
  dias: number;
  tarimas_promedio: number;
  costo_calculado: number;
  periodo_hasta: string;
  clientes: Pick<Cliente, "nombre"> | null;
  lotes: Pick<Lote, "codigo_lote"> | null;
};

const formatoMoneda = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export default async function TarifasPage() {
  const supabase = await createClient();

  const [{ data: clientes }, { data: tarifas }, { data: cargosRaw }] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("tarifas_almacenaje").select("*").eq("activo", true),
    supabase
      .from("cargos_almacenaje")
      .select("id, dias, tarimas_promedio, costo_calculado, periodo_hasta, clientes(nombre), lotes(codigo_lote)")
      .order("costo_calculado", { ascending: false })
      .limit(100),
  ]);

  const tarifaPorCliente = new Map(
    (tarifas ?? []).map((t: TarifaAlmacenaje) => [t.cliente_id, t])
  );
  const cargos = (cargosRaw ?? []) as unknown as CargoFila[];
  const totalAcumulado = cargos.reduce((s, c) => s + c.costo_calculado, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tarifas y cobro de almacenaje</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Configura la tarifa de cada cliente y consulta el costo acumulado por lote.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Tarifas por cliente
        </p>
        <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tarifa</th>
                <th className="px-4 py-3">Periodicidad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {(clientes ?? []).map((c) => {
                const tarifa = tarifaPorCliente.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="px-4 py-3 text-ink">{c.nombre}</td>
                    <td className="px-4 py-3 text-ink-soft">
                      {tarifa ? tarifa.nombre : <Badge tone="neutral">Sin configurar</Badge>}
                    </td>
                    <td className="px-4 py-3 text-ink-soft capitalize">{tarifa?.periodicidad ?? "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <a href={`/tarifas/${c.id}`} className="text-sm text-accent hover:underline">
                        {tarifa ? "Editar" : "Configurar"}
                      </a>
                    </td>
                  </tr>
                );
              })}
              {(clientes ?? []).length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-ink-faint">
                    Aún no hay clientes activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
            Cargo acumulado por lote — total {formatoMoneda.format(totalAcumulado)}
          </p>
          <RecalcularCargosButton />
        </div>
        <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Lote</th>
                <th className="px-4 py-3">Días</th>
                <th className="px-4 py-3">Tarimas</th>
                <th className="px-4 py-3">Costo acumulado</th>
                <th className="px-4 py-3">A hoy</th>
              </tr>
            </thead>
            <tbody>
              {cargos.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-ink">{c.clientes?.nombre ?? "—"}</td>
                  <td className="px-4 py-3">
                    <a
                      href={c.lotes ? `/lotes/${c.lotes.codigo_lote}` : undefined}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {c.lotes?.codigo_lote ?? "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{c.dias}</td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">{c.tarimas_promedio}</td>
                  <td className="px-4 py-3 tabular-nums font-medium text-ink">
                    {formatoMoneda.format(c.costo_calculado)}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-faint">{formatearFecha(c.periodo_hasta)}</td>
                </tr>
              ))}
              {cargos.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-faint">
                    Aún no hay cargos calculados. Configura al menos una tarifa y presiona
                    &ldquo;Recalcular cargos&rdquo;.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
