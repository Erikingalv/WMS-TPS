import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ClienteForm } from "@/components/clientes/ClienteForm";
import {
  actualizarCliente,
  cambiarEstadoCliente,
} from "@/app/(app)/clientes/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function EditarClientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", id)
    .single();

  if (!cliente) notFound();

  const actualizarConId = actualizarCliente.bind(null, id);
  const desactivar = async () => {
    "use server";
    await cambiarEstadoCliente(id, !cliente.activo);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{cliente.nombre}</h1>
            <Badge tone={cliente.activo ? "ok" : "neutral"}>
              {cliente.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Editar información del cliente.</p>
        </div>
        <form action={desactivar}>
          <Button type="submit" variant={cliente.activo ? "danger" : "secondary"}>
            {cliente.activo ? "Desactivar" : "Reactivar"}
          </Button>
        </form>
      </div>

      <ClienteForm action={actualizarConId} cliente={cliente} error={error} />
    </div>
  );
}
