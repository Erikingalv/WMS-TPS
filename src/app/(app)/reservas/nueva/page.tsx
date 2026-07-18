import { createClient } from "@/lib/supabase/server";
import { obtenerExistenciasDisponibles } from "@/lib/inventario";
import { ReservaForm } from "@/components/reservas/ReservaForm";
import { crearReserva } from "@/app/(app)/reservas/actions";

export default async function NuevaReservaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clientes }, { data: productos }, disponibles] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    obtenerExistenciasDisponibles(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva reserva</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Aparta inventario para un cliente; nadie más podrá usarlo hasta que la liberes.
        </p>
      </div>
      <ReservaForm
        action={crearReserva}
        clientes={clientes ?? []}
        productos={productos ?? []}
        disponibles={disponibles}
        error={params.error}
      />
    </div>
  );
}
