import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/ui/Card";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [{ count: clientesActivos }, { count: productosActivos }, { data: ubicaciones }] =
    await Promise.all([
      supabase
        .from("clientes")
        .select("*", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("productos")
        .select("*", { count: "exact", head: true })
        .eq("activo", true),
      supabase
        .from("ubicaciones")
        .select("capacidad_max_tarimas")
        .eq("activo", true),
    ]);

  const capacidadTotal = (ubicaciones ?? []).reduce(
    (sum, u) => sum + u.capacidad_max_tarimas,
    0
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Vista general de la operación.
        </p>
      </div>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Ahora mismo
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Clientes activos" value={clientesActivos ?? 0} />
          <KpiCard label="Productos activos" value={productosActivos ?? 0} />
          <KpiCard label="Ubicaciones" value={ubicaciones?.length ?? 0} />
          <KpiCard
            label="Capacidad total"
            value={capacidadTotal}
            sub="tarimas"
          />
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Disponible en Fase 2 — al conectar entradas y salidas
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            "Tarimas almacenadas",
            "Piezas totales",
            "Entradas del día",
            "Salidas del día",
            "% de ocupación",
            "Mercancía > 30 días",
            "Mercancía > 60 días",
            "Mercancía > 90 días",
          ].map((label) => (
            <div
              key={label}
              className="rounded-xl border border-dashed border-line p-5"
            >
              <p className="text-[13px] font-medium text-ink-faint">{label}</p>
              <p className="mt-2 text-[28px] font-semibold leading-none text-ink-faint">
                —
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
