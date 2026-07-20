import { createClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/ui/Card";
import { RealtimeRefresher } from "@/components/RealtimeRefresher";
import { diasDesde } from "@/lib/utils/dates";

function inicioDeHoyIso() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function hoyFecha() {
  return new Date().toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const hoy = inicioDeHoyIso();

  const [
    { count: clientesActivos },
    { data: ubicaciones },
    { data: existencias },
    { count: entradasHoy },
    { count: salidasHoy },
    { data: lotesActivos },
    { count: alertasAbiertas },
  ] = await Promise.all([
    supabase.from("clientes").select("*", { count: "exact", head: true }).eq("activo", true),
    supabase.from("ubicaciones").select("capacidad_max_tarimas").eq("activo", true),
    supabase.from("inventario_lote_ubicacion").select("cantidad_piezas, cantidad_tarimas"),
    supabase.from("entradas").select("*", { count: "exact", head: true }).gte("fecha", hoy),
    supabase.from("salidas").select("*", { count: "exact", head: true }).gte("fecha", hoy),
    supabase.from("lotes").select("fecha_ingreso").eq("estado", "activo"),
    supabase.from("alertas").select("*", { count: "exact", head: true }).eq("atendida", false),
  ]);

  const capacidadTotal = (ubicaciones ?? []).reduce((s, u) => s + u.capacidad_max_tarimas, 0);
  const tarimasOcupadas = (existencias ?? []).reduce((s, e) => s + e.cantidad_tarimas, 0);
  const piezasTotales = (existencias ?? []).reduce((s, e) => s + e.cantidad_piezas, 0);
  const ocupacionPct = capacidadTotal > 0 ? Math.round((tarimasOcupadas / capacidadTotal) * 100) : 0;
  const espaciosDisponibles = Math.max(0, capacidadTotal - tarimasOcupadas);

  const diasPorLote = (lotesActivos ?? []).map((l) => diasDesde(l.fecha_ingreso));
  const mas30 = diasPorLote.filter((d) => d >= 30).length;
  const mas60 = diasPorLote.filter((d) => d >= 60).length;
  const mas90 = diasPorLote.filter((d) => d >= 90).length;

  const hoyStr = hoyFecha();

  return (
    <div className="flex flex-col gap-8">
      <RealtimeRefresher tables={["entradas", "salidas", "movimientos_internos", "inventario_lote_ubicacion"]} />

      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Vista general de la operación · se actualiza en vivo
        </p>
      </div>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Inventario
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Tarimas almacenadas" value={tarimasOcupadas} href="/inventario" />
          <KpiCard label="Piezas totales" value={piezasTotales} href="/inventario" />
          <KpiCard label="Espacios disponibles" value={espaciosDisponibles} sub="tarimas" href="/ubicaciones" />
          <KpiCard label="Ocupación de la bodega" value={`${ocupacionPct}%`} href="/ubicaciones" />
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Movimientos de hoy
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Entradas del día" value={entradasHoy ?? 0} href={`/entradas?desde=${hoyStr}&hasta=${hoyStr}`} />
          <KpiCard label="Salidas del día" value={salidasHoy ?? 0} href={`/salidas?desde=${hoyStr}&hasta=${hoyStr}`} />
          <KpiCard label="Clientes activos" value={clientesActivos ?? 0} href="/clientes" />
          <KpiCard label="Capacidad total" value={capacidadTotal} sub="tarimas" href="/ubicaciones" />
        </div>
      </section>

      <section>
        <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-ink-faint">
          Antigüedad de mercancía y alertas
        </p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Más de 30 días" value={mas30} sub="lotes" href="/alertas" />
          <KpiCard label="Más de 60 días" value={mas60} sub="lotes" href="/alertas" />
          <KpiCard label="Más de 90 días" value={mas90} sub="lotes" href="/alertas" />
          <KpiCard label="Alertas abiertas" value={alertasAbiertas ?? 0} href="/alertas" />
        </div>
      </section>
    </div>
  );
}
