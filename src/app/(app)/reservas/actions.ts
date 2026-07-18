"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";

export async function crearReserva(formData: FormData) {
  const supabase = await createClient();

  const lote_id = String(formData.get("lote_id") ?? "");
  const ubicacion_id = String(formData.get("ubicacion_id") ?? "");
  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const observaciones = textoONulo(formData.get("observaciones"));

  if (!lote_id || !ubicacion_id) {
    redirect(
      `/reservas/nueva?error=${encodeURIComponent("Selecciona un lote válido para reservar.")}`
    );
  }

  const { data: reserva, error } = await supabase.rpc("registrar_reserva", {
    p_lote_id: lote_id,
    p_ubicacion_id: ubicacion_id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_observaciones: observaciones,
  });

  if (error || !reserva) {
    redirect(
      `/reservas/nueva?error=${encodeURIComponent(error?.message ?? "No se pudo registrar la reserva")}`
    );
  }

  revalidatePath("/reservas");
  revalidatePath("/inventario");
  redirect("/reservas");
}

export async function liberarReserva(id: string) {
  const supabase = await createClient();
  await supabase.rpc("liberar_reserva", { p_reserva_id: id });
  revalidatePath("/reservas");
  revalidatePath("/inventario");
}
