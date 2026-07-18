"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRol } from "@/lib/auth/session";
import { PUEDE_GESTIONAR_USUARIOS } from "@/lib/auth/permisos";
import type { RolUsuario } from "@/lib/types/database";

export async function crearUsuario(formData: FormData) {
  await requireRol(PUEDE_GESTIONAR_USUARIOS);

  const nombre = String(formData.get("nombre") ?? "").trim();
  const correo = String(formData.get("correo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const rol = String(formData.get("rol") ?? "consulta") as RolUsuario;

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: correo,
    password,
    email_confirm: true,
    user_metadata: { nombre, rol },
  });

  if (error) {
    redirect(`/usuarios/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/usuarios");
  redirect("/usuarios");
}

export async function actualizarRolUsuario(id: string, rol: RolUsuario) {
  await requireRol(PUEDE_GESTIONAR_USUARIOS);

  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").update({ rol }).eq("id", id);

  if (!error) revalidatePath("/usuarios");
}

export async function cambiarEstadoUsuario(id: string, activo: boolean) {
  await requireRol(PUEDE_GESTIONAR_USUARIOS);

  const supabase = await createClient();
  const { error } = await supabase.from("usuarios").update({ activo }).eq("id", id);

  if (!error) revalidatePath("/usuarios");
}
