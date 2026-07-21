import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_CONFIGURAR_ALERTAS, tienePermiso } from "@/lib/auth/permisos";
import { Input } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { guardarConfiguracionAlertas } from "./actions";

export default async function ConfiguracionAlertasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const usuario = await getUsuarioActual();
  if (!usuario || !tienePermiso(usuario.rol, PUEDE_CONFIGURAR_ALERTAS)) {
    redirect("/alertas");
  }

  const supabase = await createClient();
  const { data: config } = await supabase.from("configuracion_alertas").select("*").limit(1).single();

  if (!config) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-ink">Configuración de alertas</h1>
        <p className="text-sm text-ink-soft">
          No se encontró la configuración. Genera alertas una vez desde el módulo de Alertas para
          crearla automáticamente.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Configuración de alertas</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Define a partir de cuántos días o qué porcentaje se generan las alertas.
        </p>
      </div>

      <form action={guardarConfiguracionAlertas} className="flex max-w-2xl flex-col gap-5">
        <input type="hidden" name="id" value={config.id} />

        {error && (
          <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
        )}

        <div className="rounded-lg border border-line p-4">
          <p className="mb-1 text-[13px] font-medium text-ink-soft">Antigüedad de mercancía</p>
          <p className="mb-3 text-xs text-ink-faint">
            Días que lleva un lote almacenado antes de avisar. Amarillo debe ser menor o igual a
            naranja, y naranja menor o igual a rojo.
          </p>
          <div className="grid gap-5 sm:grid-cols-3">
            <Input
              label="Amarillo (aviso)"
              name="umbral_dias_amarillo"
              type="number"
              min="0"
              required
              defaultValue={config.umbral_dias_amarillo}
              hint="días"
            />
            <Input
              label="Naranja (advertencia)"
              name="umbral_dias_naranja"
              type="number"
              min="0"
              required
              defaultValue={config.umbral_dias_naranja}
              hint="días"
            />
            <Input
              label="Rojo (crítico)"
              name="umbral_dias_rojo"
              type="number"
              min="0"
              required
              defaultValue={config.umbral_dias_rojo}
              hint="días"
            />
          </div>
        </div>

        <div className="rounded-lg border border-line p-4">
          <p className="mb-1 text-[13px] font-medium text-ink-soft">Ocupación de la bodega</p>
          <p className="mb-3 text-xs text-ink-faint">
            % de capacidad de una ubicación a partir del cual se avisa que se está llenando.
          </p>
          <Input
            label="Umbral de ocupación"
            name="umbral_ocupacion_pct"
            type="number"
            min="1"
            max="100"
            required
            defaultValue={config.umbral_ocupacion_pct}
            hint="%"
          />
        </div>

        <div className="rounded-lg border border-line p-4">
          <p className="mb-1 text-[13px] font-medium text-ink-soft">Caducidad próxima</p>
          <p className="mb-3 text-xs text-ink-faint">
            Días antes de la fecha de caducidad de un lote a partir de los cuales se avisa.
          </p>
          <Input
            label="Días de anticipación"
            name="umbral_caducidad_dias"
            type="number"
            min="0"
            required
            defaultValue={config.umbral_caducidad_dias}
            hint="días"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <SubmitButton>Guardar configuración</SubmitButton>
          <ButtonLink href="/alertas" variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
