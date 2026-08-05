"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { cambiarPuedeCorregirMovimientos } from "@/app/(app)/usuarios/actions";

export function CorregirMovimientosToggle({
  id,
  valor,
}: {
  id: string;
  valor: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => cambiarPuedeCorregirMovimientos(id, !valor))}
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-50",
        valor ? "bg-ok-soft text-ok" : "bg-line/60 text-ink-soft"
      )}
    >
      {valor ? "Sí" : "No"}
    </button>
  );
}
