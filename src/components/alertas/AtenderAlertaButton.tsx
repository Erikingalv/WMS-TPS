"use client";

import { useTransition } from "react";
import { Check } from "lucide-react";
import { marcarAlertaAtendida } from "@/app/(app)/alertas/actions";

export function AtenderAlertaButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => marcarAlertaAtendida(id))}
      className="flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      <Check size={13} /> Marcar atendida
    </button>
  );
}
