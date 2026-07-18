import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default async function ClientesPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeEditar = usuario ? tienePermiso(usuario.rol, PUEDE_EDITAR_CLIENTES) : false;

  const { data: clientes } = await supabase
    .from("clientes")
    .select("*")
    .order("nombre");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Clientes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {clientes?.length ?? 0} registrados
          </p>
        </div>
        {puedeEditar && (
          <ButtonLink href="/clientes/nuevo">
            <Plus size={17} /> Nuevo cliente
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Empresa</th>
              <th className="px-4 py-3">Contacto</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {(clientes ?? []).map((cliente) => (
              <tr
                key={cliente.id}
                className="border-b border-line last:border-0 hover:bg-accent-soft/40"
              >
                <td className="px-4 py-3">
                  <a
                    href={puedeEditar ? `/clientes/${cliente.id}` : undefined}
                    className={puedeEditar ? "font-medium text-ink hover:text-accent" : "font-medium text-ink"}
                  >
                    {cliente.nombre}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {cliente.empresa ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {cliente.contacto ?? cliente.correo ?? cliente.telefono ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={cliente.activo ? "ok" : "neutral"}>
                    {cliente.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
              </tr>
            ))}
            {clientes?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay clientes registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
