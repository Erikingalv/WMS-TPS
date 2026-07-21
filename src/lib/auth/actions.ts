"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

async function origen() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

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

export async function solicitarRecuperacion(formData: FormData) {
  const correo = String(formData.get("correo") ?? "").trim();

  if (correo) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(correo, {
      redirectTo: `${await origen()}/auth/callback?next=/reset-password`,
    });
  }

  // Mismo mensaje exista o no la cuenta, para no revelar qué correos están
  // registrados.
  redirect("/forgot-password?enviado=1");
}

export async function actualizarPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmacion = String(formData.get("confirmacion") ?? "");

  if (password.length < 8) {
    redirect(
      `/reset-password?error=${encodeURIComponent("La contraseña debe tener al menos 8 caracteres.")}`
    );
  }
  if (password !== confirmacion) {
    redirect(`/reset-password?error=${encodeURIComponent("Las contraseñas no coinciden.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect(`/reset-password?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/dashboard");
}
