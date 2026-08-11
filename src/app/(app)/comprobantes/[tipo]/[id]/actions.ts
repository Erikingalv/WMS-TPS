"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirArchivos, subirDataUrl } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_SUBIR_EVIDENCIA, tienePermiso } from "@/lib/auth/permisos";

export async function firmarComprobante(
  tipo: "entrada" | "salida",
  id: string,
  formData: FormData
) {
  const firmaDataUrl = String(formData.get("firma_digital_dataurl") ?? "");
  if (!firmaDataUrl) {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent("Falta la firma.")}`);
  }

  const supabase = await createClient();

  let firma_digital_url: string;
  try {
    firma_digital_url = await subirDataUrl(
      supabase,
      "documentos",
      `firmas/${tipo}/${randomUUID()}.png`,
      firmaDataUrl
    );
  } catch {
    redirect(
      `/comprobantes/${tipo}/${id}?error=${encodeURIComponent("No se pudo subir la firma, intenta de nuevo.")}`
    );
  }

  const { error } = await supabase.rpc("guardar_firma_comprobante", {
    p_tipo: tipo,
    p_id: id,
    p_firma_digital_url: firma_digital_url,
  });

  if (error) {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/comprobantes/${tipo}/${id}`);
  revalidatePath("/comprobantes");
  redirect(`/comprobantes/${tipo}/${id}?firmado=1`);
}

export async function agregarEvidenciaFotos(
  tipo: "entrada" | "salida",
  id: string,
  formData: FormData
) {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  if (!usuario || !tienePermiso(usuario.rol, PUEDE_SUBIR_EVIDENCIA)) {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent("No tienes permiso para subir fotos.")}`);
  }

  const fotos = formData.getAll("fotos");
  try {
    const subidas = await subirArchivos(supabase, "documentos", `${tipo}s/${id}`, fotos);
    if (subidas.length > 0) {
      const { error } = await supabase.from("archivos_adjuntos").insert(
        subidas.map((f) => ({
          entidad_tipo: tipo,
          entidad_id: id,
          tipo_documento: "foto" as const,
          storage_path: f.path,
          nombre_archivo: f.nombre,
          subido_por: usuario.id,
        }))
      );
      if (error) throw error;
    }
  } catch {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent("No se pudieron guardar las fotos, intenta de nuevo.")}`);
  }

  const tabla = tipo === "entrada" ? "entradas" : "salidas";
  const { data: mov } = await supabase
    .from(tabla)
    .select("lotes(codigo_lote)")
    .eq("id", id)
    .single();
  const codigoLote = (mov as unknown as { lotes: { codigo_lote: string } | null } | null)?.lotes
    ?.codigo_lote;

  revalidatePath(`/comprobantes/${tipo}/${id}`);
  if (codigoLote) revalidatePath(`/lotes/${codigoLote}`);
  redirect(`/comprobantes/${tipo}/${id}?fotos=1`);
}
