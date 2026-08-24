"use client";

import { useRef, useState } from "react";
import { clsx } from "clsx";
import { Camera, ImagePlus, Loader2, TriangleAlert, X } from "lucide-react";
import { comprimirImagen } from "@/lib/utils/imagenes";
import { subirArchivoCliente, borrarArchivoCliente, type ArchivoSubido } from "@/lib/utils/subidaCliente";

type FotoItem = {
  url: string;
  nombre: string;
  estado: "subiendo" | "listo" | "error";
  path?: string;
};

// Cada foto se comprime y se sube directo a Supabase Storage desde el
// navegador en cuanto se elige — no viaja como bytes dentro del FormData
// del formulario. Con varias fotos (aunque ya vinieran comprimidas), el
// body de la petición al server action podía superar el límite de Vercel
// para funciones serverless; subiendo directo al bucket ese límite ya no
// aplica, porque el server action solo recibe las rutas (texto), no las
// fotos. El campo oculto `name` lleva un JSON con [{path, nombre}, ...] de
// las que ya terminaron de subir.
export function EvidenciaFotos({
  name = "fotos",
  label = "Fotografías de evidencia",
  carpeta = "evidencia",
}: {
  name?: string;
  label?: string;
  carpeta?: string;
}) {
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  async function agregar(files: FileList | null) {
    if (!files || files.length === 0) return;
    const nuevas: FotoItem[] = Array.from(files).map((file) => ({
      url: URL.createObjectURL(file),
      nombre: file.name,
      estado: "subiendo",
    }));
    setFotos((prev) => [...prev, ...nuevas]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const item = nuevas[i];
        try {
          const comprimida = await comprimirImagen(file);
          const subida = await subirArchivoCliente(comprimida, carpeta);
          setFotos((prev) =>
            prev.map((f) => (f.url === item.url ? { ...f, estado: "listo" as const, path: subida.path } : f))
          );
        } catch {
          setFotos((prev) => prev.map((f) => (f.url === item.url ? { ...f, estado: "error" as const } : f)));
        }
      })
    );
  }

  function quitar(idx: number) {
    const item = fotos[idx];
    URL.revokeObjectURL(item.url);
    if (item.path) void borrarArchivoCliente(item.path);
    setFotos((prev) => prev.filter((_, i) => i !== idx));
  }

  const subidas: ArchivoSubido[] = fotos
    .filter((f) => f.estado === "listo" && f.path)
    .map((f) => ({ path: f.path!, nombre: f.nombre }));

  const hayPendientes = fotos.some((f) => f.estado === "subiendo");
  const hayErrores = fotos.some((f) => f.estado === "error");

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      <div className="flex flex-wrap gap-2.5">
        {fotos.map((f, i) => (
          <div key={i} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.url}
              alt=""
              className={clsx(
                "size-20 rounded-lg border object-cover",
                f.estado === "error" ? "border-crit" : "border-line"
              )}
            />
            {f.estado === "subiendo" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-paper/70">
                <Loader2 size={18} className="animate-spin text-ink-faint" />
              </div>
            )}
            {f.estado === "error" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-crit-soft/80">
                <TriangleAlert size={16} className="text-crit" />
              </div>
            )}
            <button
              type="button"
              onClick={() => quitar(i)}
              aria-label="Quitar foto"
              className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-crit text-paper shadow"
            >
              <X size={12} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputCamaraRef.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-accent hover:text-accent"
        >
          <Camera size={18} />
          <span className="text-[11px]">Tomar foto</span>
        </button>
        <button
          type="button"
          onClick={() => inputGaleriaRef.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-accent hover:text-accent"
        >
          <ImagePlus size={18} />
          <span className="text-[11px]">Subir fotos</span>
        </button>
      </div>
      {hayPendientes && <p className="text-xs text-ink-faint">Subiendo fotos…</p>}
      {hayErrores && (
        <p className="text-xs text-crit">Alguna foto no se pudo subir — quítala e intenta de nuevo.</p>
      )}

      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = "";
        }}
      />
      <input type="hidden" name={name} value={JSON.stringify(subidas)} />
    </div>
  );
}
