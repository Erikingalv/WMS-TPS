"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { registrarConteo } from "@/app/(app)/auditorias/actions";

export function ConteoRow({
  detalleId,
  piezasIniciales,
  tarimasIniciales,
  disabled,
}: {
  detalleId: string;
  piezasIniciales: number | null;
  tarimasIniciales: number | null;
  disabled?: boolean;
}) {
  const [piezas, setPiezas] = useState(piezasIniciales ?? "");
  const [tarimas, setTarimas] = useState(tarimasIniciales ?? "");
  const [pending, startTransition] = useTransition();
  const [guardado, setGuardado] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min="0"
        value={piezas}
        disabled={disabled}
        onChange={(e) => setPiezas(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-9 w-20 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        placeholder="pz"
      />
      <input
        type="number"
        min="0"
        value={tarimas}
        disabled={disabled}
        onChange={(e) => setTarimas(e.target.value === "" ? "" : Number(e.target.value))}
        className="h-9 w-16 rounded-md border border-line bg-paper-raised px-2 text-sm outline-none focus:border-accent disabled:opacity-50"
        placeholder="tar"
      />
      {!disabled && (
        <button
          type="button"
          disabled={pending || piezas === "" || tarimas === ""}
          onClick={() =>
            startTransition(async () => {
              await registrarConteo(detalleId, Number(piezas), Number(tarimas));
              setGuardado(true);
            })
          }
          className="flex size-9 items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-40"
          aria-label="Guardar conteo"
        >
          <Check size={16} className={guardado ? "text-ok" : undefined} />
        </button>
      )}
    </div>
  );
}
