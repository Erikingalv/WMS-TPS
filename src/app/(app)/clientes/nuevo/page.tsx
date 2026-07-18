import { ClienteForm } from "@/components/clientes/ClienteForm";
import { crearCliente } from "@/app/(app)/clientes/actions";

export default async function NuevoClientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nuevo cliente</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Datos generales y fiscales del cliente.
        </p>
      </div>
      <ClienteForm action={crearCliente} error={params.error} />
    </div>
  );
}
