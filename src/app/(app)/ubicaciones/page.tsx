import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_UBICACIONES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export default async function UbicacionesPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeEditar = usuario
    ? tienePermiso(usuario.rol, PUEDE_EDITAR_UBICACIONES)
    : false;

  const { data: ubicaciones } = await supabase
    .from("ubicaciones")
    .select("*")
    .order("codigo");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Ubicaciones</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {ubicaciones?.length ?? 0} definidas en la bodega
          </p>
        </div>
        {puedeEditar && (
          <ButtonLink href="/ubicaciones/nuevo">
            <Plus size={17} /> Nueva ubicación
          </ButtonLink>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {(ubicaciones ?? []).map((ubicacion) => (
          <a
            key={ubicacion.id}
            href={puedeEditar ? `/ubicaciones/${ubicacion.id}` : undefined}
          >
            <Card className="p-4 transition-colors hover:border-accent">
              <div className="flex items-start justify-between">
                <p className="font-mono text-lg font-semibold text-ink">
                  {ubicacion.codigo}
                </p>
                <Badge tone={ubicacion.activo ? "ok" : "neutral"}>
                  {ubicacion.activo ? "Activa" : "Inactiva"}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-faint">
                {ubicacion.zona ?? "Sin zona"}
              </p>
              <p className="mt-3 text-xs text-ink-soft">
                Capacidad:{" "}
                <span className="font-medium text-ink">
                  {ubicacion.capacidad_max_tarimas}
                </span>{" "}
                tarimas
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/60">
                <div className="h-full w-0 rounded-full bg-accent" />
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">
                Ocupación disponible en Fase 2
              </p>
            </Card>
          </a>
        ))}
        {ubicaciones?.length === 0 && (
          <p className="col-span-full py-10 text-center text-ink-faint">
            Aún no hay ubicaciones definidas.
          </p>
        )}
      </div>
    </div>
  );
}
