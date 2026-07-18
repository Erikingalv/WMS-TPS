"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { generarAlertasAhora } from "@/app/(app)/alertas/actions";

export function GenerarAlertasButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await generarAlertasAhora();
            setError(res.error);
          })
        }
      >
        <RefreshCw size={16} className={pending ? "animate-spin" : undefined} />
        {pending ? "Revisando…" : "Generar alertas ahora"}
      </Button>
      {error && <p className="text-xs text-crit">{error}</p>}
    </div>
  );
}
