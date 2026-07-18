import { createClient } from "@/lib/supabase/server";
import { ProductoForm } from "@/components/productos/ProductoForm";
import { crearProducto } from "@/app/(app)/productos/actions";

export default async function NuevoProductoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nuevo producto</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Ligado a un cliente del catálogo.
        </p>
      </div>
      <ProductoForm
        action={crearProducto}
        clientes={clientes ?? []}
        error={params.error}
      />
    </div>
  );
}
