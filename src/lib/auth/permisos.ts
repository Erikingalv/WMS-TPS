import type { RolUsuario, Usuario } from "@/lib/types/database";

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

export const PUEDE_GESTIONAR_AUDITORIAS: RolUsuario[] = ["administrador", "supervisor"];

export const PUEDE_ATENDER_ALERTAS: RolUsuario[] = ["administrador", "supervisor"];

export const PUEDE_CONFIGURAR_ALERTAS: RolUsuario[] = ["administrador"];

// Mismos roles que pueden registrar entradas/salidas (ver RLS de
// archivos_adjuntos): también pueden agregar fotos de evidencia después,
// no solo al capturar el movimiento.
export const PUEDE_SUBIR_EVIDENCIA: RolUsuario[] = [
  "administrador",
  "supervisor",
  "capturista",
];

// Permiso individual, no de rol: un administrador siempre puede corregir;
// cualquier otro rol solo si se le marca explícitamente en su cuenta
// (ver /usuarios). Refleja la función SQL puede_corregir_movimientos().
export function puedeCorregirMovimientos(
  usuario: Pick<Usuario, "rol" | "puede_corregir_movimientos">
): boolean {
  return usuario.rol === "administrador" || usuario.puede_corregir_movimientos;
}

export const PUEDE_VER_TARIFAS: RolUsuario[] = ["administrador", "supervisor"];

export const PUEDE_EDITAR_TARIFAS: RolUsuario[] = ["administrador"];

export function tienePermiso(rol: RolUsuario, permitidos: RolUsuario[]) {
  return permitidos.includes(rol);
}

export const ETIQUETA_ROL: Record<RolUsuario, string> = {
  administrador: "Administrador",
  supervisor: "Supervisor",
  capturista: "Capturista",
  consulta: "Consulta",
};
