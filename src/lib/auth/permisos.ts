import type { RolUsuario } from "@/lib/types/database";

// Refleja las políticas RLS de supabase/migrations/0002_rls_fase1.sql — la
// base de datos es quien realmente aplica el permiso; esto solo evita
// mostrar controles que el backend rechazaría.
export const PUEDE_EDITAR_CLIENTES: RolUsuario[] = [
  "administrador",
  "supervisor",
  "capturista",
];

export const PUEDE_EDITAR_PRODUCTOS: RolUsuario[] = [
  "administrador",
  "supervisor",
  "capturista",
];

export const PUEDE_EDITAR_UBICACIONES: RolUsuario[] = [
  "administrador",
  "supervisor",
];

export const PUEDE_GESTIONAR_USUARIOS: RolUsuario[] = ["administrador"];

export function tienePermiso(rol: RolUsuario, permitidos: RolUsuario[]) {
  return permitidos.includes(rol);
}

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  capturista: "Capturista",
  consulta: "Consulta",
};
