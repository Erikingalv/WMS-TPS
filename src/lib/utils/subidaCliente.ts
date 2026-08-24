import { createClient } from "@/lib/supabase/client";

export type ArchivoSubido = { path: string; nombre: string };

// Sube un archivo directo desde el navegador a Supabase Storage (no pasa
// por el server action de Next.js) — con muchas fotos, el body de la
// petición al server action superaba el límite de tamaño de Vercel para
// funciones serverless (~4.5MB) aunque cada foto ya viniera comprimida.
// Subiendo directo al bucket ese límite ya no aplica: el server action
// solo recibe las rutas (texto), no los bytes de las fotos.
export async function subirArchivoCliente(file: File, carpeta: string): Promise<ArchivoSubido> {
  const supabase = createClient();
  const ext = file.name.split(".").pop() || "bin";
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("documentos").upload(path, file);
  if (error) throw error;
  return { path, nombre: file.name };
}

export async function borrarArchivoCliente(path: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from("documentos").remove([path]);
}
