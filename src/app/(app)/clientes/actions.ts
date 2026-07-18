"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";

function leerFormulario(formData: FormData) {
  return {
    nombre: String(formData.get("nombre") ?? "").trim(),
    empresa: textoONulo(formData.get("empresa")),
    rfc: textoONulo(formData.get("rfc")),
    direccion: textoONulo(formData.get("direccion")),
    contacto: textoONulo(formData.get("contacto")),
    correo: textoONulo(formData.get("correo")),
    telefono: textoONulo(formData.get("telefono")),
    observaciones: textoONulo(formData.get("observaciones")),
  };
}

export async function crearCliente(formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  const { error } = await supabase.from("clientes").insert(datos);
  if (error) {
    redirect(`/clientes/nuevo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

export async function actualizarCliente(id: string, formData: FormData) {
  const supabase = await createClient();
  const datos = leerFormulario(formData);

  const { error } = await supabase.from("clientes").update(datos).eq("id", id);
  if (error) {
    redirect(`/clientes/${id}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  redirect("/clientes");
}

export async function cambiarEstadoCliente(id: string, activo: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ activo })
    .eq("id", id);

  if (!error) {
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${id}`);
  }
}
