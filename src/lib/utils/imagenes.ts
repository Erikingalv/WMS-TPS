// Redimensiona y recomprime una foto en el navegador antes de subirla —
// una foto de celular sin comprimir pesa varios MB, y con varias fotos por
// movimiento eso hace lenta la subida y ocupa mucho storage. Reduce al lado
// más largo a `maxDim` px y reencoda como JPEG a `calidad`, que para fotos
// de evidencia (no para archivar en alta resolución) es más que suficiente.
export async function comprimirImagen(
  file: File,
  { maxDim = 1600, calidad = 0.75 }: { maxDim?: number; calidad?: number } = {}
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") return file;

  try {
    const bitmap = await createImageBitmap(file);
    const escala = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);

    const canvas = document.createElement("canvas");
    canvas.width = ancho;
    canvas.height = alto;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", calidad)
    );
    if (!blob || blob.size >= file.size) return file;

    const nombre = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch {
    // Si el navegador no puede decodificar la imagen (formato raro, etc.),
    // se sube tal cual en vez de bloquear al usuario.
    return file;
  }
}
