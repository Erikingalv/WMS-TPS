"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { SubmitButton, ButtonLink, Button } from "@/components/ui/Button";
import type { TarifaAlmacenaje, TarifaEscalon } from "@/lib/types/database";

type Escalon = {
  dia_inicio: number;
  dia_fin: number | null;
  costo_por_tarima: number;
  es_gratis: boolean;
};

export function TarifaForm({
  action,
  tarifaActual,
  escalonesActuales,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  tarifaActual?: TarifaAlmacenaje;
  escalonesActuales: TarifaEscalon[];
  error?: string;
}) {
  const [escalones, setEscalones] = useState<Escalon[]>(
    escalonesActuales.length > 0
      ? escalonesActuales.map((e) => ({
          dia_inicio: e.dia_inicio,
          dia_fin: e.dia_fin,
          costo_por_tarima: e.costo_por_tarima,
          es_gratis: e.es_gratis,
        }))
      : [{ dia_inicio: 0, dia_fin: null, costo_por_tarima: 0, es_gratis: false }]
  );

  function actualizar(i: number, cambios: Partial<Escalon>) {
    setEscalones((prev) => prev.map((e, idx) => (idx === i ? { ...e, ...cambios } : e)));
  }

  function agregar() {
    const ultimo = escalones[escalones.length - 1];
    const siguienteInicio = ultimo?.dia_fin != null ? ultimo.dia_fin + 1 : (ultimo?.dia_inicio ?? 0) + 1;
    setEscalones((prev) => [
      ...prev,
      { dia_inicio: siguienteInicio, dia_fin: null, costo_por_tarima: 0, es_gratis: false },
    ]);
  }

  function quitar(i: number) {
    setEscalones((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={action} className="flex max-w-3xl flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Nombre de la tarifa" name="nombre" defaultValue={tarifaActual?.nombre ?? "Tarifa estándar"} required />
        <Select label="Periodicidad mostrada al cliente" name="periodicidad" defaultValue={tarifaActual?.periodicidad ?? "diario"}>
          <option value="diario">Diaria</option>
          <option value="semanal">Semanal</option>
          <option value="mensual">Mensual</option>
        </Select>
      </div>

      <div className="rounded-lg border border-line p-4">
        <p className="mb-1 text-[13px] font-medium text-ink-soft">Cobro por maniobra</p>
        <p className="mb-3 text-xs text-ink-faint">
          Costo fijo por tarima, aparte del almacenaje: se cobra una vez por cada tarima que entra
          y una vez por cada tarima que sale.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            label="$ por tarima de entrada"
            name="costo_maniobra_entrada"
            type="number"
            min="0"
            step="0.01"
            defaultValue={tarifaActual?.costo_maniobra_entrada ?? 0}
          />
          <Input
            label="$ por tarima de salida"
            name="costo_maniobra_salida"
            type="number"
            min="0"
            step="0.01"
            defaultValue={tarifaActual?.costo_maniobra_salida ?? 0}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[13px] font-medium text-ink-soft">Escalones por día almacenado</p>
          <Button type="button" variant="secondary" size="sm" onClick={agregar}>
            <Plus size={14} /> Agregar escalón
          </Button>
        </div>
        <p className="mb-3 text-xs text-ink-faint">
          El costo siempre es por tarima, por día. Ej.: días 0–4 gratis, día 5 en adelante $18.00 —
          dos escalones: (0, 4, gratis) y (5, en adelante, $18.00).
        </p>

        <div className="flex flex-col gap-2">
          {escalones.map((e, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-faint">Día desde</label>
                <input
                  type="number"
                  min="0"
                  value={e.dia_inicio}
                  onChange={(ev) => actualizar(i, { dia_inicio: Number(ev.target.value) })}
                  className="h-9 w-20 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-faint">Día hasta</label>
                <input
                  type="number"
                  min={e.dia_inicio}
                  value={e.dia_fin ?? ""}
                  placeholder="en adelante"
                  onChange={(ev) =>
                    actualizar(i, { dia_fin: ev.target.value === "" ? null : Number(ev.target.value) })
                  }
                  className="h-9 w-28 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-faint">$ por tarima/día</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={e.es_gratis}
                  value={e.costo_por_tarima}
                  onChange={(ev) => actualizar(i, { costo_por_tarima: Number(ev.target.value) })}
                  className="h-9 w-28 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none focus:border-accent disabled:opacity-40"
                />
              </div>
              <label className="flex items-center gap-1.5 pb-2 text-xs text-ink-soft">
                <input
                  type="checkbox"
                  checked={e.es_gratis}
                  onChange={(ev) => actualizar(i, { es_gratis: ev.target.checked })}
                />
                Gratis
              </label>
              <button
                type="button"
                onClick={() => quitar(i)}
                className="ml-auto flex size-9 items-center justify-center rounded-md text-ink-faint hover:bg-crit-soft hover:text-crit"
                aria-label="Quitar escalón"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <input type="hidden" name="escalones_json" value={JSON.stringify(escalones)} />

      <div className="flex gap-3 pt-2">
        <SubmitButton>Guardar tarifa</SubmitButton>
        <ButtonLink href="/tarifas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
