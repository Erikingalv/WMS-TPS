"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirDataUrl } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_SUBIR_EVIDENCIA, tienePermiso } from "@/lib/auth/permisos";
import type { ArchivoSubido } from "@/lib/utils/subidaCliente";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Un embarque/viaje consolidado registra un movimiento por producto, todos
// con el mismo grupo_id — firmar o agregar evidencia debe aplicar a todos
// ellos, no solo a la línea que se estaba viendo.
async function idsDelGrupo(
  supabase: SupabaseServerClient,
  tipo: "entrada" | "salida",
  id: string
): Promise<string[]> {
  const tabla = tipo === "entrada" ? "entradas" : "salidas";
  const { data: base } = await supabase.from(tabla).select("grupo_id").eq("id", id).single();
  if (!base) return [id];
  const { data: hermanos } = await supabase.from(tabla).select("id").eq("grupo_id", base.grupo_id);
  const ids = (hermanos ?? []).map((r) => r.id as string);
  return ids.length > 0 ? ids : [id];
}

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

  const ids = await idsDelGrupo(supabase, tipo, id);
  let algunaFirmada = false;
  for (const idMiembro of ids) {
    const { error } = await supabase.rpc("guardar_firma_comprobante", {
      p_tipo: tipo,
      p_id: idMiembro,
      p_firma_digital_url: firma_digital_url,
    });
    if (!error) algunaFirmada = true;
  }

  if (!algunaFirmada) {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent("No se pudo guardar la firma.")}`);
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

  let subidas: ArchivoSubido[];
  try {
    const valor = JSON.parse(String(formData.get("fotos") ?? "[]"));
    subidas = Array.isArray(valor) ? valor : [];
  } catch {
    subidas = [];
  }

  const ids = await idsDelGrupo(supabase, tipo, id);

  try {
    if (subidas.length > 0) {
      const filas = ids.flatMap((idMiembro) =>
        subidas.map((f) => ({
          entidad_tipo: tipo,
          entidad_id: idMiembro,
          tipo_documento: "foto" as const,
          storage_path: f.path,
          nombre_archivo: f.nombre,
          subido_por: usuario.id,
        }))
      );
      const { error } = await supabase.from("archivos_adjuntos").insert(filas);
      if (error) throw error;
    }
  } catch {
    redirect(`/comprobantes/${tipo}/${id}?error=${encodeURIComponent("No se pudieron guardar las fotos, intenta de nuevo.")}`);
  }

  const tabla = tipo === "entrada" ? "entradas" : "salidas";
  const { data: movs } = await supabase.from(tabla).select("lotes(codigo_lote)").in("id", ids);
  const codigosLote = (movs as unknown as { lotes: { codigo_lote: string } | null }[] | null)
    ?.map((m) => m.lotes?.codigo_lote)
    .filter((c): c is string => !!c);

  revalidatePath(`/comprobantes/${tipo}/${id}`);
  codigosLote?.forEach((codigo) => revalidatePath(`/lotes/${codigo}`));
  redirect(`/comprobantes/${tipo}/${id}?fotos=1`);
}
