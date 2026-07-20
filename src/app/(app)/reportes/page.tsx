import { createClient } from "@/lib/supabase/server";
import { ReporteForm } from "@/components/reportes/ReporteForm";
import { COLUMNAS_DISPONIBLES } from "@/lib/reportes/columnas";

export default async function ReportesPage() {
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Reportes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Exporta en PDF o Excel con los filtros y datos que necesites.
        </p>
      </div>

      <ReporteForm
        clientes={clientes ?? []}
        columnasEntradas={Object.entries(COLUMNAS_DISPONIBLES.entradas)}
        columnasSalidas={Object.entries(COLUMNAS_DISPONIBLES.salidas)}
      />
    </div>
  );
}
