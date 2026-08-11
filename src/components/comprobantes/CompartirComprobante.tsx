"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

// Desde el celular, "Descargar PDF" solo lo abre en el navegador — ahí no
// siempre aparece la opción de compartir/imprimir (depende del navegador y
// de si la app está instalada como PWA). El Web Share API sí abre la hoja
// nativa de compartir del sistema (WhatsApp, Imprimir, Guardar, etc.), así
// que esto es la vía confiable en celular. En equipos donde no existe
// `navigator.share` (la mayoría de escritorio) el botón ni se muestra —
// ahí "Descargar PDF" ya funciona bien tal cual.
export function CompartirComprobante({
  tipo,
  id,
  archivoNombre,
}: {
  tipo: "entrada" | "salida";
  id: string;
  archivoNombre: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [disponible] = useState(
    () => typeof navigator !== "undefined" && typeof navigator.share === "function"
  );

  if (!disponible) return null;

  async function compartir() {
    setCargando(true);
    try {
      const resp = await fetch(`/api/comprobante/${tipo}/${id}`);
      const blob = await resp.blob();
      const file = new File([blob], archivoNombre, { type: "application/pdf" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Comprobante" });
      } else {
        window.open(`/api/comprobante/${tipo}/${id}`, "_blank");
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        window.open(`/api/comprobante/${tipo}/${id}`, "_blank");
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <Button type="button" variant="secondary" onClick={compartir} disabled={cargando}>
      <Share2 size={16} /> {cargando ? "Preparando…" : "Compartir / Imprimir"}
    </Button>
  );
}
