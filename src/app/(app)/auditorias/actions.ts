"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { textoONulo } from "@/lib/utils/forms";

export async function iniciarAuditoria(formData: FormData) {
  const supabase = await createClient();
  const observaciones = textoONulo(formData.get("observaciones"));

  const { data: auditoria, error } = await supabase.rpc("iniciar_auditoria", {
    p_observaciones: observaciones,
  });

  if (error || !auditoria) {
    redirect(
      `/auditorias/nueva?error=${encodeURIComponent(error?.message ?? "No se pudo iniciar la auditoría")}`
    );
  }

  revalidatePath("/auditorias");
  redirect(`/auditorias/${auditoria.id}`);
}

export async function registrarConteo(
  detalleId: string,
  piezas: number,
  tarimas: number
) {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const { data } = await supabase
    .from("auditoria_detalle")
    .update({
      cantidad_fisica_piezas: piezas,
      cantidad_fisica_tarimas: tarimas,
      contado_por: usuario?.id ?? null,
      contado_at: new Date().toISOString(),
    })
    .eq("id", detalleId)
    .select("auditoria_id")
    .single();

  if (data) revalidatePath(`/auditorias/${data.auditoria_id}`);
}

export async function cerrarAuditoria(id: string) {
  const supabase = await createClient();
  await supabase.rpc("cerrar_auditoria", { p_auditoria_id: id });
  revalidatePath(`/auditorias/${id}`);
  revalidatePath("/auditorias");
}
