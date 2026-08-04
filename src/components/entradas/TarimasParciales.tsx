"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TarimaParcial } from "@/lib/types/database";

// Excepciones al reparto parejo de piezas por tarima: por defecto el
// sistema reparte piezas/tarimas en partes iguales entre todas las
// tarimas del lote, pero una o varias pueden traer menos material (ej. la
// última tarima de un embarque). El resto se sigue repartiendo parejo con
// lo que queda después de restar estas excepciones.
export function TarimasParciales({ defaultValue = [] }: { defaultValue?: TarimaParcial[] }) {
  const [parciales, setParciales] = useState<TarimaParcial[]>(defaultValue);

  function agregar() {
    setParciales((prev) => [...prev, { numero_tarima: null, piezas: 0 }]);
  }

  function actualizar(i: number, cambios: Partial<TarimaParcial>) {
    setParciales((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  }

  function quitar(i: number) {
    setParciales((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-ink-soft">
          Tarimas con menos material (parciales)
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={agregar}>
          <Plus size={14} /> Agregar tarima parcial
        </Button>
      </div>
      <p className="text-xs text-ink-faint">
        Opcional. Por defecto las piezas se reparten parejo entre todas las tarimas; usa esto solo
        para las que traigan menos (ej. la última tarima de un embarque).
      </p>

      {parciales.length > 0 && (
        <div className="flex flex-col gap-2">
          {parciales.map((p, i) => (
            <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border border-line p-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-faint">Piezas en esa tarima</label>
                <input
                  type="number"
                  min="1"
                  value={p.piezas || ""}
                  onChange={(ev) => actualizar(i, { piezas: Number(ev.target.value) })}
                  className="h-9 w-28 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none focus:border-accent"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-ink-faint">Número de tarima (si aplica)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="opcional"
                  value={p.numero_tarima ?? ""}
                  onChange={(ev) =>
                    actualizar(i, {
                      numero_tarima: ev.target.value === "" ? null : Number(ev.target.value),
                    })
                  }
                  className="h-9 w-32 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none placeholder:text-ink-faint focus:border-accent"
                />
              </div>
              <button
                type="button"
                onClick={() => quitar(i)}
                className="ml-auto flex size-9 items-center justify-center rounded-md text-ink-faint hover:bg-crit-soft hover:text-crit"
                aria-label="Quitar tarima parcial"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name="tarimas_parciales_json" value={JSON.stringify(parciales)} />
    </div>
  );
}
