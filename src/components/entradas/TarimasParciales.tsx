"use client";

import { useState } from "react";
import { TarimasParcialesEditor } from "@/components/entradas/TarimasParcialesEditor";
import type { TarimaParcial } from "@/lib/types/database";

// Envuelve TarimasParcialesEditor con su propio estado + input oculto,
// para usarse directo dentro de un <form> (página de editar una entrada).
export function TarimasParciales({ defaultValue = [] }: { defaultValue?: TarimaParcial[] }) {
  const [parciales, setParciales] = useState<TarimaParcial[]>(defaultValue);

  return (
    <div className="flex flex-col gap-2.5">
      <TarimasParcialesEditor value={parciales} onChange={setParciales} />
      <input type="hidden" name="tarimas_parciales_json" value={JSON.stringify(parciales)} />
    </div>
  );
}
