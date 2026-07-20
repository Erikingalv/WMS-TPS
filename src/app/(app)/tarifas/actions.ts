"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type EscalonEntrada = {
  dia_inicio: number;
  dia_fin: number | null;
  costo_por_tarima: number;
  es_gratis: boolean;
};

export async function guardarTarifa(clienteId: string, formData: FormData) {
  const supabase = await createClient();

  const nombre = String(formData.get("nombre") ?? "").trim() || "Tarifa estándar";
  const periodicidad = String(formData.get("periodicidad") ?? "diario");
  const costo_maniobra_entrada = Number(formData.get("costo_maniobra_entrada") ?? 0) || 0;
  const costo_maniobra_salida = Number(formData.get("costo_maniobra_salida") ?? 0) || 0;

  let escalones: EscalonEntrada[] = [];
  try {
    escalones = JSON.parse(String(formData.get("escalones_json") ?? "[]"));
  } catch {
    // Si el JSON viene corrupto, seguimos sin escalones en vez de tronar.
  }

  // Se conserva la tarifa anterior como historial; solo queda una activa.
  await supabase
    .from("tarifas_almacenaje")
    .update({ activo: false })
    .eq("cliente_id", clienteId)
    .eq("activo", true);

  const { data: tarifa, error } = await supabase
    .from("tarifas_almacenaje")
    .insert({
      cliente_id: clienteId,
      nombre,
      periodicidad: periodicidad as "diario" | "semanal" | "mensual",
      costo_maniobra_entrada,
      costo_maniobra_salida,
    })
    .select()
    .single();

  if (error || !tarifa) {
    redirect(
      `/tarifas/${clienteId}?error=${encodeURIComponent(error?.message ?? "No se pudo guardar la tarifa")}`
    );
  }

  if (escalones.length > 0) {
    await supabase.from("tarifa_escalones").insert(
      escalones.map((e) => ({
        tarifa_id: tarifa.id,
        dia_inicio: e.dia_inicio,
        dia_fin: e.dia_fin,
        costo_por_tarima: e.costo_por_tarima,
        es_gratis: e.es_gratis,
      }))
    );
  }

  revalidatePath("/tarifas");
  revalidatePath(`/tarifas/${clienteId}`);
  redirect("/tarifas");
}

export async function recalcularCargos() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("calcular_cargos_almacenaje");
  revalidatePath("/tarifas");
  return { error: error?.message ?? null };
}
