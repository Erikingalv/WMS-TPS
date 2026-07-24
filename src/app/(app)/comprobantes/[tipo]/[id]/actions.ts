"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirDataUrl } from "@/lib/supabase/storage";

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
