"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirDataUrl } from "@/lib/supabase/storage";
import { textoONulo } from "@/lib/utils/forms";

export async function crearSalida(formData: FormData) {
  const supabase = await createClient();

  const lote_id = String(formData.get("lote_id") ?? "");
  const ubicacion_id = String(formData.get("ubicacion_id") ?? "");
  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const destino = textoONulo(formData.get("destino"));
  const transportista = textoONulo(formData.get("transportista"));
  const placas = textoONulo(formData.get("placas"));
  const operador = textoONulo(formData.get("operador"));
  const autorizo_usuario_id = textoONulo(formData.get("autorizo_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const firmaDataUrl = textoONulo(formData.get("firma_digital_dataurl"));

  if (!lote_id || !ubicacion_id) {
    redirect(
      `/salidas/nueva?error=${encodeURIComponent("Selecciona un lote válido para surtir.")}`
    );
  }

  let firma_digital_url: string | null = null;
  if (firmaDataUrl) {
    try {
      firma_digital_url = await subirDataUrl(
        supabase,
        "documentos",
        `salidas/${randomUUID()}.png`,
        firmaDataUrl
      );
    } catch {
      // Continuamos sin firma si la subida falla; no bloquea la salida.
    }
  }

  const { data: salida, error } = await supabase.rpc("registrar_salida", {
    p_lote_id: lote_id,
    p_ubicacion_id: ubicacion_id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_destino: destino,
    p_transportista: transportista,
    p_placas: placas,
    p_operador: operador,
    p_autorizo_usuario_id: autorizo_usuario_id,
    p_observaciones: observaciones,
    p_firma_digital_url: firma_digital_url,
  });

  if (error || !salida) {
    redirect(
      `/salidas/nueva?error=${encodeURIComponent(error?.message ?? "No se pudo registrar la salida")}`
    );
  }

  revalidatePath("/salidas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo_lote")
    .eq("id", lote_id)
    .single();

  redirect(`/lotes/${lote?.codigo_lote ?? lote_id}`);
}
