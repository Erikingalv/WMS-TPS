import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProductoForm } from "@/components/productos/ProductoForm";
import {
  actualizarProducto,
  cambiarEstadoProducto,
} from "@/app/(app)/productos/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function EditarProductoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [{ data: producto }, { data: clientes }] = await Promise.all([
    supabase.from("productos").select("*").eq("id", id).single(),
    supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
  ]);

  if (!producto) notFound();

  const actualizarConId = actualizarProducto.bind(null, id);
  const cambiarEstado = async () => {
    "use server";
    await cambiarEstadoProducto(id, !producto.activo);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">{producto.nombre}</h1>
            <Badge tone={producto.activo ? "ok" : "neutral"}>
              {producto.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Editar información del producto.</p>
        </div>
        <form action={cambiarEstado}>
          <Button type="submit" variant={producto.activo ? "danger" : "secondary"}>
            {producto.activo ? "Desactivar" : "Reactivar"}
          </Button>
        </form>
      </div>

      <ProductoForm
        action={actualizarConId}
        producto={producto}
        clientes={clientes ?? []}
        error={error}
      />
    </div>
  );
}
