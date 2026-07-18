import { Input, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { Cliente } from "@/lib/types/database";

export function ClienteForm({
  action,
  cliente,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  cliente?: Cliente;
  error?: string;
}) {
  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
          {error}
        </p>
      )}

      <Input
        label="Nombre"
        name="nombre"
        required
        defaultValue={cliente?.nombre}
        placeholder="Nombre del cliente"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Empresa"
          name="empresa"
          defaultValue={cliente?.empresa ?? ""}
        />
        <Input label="RFC" name="rfc" defaultValue={cliente?.rfc ?? ""} />
      </div>

      <Input
        label="Dirección"
        name="direccion"
        defaultValue={cliente?.direccion ?? ""}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <Input
          label="Contacto"
          name="contacto"
          defaultValue={cliente?.contacto ?? ""}
        />
        <Input
          label="Correo"
          name="correo"
          type="email"
          defaultValue={cliente?.correo ?? ""}
        />
        <Input
          label="Teléfono"
          name="telefono"
          type="tel"
          defaultValue={cliente?.telefono ?? ""}
        />
      </div>

      <Textarea
        label="Observaciones"
        name="observaciones"
        defaultValue={cliente?.observaciones ?? ""}
      />

      <div className="flex gap-3 pt-2">
        <SubmitButton>
          {cliente ? "Guardar cambios" : "Crear cliente"}
        </SubmitButton>
        <ButtonLink href="/clientes" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
