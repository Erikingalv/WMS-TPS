import { randomUUID } from "node:crypto";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Sube cada archivo válido del FormData a `bucket/carpeta/<uuid>.<ext>`.
// Ignora entradas vacías (inputs de archivo sin selección).
export async function subirArchivos(
  supabase: SupabaseServerClient,
  bucket: string,
  carpeta: string,
  files: FormDataEntryValue[]
): Promise<{ path: string; nombre: string }[]> {
  const subidos: { path: string; nombre: string }[] = [];

  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;

    const ext = file.name.split(".").pop() || "bin";
    const path = `${carpeta}/${randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file);
    if (error) throw error;

    subidos.push({ path, nombre: file.name });
  }

  return subidos;
}

// Sube una imagen capturada como data URL (ej. firma digital en canvas).
export async function subirDataUrl(
  supabase: SupabaseServerClient,
  bucket: string,
  path: string,
  dataUrl: string
): Promise<string> {
  const base64 = dataUrl.split(",")[1] ?? "";
  const buffer = Buffer.from(base64, "base64");

  const { error } = await supabase.storage.from(bucket).upload(path, buffer, {
    contentType: "image/png",
  });
  if (error) throw error;

  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// Los buckets de Fase 2 son públicos (ver 0003/0007_storage_*.sql); esto solo
// arma la URL, no hace ninguna llamada de red.
export function urlPublica(
  supabase: SupabaseServerClient,
  bucket: string,
  path: string
): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
