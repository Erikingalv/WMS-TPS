import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UbicacionForm } from "@/components/ubicaciones/UbicacionForm";
import {
  actualizarUbicacion,
  cambiarEstadoUbicacion,
} from "@/app/(app)/ubicaciones/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export default async function EditarUbicacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: ubicacion } = await supabase
    .from("ubicaciones")
    .select("*")
    .eq("id", id)
    .single();

  if (!ubicacion) notFound();

  const actualizarConId = actualizarUbicacion.bind(null, id);
  const cambiarEstado = async () => {
    "use server";
    await cambiarEstadoUbicacion(id, !ubicacion.activo);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink">
              {ubicacion.codigo}
            </h1>
            <Badge tone={ubicacion.activo ? "ok" : "neutral"}>
              {ubicacion.activo ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">Editar ubicación.</p>
        </div>
        <form action={cambiarEstado}>
          <Button type="submit" variant={ubicacion.activo ? "danger" : "secondary"}>
            {ubicacion.activo ? "Desactivar" : "Reactivar"}
          </Button>
        </form>
      </div>

      <UbicacionForm action={actualizarConId} ubicacion={ubicacion} error={error} />
    </div>
  );
}
