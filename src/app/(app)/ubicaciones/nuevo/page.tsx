import { UbicacionForm } from "@/components/ubicaciones/UbicacionForm";
import { crearUbicacion } from "@/app/(app)/ubicaciones/actions";

export default async function NuevaUbicacionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva ubicación</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Define un espacio físico de la bodega y su capacidad.
        </p>
      </div>
      <UbicacionForm action={crearUbicacion} error={params.error} />
    </div>
  );
}
