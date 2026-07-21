import Image from "next/image";
import Link from "next/link";
import { solicitarRecuperacion } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image src="/icons/icon-192.png" alt="" width={52} height={52} className="rounded-xl" />
          <h1 className="mt-4 text-xl font-semibold text-ink">Recuperar contraseña</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Te mandamos un enlace a tu correo para elegir una nueva.
          </p>
        </div>

        {enviado ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
              Si ese correo está registrado, en unos minutos te llega un enlace para elegir una
              nueva contraseña. Revisa también spam.
            </p>
            <Link href="/login" className="text-center text-sm text-accent hover:underline">
              Volver a iniciar sesión
            </Link>
          </div>
        ) : (
          <form action={solicitarRecuperacion} className="flex flex-col gap-4">
            <Input
              label="Correo"
              id="correo"
              name="correo"
              type="email"
              autoComplete="username"
              required
              placeholder="tu@empresa.com"
            />
            <SubmitButton pendingLabel="Enviando…" className="mt-2 w-full">
              Enviar enlace
            </SubmitButton>
            <Link href="/login" className="text-center text-sm text-ink-faint hover:underline">
              Volver a iniciar sesión
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
