"use client";

import { useRef, useState } from "react";
import { Camera, ImagePlus, X } from "lucide-react";
import { comprimirImagen } from "@/lib/utils/imagenes";

type FotoPendiente = { file: File; url: string };

// Acumula fotos elegidas por dos vías (cámara o galería/archivos) en un
// solo input oculto que sí viaja en el FormData del formulario — así el
// backend recibe un único campo `name` con todas, sin importar de dónde
// vinieron. Cada foto se puede quitar antes de enviar el formulario.
export function EvidenciaFotos({
  name = "fotos",
  label = "Fotografías de evidencia",
}: {
  name?: string;
  label?: string;
}) {
  const [fotos, setFotos] = useState<FotoPendiente[]>([]);
  const [procesando, setProcesando] = useState(false);
  const inputFormRef = useRef<HTMLInputElement>(null);
  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);

  function sincronizarInput(lista: FotoPendiente[]) {
    const dt = new DataTransfer();
    lista.forEach((f) => dt.items.add(f.file));
    if (inputFormRef.current) inputFormRef.current.files = dt.files;
  }

  async function agregar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setProcesando(true);
    try {
      const comprimidas = await Promise.all(Array.from(files).map((file) => comprimirImagen(file)));
      const nuevas = comprimidas.map((file) => ({ file, url: URL.createObjectURL(file) }));
      const lista = [...fotos, ...nuevas];
      setFotos(lista);
      sincronizarInput(lista);
    } finally {
      setProcesando(false);
    }
  }

  function quitar(idx: number) {
    URL.revokeObjectURL(fotos[idx].url);
    const lista = fotos.filter((_, i) => i !== idx);
    setFotos(lista);
    sincronizarInput(lista);
  }

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
              className="size-20 rounded-lg border border-line object-cover"
            />
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
          disabled={procesando}
          onClick={() => inputCamaraRef.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Camera size={18} />
          <span className="text-[11px]">Tomar foto</span>
        </button>
        <button
          type="button"
          disabled={procesando}
          onClick={() => inputGaleriaRef.current?.click()}
          className="flex size-20 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line text-ink-faint transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <ImagePlus size={18} />
          <span className="text-[11px]">Subir fotos</span>
        </button>
      </div>
      {procesando && <p className="text-xs text-ink-faint">Comprimiendo fotos…</p>}

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
      <input ref={inputFormRef} type="file" name={name} multiple className="hidden" />
    </div>
  );
}
