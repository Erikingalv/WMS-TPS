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
  const fecha_movimiento = String(formData.get("fecha") ?? "");
  const hora_carga_descarga = String(formData.get("hora_carga_descarga") ?? "");
  const peso_kg = numeroONulo(formData.get("peso_kg"));
  const recibio_usuario_id = textoONulo(formData.get("recibio_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const fecha_caducidad = textoONulo(formData.get("fecha_caducidad"));
  const cajas_por_pallet = numeroONulo(formData.get("cajas_por_pallet"));
  const cantidad_por_caja = numeroONulo(formData.get("cantidad_por_caja"));
  const categoria_producto = textoONulo(formData.get("categoria_producto"));
  const lote_1 = textoONulo(formData.get("lote_1"));
  const lote_2 = textoONulo(formData.get("lote_2"));
  const numero_contenedor = textoONulo(formData.get("numero_contenedor"));
  const numero_bl = textoONulo(formData.get("numero_bl"));
  const presentacion = textoONulo(formData.get("presentacion"));

  const { data: entrada, error } = await supabase.rpc("registrar_entrada", {
    p_cliente_id: cliente_id,
    p_producto_id: producto_id,
    p_ubicacion_id: ubicacion_id,
    p_cantidad_piezas: cantidad_piezas,
    p_cantidad_tarimas: cantidad_tarimas,
    p_fecha_movimiento: fecha_movimiento,
    p_hora_carga_descarga: hora_carga_descarga,
    p_peso_kg: peso_kg,
    p_recibio_usuario_id: recibio_usuario_id,
    p_observaciones: observaciones,
    p_fecha_caducidad: fecha_caducidad,
    p_cajas_por_pallet: cajas_por_pallet,
    p_cantidad_por_caja: cantidad_por_caja,
    p_categoria_producto: categoria_producto,
    p_lote_1: lote_1,
    p_lote_2: lote_2,
    p_numero_contenedor: numero_contenedor,
    p_numero_bl: numero_bl,
    p_presentacion: presentacion,
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

  redirect(`/lotes/${lote?.codigo_lote ?? entrada.lote_id}?comprobante=entrada:${entrada.id}`);
}
