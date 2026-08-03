"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numeroONulo, textoONulo } from "@/lib/utils/forms";

export async function corregirSalidaAction(id: string, formData: FormData) {
  const supabase = await createClient();

  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const destino = textoONulo(formData.get("destino"));
  const transportista = textoONulo(formData.get("transportista"));
  const placas = textoONulo(formData.get("placas"));
  const operador = textoONulo(formData.get("operador"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const cajas_por_pallet = numeroONulo(formData.get("cajas_por_pallet"));
  const cantidad_por_caja = numeroONulo(formData.get("cantidad_por_caja"));
  const categoria_producto = textoONulo(formData.get("categoria_producto"));
  const lote_1 = textoONulo(formData.get("lote_1"));
  const lote_2 = textoONulo(formData.get("lote_2"));
  const numero_contenedor = textoONulo(formData.get("numero_contenedor"));
  const numero_bl = textoONulo(formData.get("numero_bl"));
  const presentacion = textoONulo(formData.get("presentacion"));
  const tarima_desde = numeroONulo(formData.get("tarima_desde"));
  const tarima_hasta = numeroONulo(formData.get("tarima_hasta"));

  const { data: salida, error } = await supabase.rpc("corregir_salida", {
    p_salida_id: id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_destino: destino,
    p_transportista: transportista,
    p_placas: placas,
    p_operador: operador,
    p_observaciones: observaciones,
    p_cajas_por_pallet: cajas_por_pallet,
    p_cantidad_por_caja: cantidad_por_caja,
    p_categoria_producto: categoria_producto,
    p_lote_1: lote_1,
    p_lote_2: lote_2,
    p_numero_contenedor: numero_contenedor,
    p_numero_bl: numero_bl,
    p_presentacion: presentacion,
    p_tarima_desde: tarima_desde,
    p_tarima_hasta: tarima_hasta,
  });

  if (error || !salida) {
    redirect(
      `/salidas/${id}/editar?error=${encodeURIComponent(error?.message ?? "No se pudo corregir la salida")}`
    );
  }

  revalidatePath("/salidas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");
  revalidatePath("/reportes");
  revalidatePath("/comprobantes");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo_lote")
    .eq("id", salida.lote_id)
    .single();

  redirect(`/lotes/${lote?.codigo_lote ?? salida.lote_id}?corregido=1`);
}
