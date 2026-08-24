"use client";

import { useRef, useState } from "react";
import { FileText, Loader2, TriangleAlert, Upload, X } from "lucide-react";
import { subirArchivoCliente, borrarArchivoCliente, type ArchivoSubido } from "@/lib/utils/subidaCliente";

type DocItem = { nombre: string; estado: "subiendo" | "listo" | "error"; path?: string };

// Mismo motivo que EvidenciaFotos: sube directo al bucket desde el
// navegador en vez de viajar como bytes en el FormData, para no toparse
// con el límite de tamaño de la función serverless con varios documentos
// grandes (facturas escaneadas, etc.).
export function DocumentosSubida({
  name = "documentos",
  label = "Documentos",
  hint,
  carpeta = "evidencia",
}: {
  name?: string;
  label?: string;
  hint?: string;
  carpeta?: string;
}) {
  const [docs, setDocs] = useState<DocItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function agregar(files: FileList | null) {
    if (!files || files.length === 0) return;
    const nuevos: DocItem[] = Array.from(files).map((file) => ({ nombre: file.name, estado: "subiendo" }));
    setDocs((prev) => [...prev, ...nuevos]);

    await Promise.all(
      Array.from(files).map(async (file, i) => {
        const item = nuevos[i];
        try {
          const subida = await subirArchivoCliente(file, carpeta);
          setDocs((prev) =>
            prev.map((d) => (d === item ? { ...d, estado: "listo" as const, path: subida.path } : d))
          );
        } catch {
          setDocs((prev) => prev.map((d) => (d === item ? { ...d, estado: "error" as const } : d)));
        }
      })
    );
  }

  function quitar(idx: number) {
    const item = docs[idx];
    if (item.path) void borrarArchivoCliente(item.path);
    setDocs((prev) => prev.filter((_, i) => i !== idx));
  }

  const subidos: ArchivoSubido[] = docs
    .filter((d) => d.estado === "listo" && d.path)
    .map((d) => ({ path: d.path!, nombre: d.nombre }));

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[13px] font-medium text-ink-soft">{label}</p>
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}

      {docs.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {docs.map((d, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
              {d.estado === "subiendo" && <Loader2 size={14} className="animate-spin text-ink-faint" />}
              {d.estado === "error" && <TriangleAlert size={14} className="text-crit" />}
              {d.estado === "listo" && <FileText size={14} className="text-ink-faint" />}
              <span className="flex-1 truncate text-ink-soft">{d.nombre}</span>
              <button
                type="button"
                onClick={() => quitar(i)}
                aria-label="Quitar documento"
                className="flex size-6 items-center justify-center rounded-md text-ink-faint hover:bg-crit-soft hover:text-crit"
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-dashed border-line px-3.5 py-2 text-sm text-ink-faint transition-colors hover:border-accent hover:text-accent"
      >
        <Upload size={15} /> Subir documentos
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          agregar(e.target.files);
          e.target.value = "";
        }}
      />
      <input type="hidden" name={name} value={JSON.stringify(subidos)} />
    </div>
  );
}
