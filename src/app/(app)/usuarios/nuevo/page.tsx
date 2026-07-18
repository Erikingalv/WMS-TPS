import { requireRol } from "@/lib/auth/session";
import { PUEDE_GESTIONAR_USUARIOS, ETIQUETA_ROL } from "@/lib/auth/permisos";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { crearUsuario } from "@/app/(app)/usuarios/actions";
import type { RolUsuario } from "@/lib/types/database";

const ROLES: RolUsuario[] = [
  "administrador",
  "supervisor",
  "capturista",
  "consulta",
];

export default async function NuevoUsuarioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireRol(PUEDE_GESTIONAR_USUARIOS);
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nuevo usuario</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Se crea con contraseña temporal; puede cambiarla al iniciar sesión.
        </p>
      </div>

      <form action={crearUsuario} className="flex max-w-md flex-col gap-5">
        {params.error && (
          <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
            {params.error}
          </p>
        )}

        <Input label="Nombre" name="nombre" required />
        <Input label="Correo" name="correo" type="email" required />
        <Input
          label="Contraseña temporal"
          name="password"
          type="text"
          required
          minLength={8}
          hint="Mínimo 8 caracteres. Compártela por un canal seguro."
        />
        <Select label="Rol" name="rol" defaultValue="consulta" required>
          {ROLES.map((rol) => (
            <option key={rol} value={rol}>
              {ETIQUETA_ROL[rol]}
            </option>
          ))}
        </Select>

        <div className="flex gap-3 pt-2">
          <SubmitButton>Crear usuario</SubmitButton>
          <ButtonLink href="/usuarios" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
