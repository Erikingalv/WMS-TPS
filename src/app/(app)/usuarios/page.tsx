import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth/session";
import { PUEDE_GESTIONAR_USUARIOS } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { RolSelector } from "@/components/usuarios/RolSelector";
import { EstadoUsuarioToggle } from "@/components/usuarios/EstadoUsuarioToggle";

export default async function UsuariosPage() {
  const usuarioActual = await requireRol(PUEDE_GESTIONAR_USUARIOS);

  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("usuarios")
    .select("*")
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Usuarios</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {usuarios?.length ?? 0} cuentas · roles y acceso
          </p>
        </div>
        <ButtonLink href="/usuarios/nuevo">
          <Plus size={17} /> Nuevo usuario
        </ButtonLink>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Correo</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(usuarios ?? []).map((usuario) => {
              const esUnoMismo = usuario.id === usuarioActual.id;
              return (
                <tr
                  key={usuario.id}
                  className="border-b border-line last:border-0"
                >
                  <td className="px-4 py-3 font-medium text-ink">
                    {usuario.nombre}
                    {esUnoMismo && (
                      <span className="ml-2 text-xs text-ink-faint">(tú)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{usuario.correo}</td>
                  <td className="px-4 py-3">
                    <RolSelector
                      id={usuario.id}
                      rolActual={usuario.rol}
                      disabled={esUnoMismo}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {esUnoMismo ? (
                      <Badge tone="ok">Activo</Badge>
                    ) : (
                      <EstadoUsuarioToggle
                        id={usuario.id}
                        activo={usuario.activo}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
