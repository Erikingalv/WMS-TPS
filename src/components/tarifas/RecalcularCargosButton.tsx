"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { recalcularCargos } from "@/app/(app)/tarifas/actions";

export function RecalcularCargosButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await recalcularCargos();
            setError(res.error);
          })
        }
      >
        <RefreshCw size={16} className={pending ? "animate-spin" : undefined} />
        {pending ? "Calculando…" : "Recalcular cargos"}
      </Button>
      {error && <p className="text-xs text-crit">{error}</p>}
    </div>
  );
}
