"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";

export async function crearMovimiento(formData: FormData) {
  const supabase = await createClient();

  const lote_id = String(formData.get("lote_id") ?? "");
  const ubicacion_origen_id = String(formData.get("ubicacion_origen_id") ?? "");
  const ubicacion_destino_id = String(formData.get("ubicacion_destino_id") ?? "");
  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const motivo = textoONulo(formData.get("motivo"));

  if (!lote_id || !ubicacion_origen_id || !ubicacion_destino_id) {
    redirect(
      `/movimientos/nuevo?error=${encodeURIComponent("Selecciona el lote de origen y la ubicación destino.")}`
    );
  }

  const { data: movimiento, error } = await supabase.rpc("registrar_movimiento_interno", {
    p_lote_id: lote_id,
    p_ubicacion_origen_id: ubicacion_origen_id,
    p_ubicacion_destino_id: ubicacion_destino_id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_motivo: motivo,
  });

  if (error || !movimiento) {
    redirect(
      `/movimientos/nuevo?error=${encodeURIComponent(error?.message ?? "No se pudo registrar el movimiento")}`
    );
  }

  revalidatePath("/movimientos");
  revalidatePath("/inventario");
  revalidatePath("/dashboard");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo_lote")
    .eq("id", lote_id)
    .single();

  redirect(`/lotes/${lote?.codigo_lote ?? lote_id}`);
}
