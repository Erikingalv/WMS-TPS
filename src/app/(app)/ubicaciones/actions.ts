"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";

function leerFormulario(formData: FormData) {
  return {
    codigo: String(formData.get("codigo") ?? "").trim().toUpperCase(),
    zona: textoONulo(formData.get("zona")),
    capacidad_max_tarimas: Number(formData.get("capacidad_max_tarimas") ?? 0),
  };
}

function mensajeError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "Ya existe una ubicación con ese código.";
  return error.message;
}

export async function crearUbicacion(formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  const { error } = await supabase.from("ubicaciones").insert(datos);
  if (error) {
    redirect(`/ubicaciones/nuevo?error=${encodeURIComponent(mensajeError(error))}`);
  }

  revalidatePath("/ubicaciones");
  redirect("/ubicaciones");
}

export async function actualizarUbicacion(id: string, formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  const { error } = await supabase.from("ubicaciones").update(datos).eq("id", id);
  if (error) {
    redirect(`/ubicaciones/${id}?error=${encodeURIComponent(mensajeError(error))}`);
  }

  revalidatePath("/ubicaciones");
  revalidatePath(`/ubicaciones/${id}`);
  redirect("/ubicaciones");
}

export async function cambiarEstadoUbicacion(id: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("ubicaciones")
    .update({ activo })
    .eq("id", id);

  if (!error) {
    revalidatePath("/ubicaciones");
    revalidatePath(`/ubicaciones/${id}`);
  }
}
