import { FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Select } from "@/components/ui/Field";

const TIPOS = [
  { value: "inventario", label: "Inventario / existencias" },
  { value: "entradas", label: "Entradas" },
  { value: "salidas", label: "Salidas" },
  { value: "movimientos", label: "Movimientos internos" },
  { value: "ocupacion", label: "Ocupación de la bodega" },
];

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
          Exporta en PDF o Excel con los filtros que necesites.
        </p>
      </div>

      <form
        action="/api/reportes"
        method="get"
        className="flex max-w-2xl flex-col gap-5 rounded-xl border border-line bg-paper-raised p-5"
      >
        <Select label="Tipo de reporte" name="tipo" defaultValue="inventario">
          {TIPOS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>

        <div className="grid gap-5 sm:grid-cols-3">
          <Select label="Cliente" name="cliente_id" defaultValue="">
            <option value="">Todos</option>
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-soft" htmlFor="desde">
              Desde
            </label>
            <input
              id="desde"
              name="desde"
              type="date"
              className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-medium text-ink-soft" htmlFor="hasta">
              Hasta
            </label>
            <input
              id="hasta"
              name="hasta"
              type="date"
              className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            />
          </div>
        </div>

        <p className="text-xs text-ink-faint">
          El filtro de fechas solo aplica a Entradas, Salidas y Movimientos.
        </p>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            name="formato"
            value="pdf"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-paper transition-colors hover:bg-accent-hover"
          >
            <FileDown size={16} /> Descargar PDF
          </button>
          <button
            type="submit"
            name="formato"
            value="excel"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised px-5 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
          >
            <FileDown size={16} /> Descargar Excel
          </button>
        </div>
      </form>
    </div>
  );
}
