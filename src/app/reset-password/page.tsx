import Image from "next/image";
import { actualizarPassword } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/icons/icon-192.png" alt="" width={52} height={52} className="rounded-xl" />
          <h1 className="mt-4 text-xl font-semibold text-ink">Elige tu nueva contraseña</h1>
        </div>

        <form action={actualizarPassword} className="flex flex-col gap-4">
          {error && (
            <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
          )}

          <Input
            label="Nueva contraseña"
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Mínimo 8 caracteres"
          />
          <Input
            label="Confirmar contraseña"
            id="confirmacion"
            name="confirmacion"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="Repite la contraseña"
          />

          <SubmitButton pendingLabel="Guardando…" className="mt-2 w-full">
            Guardar contraseña
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
