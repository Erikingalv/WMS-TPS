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
    const params = new URLSearchParams({
      error: "Correo o contraseña incorrectos.",
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
