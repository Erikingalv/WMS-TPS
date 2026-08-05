import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { puedeCorregirMovimientos } from "@/lib/auth/permisos";
import { Input, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { FilaSalida } from "@/lib/reportes/columnas";
import { formatearTarimas } from "@/lib/utils/tarimas";
import { corregirSalidaAction } from "./actions";

export default async function EditarSalidaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const usuario = await getUsuarioActual();
  if (!usuario || !puedeCorregirMovimientos(usuario)) {
    redirect("/salidas");
  }

  const supabase = await createClient();
  const { data: salidaRaw } = await supabase
    .from("salidas")
    .select("*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo)")
    .eq("id", id)
    .single();

  if (!salidaRaw) notFound();
  const salida = salidaRaw as unknown as FilaSalida;

  const tarimasTexto =
    salida.tarima_numeros && salida.tarima_numeros.length > 0
      ? formatearTarimas(salida.tarima_numeros)
      : salida.tarima_desde != null
        ? salida.tarima_desde === salida.tarima_hasta
          ? String(salida.tarima_desde)
          : `${salida.tarima_desde}-${salida.tarima_hasta}`
        : "";

  const corregirConId = corregirSalidaAction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Corregir salida</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {salida.clientes?.nombre ?? "—"} · {salida.productos?.nombre ?? "—"} ·{" "}
          <span className="font-mono">{salida.lotes?.codigo_lote ?? "—"}</span> ·{" "}
          {salida.ubicaciones?.codigo ?? "—"}
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Solo administrador. Si cambias piezas o tarimas, el inventario, los reportes y los
          cargos se ajustan automáticamente.
        </p>
      </div>

      <form action={corregirConId} className="flex max-w-2xl flex-col gap-5">
        {error && (
          <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Piezas"
            name="cantidad_piezas"
            type="number"
            min="1"
            required
            defaultValue={salida.cantidad_piezas}
          />
          <Input
            label="Tarimas"
            name="cantidad_tarimas"
            type="number"
            min="1"
            required
            defaultValue={salida.cantidad_tarimas}
          />
        </div>

        <Input
          label="Identificador de tarimas"
          name="tarima_numeros_texto"
          defaultValue={tarimasTexto}
          hint='Números sueltos y/o rangos mezclados, ej. "1,5,15-17"'
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Piezas de tarima parcial"
            name="piezas_tarima_parcial"
            type="number"
            min="1"
            defaultValue={salida.piezas_tarima_parcial ?? ""}
            hint="Solo si una de las tarimas que salieron no venía completa"
          />
          <Input
            label="Número de esa tarima (si aplica)"
            name="numero_tarima_parcial"
            type="number"
            min="1"
            defaultValue={salida.numero_tarima_parcial ?? ""}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Destino" name="destino" defaultValue={salida.destino ?? ""} />
          <Input label="Transportista" name="transportista" defaultValue={salida.transportista ?? ""} />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Placas" name="placas" defaultValue={salida.placas ?? ""} />
          <Input label="Operador" name="operador" defaultValue={salida.operador ?? ""} />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="text-sm font-semibold text-ink">Datos logísticos</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Cajas por pallet"
              name="cajas_por_pallet"
              type="number"
              min="1"
              defaultValue={salida.cajas_por_pallet ?? ""}
            />
            <Input
              label="Cantidad por caja"
              name="cantidad_por_caja"
              type="number"
              min="1"
              defaultValue={salida.cantidad_por_caja ?? ""}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Categoría de producto"
              name="categoria_producto"
              defaultValue={salida.categoria_producto ?? ""}
            />
            <Input label="Presentación" name="presentacion" defaultValue={salida.presentacion ?? ""} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Lote 1" name="lote_1" defaultValue={salida.lote_1 ?? ""} />
            <Input label="Lote 2" name="lote_2" defaultValue={salida.lote_2 ?? ""} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Número de contenedor"
              name="numero_contenedor"
              defaultValue={salida.numero_contenedor ?? ""}
            />
            <Input label="Número de BL" name="numero_bl" defaultValue={salida.numero_bl ?? ""} />
          </div>
        </div>

        <Textarea label="Observaciones" name="observaciones" defaultValue={salida.observaciones ?? ""} />

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Guardando…">Guardar corrección</SubmitButton>
          <ButtonLink href={`/lotes/${salida.lotes?.codigo_lote ?? ""}`} variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
