"use client";

import { useTransition } from "react";
import { clsx } from "clsx";
import { cambiarEstadoUsuario } from "@/app/(app)/usuarios/actions";

export function EstadoUsuarioToggle({
  id,
  activo,
}: {
  id: string;
  activo: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => cambiarEstadoUsuario(id, !activo))}
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-50",
        activo ? "bg-ok-soft text-ok" : "bg-line/60 text-ink-soft"
      )}
    >
      {activo ? "Activo" : "Inactivo"}
    </button>
  );
}
