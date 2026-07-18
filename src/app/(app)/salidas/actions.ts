"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirDataUrl } from "@/lib/supabase/storage";
import { numeroONulo, textoONulo } from "@/lib/utils/forms";

export async function crearSalida(formData: FormData) {
  const supabase = await createClient();

  const lote_id = String(formData.get("lote_id") ?? "");
  const ubicacion_id = String(formData.get("ubicacion_id") ?? "");
  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const fecha_movimiento = String(formData.get("fecha") ?? "");
  const hora_carga_descarga = String(formData.get("hora_carga_descarga") ?? "");
  const destino = textoONulo(formData.get("destino"));
  const transportista = textoONulo(formData.get("transportista"));
  const placas = textoONulo(formData.get("placas"));
  const operador = textoONulo(formData.get("operador"));
  const autorizo_usuario_id = textoONulo(formData.get("autorizo_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const firmaDataUrl = textoONulo(formData.get("firma_digital_dataurl"));
  const cajas_por_pallet = numeroONulo(formData.get("cajas_por_pallet"));
  const cantidad_por_caja = numeroONulo(formData.get("cantidad_por_caja"));
  const categoria_producto = textoONulo(formData.get("categoria_producto"));
  const lote_1 = textoONulo(formData.get("lote_1"));
  const lote_2 = textoONulo(formData.get("lote_2"));
  const numero_contenedor = textoONulo(formData.get("numero_contenedor"));
  const numero_bl = textoONulo(formData.get("numero_bl"));
  const presentacion = textoONulo(formData.get("presentacion"));

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
    p_fecha_movimiento: fecha_movimiento,
    p_hora_carga_descarga: hora_carga_descarga,
    p_destino: destino,
    p_transportista: transportista,
    p_placas: placas,
    p_operador: operador,
    p_autorizo_usuario_id: autorizo_usuario_id,
    p_observaciones: observaciones,
    p_firma_digital_url: firma_digital_url,
    p_cajas_por_pallet: cajas_por_pallet,
    p_cantidad_por_caja: cantidad_por_caja,
    p_categoria_producto: categoria_producto,
    p_lote_1: lote_1,
    p_lote_2: lote_2,
    p_numero_contenedor: numero_contenedor,
    p_numero_bl: numero_bl,
    p_presentacion: presentacion,
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
