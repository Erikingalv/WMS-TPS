import { AlertTriangle, Bell, Info, Settings } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_ATENDER_ALERTAS, PUEDE_CONFIGURAR_ALERTAS, tienePermiso } from "@/lib/auth/permisos";
import { GenerarAlertasButton } from "@/components/alertas/GenerarAlertasButton";
import { AtenderAlertaButton } from "@/components/alertas/AtenderAlertaButton";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFechaHora } from "@/lib/utils/dates";
import type { NivelAlerta } from "@/lib/types/database";

const ICONO_NIVEL: Record<NivelAlerta, typeof Bell> = {
  critico: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

const TONO_NIVEL: Record<NivelAlerta, "crit" | "warn" | "info"> = {
  critico: "crit",
  warning: "warn",
  info: "info",
};

export default async function AlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; guardado?: string }>;
}) {
  const params = await searchParams;
  const soloAbiertas = params.estado !== "todas";

  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeAtender = usuario ? tienePermiso(usuario.rol, PUEDE_ATENDER_ALERTAS) : false;
  const puedeConfigurar = usuario ? tienePermiso(usuario.rol, PUEDE_CONFIGURAR_ALERTAS) : false;

  let query = supabase
    .from("alertas")
    .select("*")
    .order("nivel", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(200);

  if (soloAbiertas) query = query.eq("atendida", false);

  const { data: alertas } = await query;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Alertas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Antigüedad, ocupación, inventario bajo y caducidad próxima.
          </p>
        </div>
        <div className="flex gap-3">
          {puedeConfigurar && (
            <ButtonLink href="/alertas/configuracion" variant="secondary">
              <Settings size={16} /> Configurar umbrales
            </ButtonLink>
          )}
          {puedeAtender && <GenerarAlertasButton />}
        </div>
      </div>

      {params.guardado && (
        <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
          Configuración guardada.
        </p>
      )}

      <div className="flex gap-2 text-sm">
        <a
          href="/alertas"
          className={`rounded-lg px-3 py-1.5 ${soloAbiertas ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-accent-soft"}`}
        >
          Abiertas
        </a>
        <a
          href="/alertas?estado=todas"
          className={`rounded-lg px-3 py-1.5 ${!soloAbiertas ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-accent-soft"}`}
        >
          Todas
        </a>
      </div>

      <div className="flex flex-col gap-2">
        {(alertas ?? []).map((a) => {
          const Icon = ICONO_NIVEL[a.nivel];
          return (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3"
            >
              <Icon size={18} className="shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">{a.mensaje}</p>
                <p className="text-xs text-ink-faint">{formatearFechaHora(a.created_at)}</p>
              </div>
              <Badge tone={TONO_NIVEL[a.nivel]}>{a.nivel}</Badge>
              {a.atendida ? (
                <Badge tone="neutral">Atendida</Badge>
              ) : (
                puedeAtender && <AtenderAlertaButton id={a.id} />
              )}
            </div>
          );
        })}
        {(alertas ?? []).length === 0 && (
          <p className="rounded-xl border border-line bg-paper-raised px-4 py-10 text-center text-ink-faint">
            {soloAbiertas ? "No hay alertas abiertas." : "No hay alertas registradas todavía."}
          </p>
        )}
      </div>
    </div>
  );
}
