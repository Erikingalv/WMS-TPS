import Image from "next/image";
import Link from "next/link";
import { signIn } from "@/lib/auth/actions";
import { Input } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirect?: string;
    desactivado?: string;
  }>;
}) {
  const params = await searchParams;
  const redirectTo = params.redirect || "/dashboard";
  const errorMessage = params.desactivado
    ? "Tu cuenta está desactivada. Contacta a un administrador."
    : params.error;

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/icons/icon-192.png"
            alt=""
            width={52}
            height={52}
            className="rounded-xl"
          />
          <h1 className="mt-4 text-xl font-semibold text-ink">
            WMS — Resguardo &amp; Control
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Inicia sesión para continuar
          </p>
        </div>

        <form action={signIn} className="flex flex-col gap-4">
          <input type="hidden" name="redirect" value={redirectTo} />

          {errorMessage && (
            <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
              {errorMessage}
            </p>
          )}

          <Input
            label="Correo"
            id="correo"
            name="correo"
            type="email"
            autoComplete="username"
            required
            placeholder="tu@empresa.com"
          />
          <Input
            label="Contraseña"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
          />

          <SubmitButton pendingLabel="Entrando…" className="mt-2 w-full">
            Iniciar sesión
          </SubmitButton>

          <Link
            href="/forgot-password"
            className="text-center text-sm text-ink-faint hover:underline"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </form>

        <p className="mt-8 text-center text-xs text-ink-faint">
          ¿No tienes cuenta? Pídele a un administrador que te dé de alta desde
          el módulo de Usuarios.
        </p>
      </div>
    </main>
  );
}
