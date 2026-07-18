import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TarifaForm } from "@/components/tarifas/TarifaForm";
import { guardarTarifa } from "@/app/(app)/tarifas/actions";

export default async function EditarTarifaPage({
  params,
  searchParams,
}: {
  params: Promise<{ clienteId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { clienteId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .single();

  if (!cliente) notFound();

  const { data: tarifaActual } = await supabase
    .from("tarifas_almacenaje")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("activo", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: escalonesActuales } = tarifaActual
    ? await supabase
        .from("tarifa_escalones")
        .select("*")
        .eq("tarifa_id", tarifaActual.id)
        .order("dia_inicio")
    : { data: [] };

  const guardarConCliente = guardarTarifa.bind(null, clienteId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Tarifa de {cliente.nombre}</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Al guardar se crea una versión nueva; la anterior queda en el historial.
        </p>
      </div>
      <TarifaForm
        action={guardarConCliente}
        tarifaActual={tarifaActual ?? undefined}
        escalonesActuales={escalonesActuales ?? []}
        error={error}
      />
    </div>
  );
}
