import { Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { iniciarAuditoria } from "@/app/(app)/auditorias/actions";

export default async function NuevaAuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva auditoría</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Toma una fotografía del inventario actual para contar contra ella.
        </p>
      </div>

      <form action={iniciarAuditoria} className="flex max-w-2xl flex-col gap-5">
        {params.error && (
          <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
            {params.error}
          </p>
        )}
        <Textarea
          label="Observaciones"
          name="observaciones"
          placeholder="Alcance de la auditoría, motivo, etc. (opcional)"
        />
        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Iniciando…">Iniciar auditoría</SubmitButton>
          <ButtonLink href="/auditorias" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
