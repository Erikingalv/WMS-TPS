import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { RolUsuario, Usuario } from "@/lib/types/database";

// `cache()` deduplica dentro de la misma request: el layout y la página
// pueden llamar a esto sin duplicar la consulta a la base de datos.
export const getUsuarioActual = cache(async (): Promise<Usuario | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return data;
});

// Para usar en layouts/páginas del área autenticada. El proxy ya redirige a
// /login si no hay sesión; esto además cubre el caso de una cuenta
// desactivada con una sesión todavía vigente.
export async function requireUsuario(): Promise<Usuario> {
  const usuario = await getUsuarioActual();
  if (!usuario || !usuario.activo) {
    redirect("/login?desactivado=1");
  }
  return usuario;
}

// Para Server Actions/páginas restringidas a ciertos roles (ej. Usuarios,
// solo Administrador). La RLS es la autoridad real; esto evita que alguien
// sin permiso llegue siquiera a intentar la operación.
export async function requireRol(permitidos: RolUsuario[]): Promise<Usuario> {
  const usuario = await requireUsuario();
  if (!permitidos.includes(usuario.rol)) {
    redirect("/dashboard");
  }
  return usuario;
}
