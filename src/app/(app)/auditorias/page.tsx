import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_GESTIONAR_AUDITORIAS, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearFechaHora } from "@/lib/utils/dates";
import type { Usuario } from "@/lib/types/database";

type AuditoriaFila = {
  id: string;
  fecha_inicio: string;
  fecha_cierre: string | null;
  estado: "en_proceso" | "cerrada";
  usuarios: Pick<Usuario, "nombre"> | null;
};

export default async function AuditoriasPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeCrear = usuario ? tienePermiso(usuario.rol, PUEDE_GESTIONAR_AUDITORIAS) : false;

  const { data } = await supabase
    .from("auditorias")
    .select("id, fecha_inicio, fecha_cierre, estado, usuarios(nombre)")
    .order("fecha_inicio", { ascending: false });
  const auditorias = (data ?? []) as unknown as AuditoriaFila[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Auditorías</h1>
          <p className="mt-1 text-sm text-ink-soft">Conteos físicos vs. sistema</p>
        </div>
        {puedeCrear && (
          <ButtonLink href="/auditorias/nueva">
            <Plus size={17} /> Nueva auditoría
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Inicio</th>
              <th className="px-4 py-3">Cierre</th>
              <th className="px-4 py-3">Responsable</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {auditorias.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3">
                  <a href={`/auditorias/${a.id}`} className="text-accent hover:underline">
                    {formatearFechaHora(a.fecha_inicio)}
                  </a>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {a.fecha_cierre ? formatearFechaHora(a.fecha_cierre) : "—"}
                </td>
                <td className="px-4 py-3 text-ink-soft">{a.usuarios?.nombre ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={a.estado === "cerrada" ? "neutral" : "info"}>
                    {a.estado === "cerrada" ? "Cerrada" : "En proceso"}
                  </Badge>
                </td>
              </tr>
            ))}
            {auditorias.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay auditorías registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
