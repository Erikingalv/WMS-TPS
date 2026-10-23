"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";

export async function traspasarLoteAction(codigo: string, loteId: string, formData: FormData) {
  const supabase = await createClient();

  const cliente_destino_id = textoONulo(formData.get("cliente_destino_id"));
  const fecha = textoONulo(formData.get("fecha"));
  const ubicacion_origen_id = textoONulo(formData.get("ubicacion_origen_id"));
  const ubicacion_destino_id = textoONulo(formData.get("ubicacion_destino_id"));
  const motivo = textoONulo(formData.get("motivo"));

  const { error } = await supabase.rpc("traspasar_lote", {
    p_lote_id: loteId,
    p_cliente_destino_id: cliente_destino_id,
    p_fecha: fecha,
    p_ubicacion_origen_id: ubicacion_origen_id,
    p_ubicacion_destino_id: ubicacion_destino_id,
    p_motivo: motivo,
  });

  if (error) {
    redirect(`/lotes/${codigo}/traspaso?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/lotes/${codigo}`);
  revalidatePath("/inventario");
  revalidatePath("/movimientos");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
  redirect(`/lotes/${codigo}?traspaso=1`);
}
