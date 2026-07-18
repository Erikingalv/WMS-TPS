"use client";

import { useTransition } from "react";
import { actualizarRolUsuario } from "@/app/(app)/usuarios/actions";
import { ETIQUETA_ROL } from "@/lib/auth/permisos";
import type { RolUsuario } from "@/lib/types/database";

const ROLES: RolUsuario[] = [
  "administrador",
  "supervisor",
  "capturista",
  "consulta",
];

export function RolSelector({
  id,
  rolActual,
  disabled,
}: {
  id: string;
  rolActual: RolUsuario;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      defaultValue={rolActual}
      disabled={disabled || pending}
      onChange={(e) => {
        const rol = e.target.value as RolUsuario;
        startTransition(() => {
          actualizarRolUsuario(id, rol);
        });
      }}
      className="h-9 rounded-lg border border-line bg-paper-raised px-2.5 text-sm text-ink outline-none transition-colors focus:border-accent disabled:opacity-50"
    >
      {ROLES.map((rol) => (
        <option key={rol} value={rol}>
          {ETIQUETA_ROL[rol]}
        </option>
      ))}
    </select>
  );
}
