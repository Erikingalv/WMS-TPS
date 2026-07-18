import { Input } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { Ubicacion } from "@/lib/types/database";

export function UbicacionForm({
  action,
  ubicacion,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  ubicacion?: Ubicacion;
  error?: string;
}) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
          {error}
        </p>
      )}

      <Input
        label="Código"
        name="codigo"
        required
        defaultValue={ubicacion?.codigo}
        placeholder="A-01"
        className="uppercase"
      />
      <Input label="Zona" name="zona" defaultValue={ubicacion?.zona ?? ""} />
      <Input
        label="Capacidad máxima"
        name="capacidad_max_tarimas"
        type="number"
        min="1"
        required
        defaultValue={ubicacion?.capacidad_max_tarimas ?? ""}
        hint="Tarimas que caben en esta ubicación"
      />

      <div className="flex gap-3 pt-2">
        <SubmitButton>
          {ubicacion ? "Guardar cambios" : "Crear ubicación"}
        </SubmitButton>
        <ButtonLink href="/ubicaciones" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
