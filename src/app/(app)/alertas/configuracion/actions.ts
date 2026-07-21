"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function guardarConfiguracionAlertas(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const umbral_dias_amarillo = Number(formData.get("umbral_dias_amarillo") ?? 0);
  const umbral_dias_naranja = Number(formData.get("umbral_dias_naranja") ?? 0);
  const umbral_dias_rojo = Number(formData.get("umbral_dias_rojo") ?? 0);
  const umbral_ocupacion_pct = Number(formData.get("umbral_ocupacion_pct") ?? 0);
  const umbral_caducidad_dias = Number(formData.get("umbral_caducidad_dias") ?? 0);

  if (umbral_dias_amarillo > umbral_dias_naranja || umbral_dias_naranja > umbral_dias_rojo) {
    redirect(
      `/alertas/configuracion?error=${encodeURIComponent(
        "El umbral amarillo debe ser menor o igual al naranja, y el naranja menor o igual al rojo."
      )}`
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracion_alertas")
    .update({
      umbral_dias_amarillo,
      umbral_dias_naranja,
      umbral_dias_rojo,
      umbral_ocupacion_pct,
      umbral_caducidad_dias,
    })
    .eq("id", id);

  if (error) {
    redirect(`/alertas/configuracion?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/alertas/configuracion");
  revalidatePath("/alertas");
  redirect("/alertas?guardado=1");
}
