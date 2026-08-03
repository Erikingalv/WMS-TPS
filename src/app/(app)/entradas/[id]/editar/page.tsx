import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_CORREGIR_MOVIMIENTOS, tienePermiso } from "@/lib/auth/permisos";
import { Input, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { FilaEntrada } from "@/lib/reportes/columnas";
import { corregirEntradaAction } from "./actions";

export default async function EditarEntradaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const usuario = await getUsuarioActual();
  if (!usuario || !tienePermiso(usuario.rol, PUEDE_CORREGIR_MOVIMIENTOS)) {
    redirect("/entradas");
  }

  const supabase = await createClient();
  const { data: entradaRaw } = await supabase
    .from("entradas")
    .select("*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo)")
    .eq("id", id)
    .single();

  if (!entradaRaw) notFound();
  const entrada = entradaRaw as unknown as FilaEntrada;

  const corregirConId = corregirEntradaAction.bind(null, id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Corregir entrada</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {entrada.clientes?.nombre ?? "—"} · {entrada.productos?.nombre ?? "—"} ·{" "}
          <span className="font-mono">{entrada.lotes?.codigo_lote ?? "—"}</span> ·{" "}
          {entrada.ubicaciones?.codigo ?? "—"}
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

        <div className="grid gap-5 sm:grid-cols-3">
          <Input
            label="Piezas"
            name="cantidad_piezas"
            type="number"
            min="1"
            required
            defaultValue={entrada.cantidad_piezas}
          />
          <Input
            label="Tarimas"
            name="cantidad_tarimas"
            type="number"
            min="1"
            required
            defaultValue={entrada.cantidad_tarimas}
          />
          <Input
            label="Peso (kg)"
            name="peso_kg"
            type="number"
            step="0.001"
            min="0"
            defaultValue={entrada.peso_kg ?? ""}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="Tarima desde"
            name="tarima_desde"
            type="number"
            min="1"
            defaultValue={entrada.tarima_desde ?? ""}
          />
          <Input
            label="Tarima hasta"
            name="tarima_hasta"
            type="number"
            min="1"
            defaultValue={entrada.tarima_hasta ?? ""}
          />
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
          <p className="text-sm font-semibold text-ink">Datos logísticos</p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Cajas por pallet"
              name="cajas_por_pallet"
              type="number"
              min="1"
              defaultValue={entrada.cajas_por_pallet ?? ""}
            />
            <Input
              label="Cantidad por caja"
              name="cantidad_por_caja"
              type="number"
              min="1"
              defaultValue={entrada.cantidad_por_caja ?? ""}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Categoría de producto"
              name="categoria_producto"
              defaultValue={entrada.categoria_producto ?? ""}
            />
            <Input label="Presentación" name="presentacion" defaultValue={entrada.presentacion ?? ""} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input label="Lote 1" name="lote_1" defaultValue={entrada.lote_1 ?? ""} />
            <Input label="Lote 2" name="lote_2" defaultValue={entrada.lote_2 ?? ""} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <Input
              label="Número de contenedor"
              name="numero_contenedor"
              defaultValue={entrada.numero_contenedor ?? ""}
            />
            <Input label="Número de BL" name="numero_bl" defaultValue={entrada.numero_bl ?? ""} />
          </div>
        </div>

        <Textarea label="Observaciones" name="observaciones" defaultValue={entrada.observaciones ?? ""} />

        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Guardando…">Guardar corrección</SubmitButton>
          <ButtonLink href={`/lotes/${entrada.lotes?.codigo_lote ?? ""}`} variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
