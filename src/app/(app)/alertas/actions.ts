"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function generarAlertasAhora() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("generar_alertas");
  revalidatePath("/alertas");
  return { error: error?.message ?? null };
}

export async function marcarAlertaAtendida(id: string) {
  const supabase = await createClient();
  await supabase.rpc("marcar_alerta_atendida", { p_alerta_id: id });
  revalidatePath("/alertas");
}
