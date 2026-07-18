import { createClient } from "@/lib/supabase/server";
import { obtenerExistenciasDisponibles } from "@/lib/inventario";
import { SalidaForm } from "@/components/salidas/SalidaForm";
import { crearSalida } from "@/app/(app)/salidas/actions";

export default async function NuevaSalidaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clientes }, { data: productos }, { data: usuarios }, existencias] = await Promise.all([
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
    supabase.from("productos").select("*").eq("activo", true).order("nombre"),
    supabase.from("usuarios").select("*").eq("activo", true).order("nombre"),
    obtenerExistenciasDisponibles(supabase),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva salida</h1>
        <p className="mt-1 text-sm text-ink-soft">
          El sistema nunca deja el inventario en negativo (y el disponible ya descuenta lo reservado).
        </p>
      </div>
      <SalidaForm
        action={crearSalida}
        clientes={clientes ?? []}
        productos={productos ?? []}
        existencias={existencias}
        usuarios={usuarios ?? []}
        fechaHoy={new Date().toISOString().slice(0, 10)}
        error={params.error}
      />
    </div>
  );
}
