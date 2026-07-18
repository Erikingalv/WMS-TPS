"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { numeroONulo, textoONulo } from "@/lib/utils/forms";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function subirFoto(
  supabase: SupabaseServerClient,
  clienteId: string,
  file: FormDataEntryValue | null
): Promise<string | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  const ext = file.name.split(".").pop() || "jpg";
  const path = `${clienteId}/${randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from("productos").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from("productos").getPublicUrl(path);
  return data.publicUrl;
}

function leerFormulario(formData: FormData) {
  return {
    cliente_id: String(formData.get("cliente_id") ?? ""),
    nombre: String(formData.get("nombre") ?? "").trim(),
    sku: String(formData.get("sku") ?? "").trim(),
    descripcion: textoONulo(formData.get("descripcion")),
    unidad: String(formData.get("unidad") ?? "pieza").trim() || "pieza",
    peso_kg: numeroONulo(formData.get("peso_kg")),
    largo_cm: numeroONulo(formData.get("largo_cm")),
    ancho_cm: numeroONulo(formData.get("ancho_cm")),
    alto_cm: numeroONulo(formData.get("alto_cm")),
    codigo_barras: textoONulo(formData.get("codigo_barras")),
  };
}

export async function crearProducto(formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  let foto_url: string | null = null;
  try {
    foto_url = await subirFoto(supabase, datos.cliente_id, formData.get("foto"));
  } catch {
    redirect(
      `/productos/nuevo?error=${encodeURIComponent("No se pudo subir la fotografía.")}`
    );
  }

  const { error } = await supabase.from("productos").insert({ ...datos, foto_url });
  if (error) {
    redirect(`/productos/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/productos");
  redirect("/productos");
}

export async function actualizarProducto(id: string, formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  const cambios: ReturnType<typeof leerFormulario> & { foto_url?: string } = {
    ...datos,
  };
  try {
    const nuevaFoto = await subirFoto(supabase, datos.cliente_id, formData.get("foto"));
    if (nuevaFoto) cambios.foto_url = nuevaFoto;
  } catch {
    redirect(
      `/productos/${id}?error=${encodeURIComponent("No se pudo subir la fotografía.")}`
    );
  }

  const { error } = await supabase.from("productos").update(cambios).eq("id", id);
  if (error) {
    redirect(`/productos/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/productos");
  revalidatePath(`/productos/${id}`);
  redirect("/productos");
}

export async function cambiarEstadoProducto(id: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase.from("productos").update({ activo }).eq("id", id);

  if (!error) {
    revalidatePath("/productos");
    revalidatePath(`/productos/${id}`);
  }
}
