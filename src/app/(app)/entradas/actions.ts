"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirArchivos } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { numeroONulo, textoONulo } from "@/lib/utils/forms";

export async function crearEntrada(formData: FormData) {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const cliente_id = String(formData.get("cliente_id") ?? "");
  const producto_id = String(formData.get("producto_id") ?? "");
  const ubicacion_id = String(formData.get("ubicacion_id") ?? "");
  const cantidad_piezas = Number(formData.get("cantidad_piezas") ?? 0);
  const cantidad_tarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const peso_kg = numeroONulo(formData.get("peso_kg"));
  const recibio_usuario_id = textoONulo(formData.get("recibio_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const fecha_caducidad = textoONulo(formData.get("fecha_caducidad"));

  const { data: entrada, error } = await supabase.rpc("registrar_entrada", {
    p_cliente_id: cliente_id,
    p_producto_id: producto_id,
    p_ubicacion_id: ubicacion_id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_peso_kg: peso_kg,
    p_recibio_usuario_id: recibio_usuario_id,
    p_observaciones: observaciones,
    p_fecha_caducidad: fecha_caducidad,
  });

  if (error || !entrada) {
    redirect(
      `/entradas/nueva?error=${encodeURIComponent(error?.message ?? "No se pudo registrar la entrada")}`
    );
  }

  try {
    const fotos = formData.getAll("fotos");
    const documentos = formData.getAll("documentos");
    const carpeta = `entradas/${entrada.id}`;
    const subidasFotos = await subirArchivos(supabase, "documentos", carpeta, fotos);
    const subidasDocs = await subirArchivos(supabase, "documentos", carpeta, documentos);

    const filas = [
      ...subidasFotos.map((f) => ({
        entidad_tipo: "entrada" as const,
        entidad_id: entrada.id,
        tipo_documento: "foto" as const,
        storage_path: f.path,
        nombre_archivo: f.nombre,
        subido_por: usuario?.id ?? null,
      })),
      ...subidasDocs.map((f) => ({
        entidad_tipo: "entrada" as const,
        entidad_id: entrada.id,
        tipo_documento: "otro" as const,
        storage_path: f.path,
        nombre_archivo: f.nombre,
        subido_por: usuario?.id ?? null,
      })),
    ];

    if (filas.length > 0) {
      await supabase.from("archivos_adjuntos").insert(filas);
    }
  } catch {
    // La entrada ya quedó registrada aunque falle la subida de adjuntos;
    // no revertimos el movimiento por un problema de archivos.
  }

  revalidatePath("/entradas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");

  const { data: lote } = await supabase
    .from("lotes")
    .select("codigo_lote")
    .eq("id", entrada.lote_id)
    .single();

  redirect(`/lotes/${lote?.codigo_lote ?? entrada.lote_id}`);
}
