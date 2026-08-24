import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

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
