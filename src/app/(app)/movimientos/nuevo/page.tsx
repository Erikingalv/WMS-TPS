import { createClient } from "@/lib/supabase/server";
import { obtenerExistenciasDisponibles } from "@/lib/inventario";
import { MovimientoForm } from "@/components/movimientos/MovimientoForm";
import { crearMovimiento } from "@/app/(app)/movimientos/actions";

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clientes }, { data: productos }, { data: ubicaciones }, existencias] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase.from("ubicaciones").select("*").eq("activo", true).order("codigo"),
    obtenerExistenciasDisponibles(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nuevo movimiento interno</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Reubica mercancía entre ubicaciones sin afectar el inventario total (lo reservado no se puede mover).
        </p>
      </div>
      <MovimientoForm
        action={crearMovimiento}
        clientes={clientes ?? []}
        productos={productos ?? []}
        existencias={existencias}
        ubicaciones={ubicaciones ?? []}
        error={params.error}
      />
    </div>
  );
}
