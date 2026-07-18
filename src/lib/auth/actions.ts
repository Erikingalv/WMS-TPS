"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const correo = String(formData.get("correo") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/dashboard") || "/dashboard";

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: correo,
    password,
  });

  if (error) {
    // Log temporal de diagnóstico — quitar una vez resuelto el problema de
    // login en producción.
    console.error("[signIn] Supabase error:", {
      message: error.message,
      status: error.status,
      code: error.code,
    });
    const params = new URLSearchParams({
      error: `Correo o contraseña incorrectos. [DEBUG: ${error.message}]`,
      redirect: redirectTo,
    });
    redirect(`/login?${params.toString()}`);
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
