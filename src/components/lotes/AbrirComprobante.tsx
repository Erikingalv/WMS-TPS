"use client";

import { useEffect, useRef } from "react";

export function AbrirComprobante({ comprobante }: { comprobante: string | null }) {
  const yaAbierto = useRef(false);

  useEffect(() => {
    if (!comprobante || yaAbierto.current) return;
    const [tipo, id] = comprobante.split(":");
    if ((tipo !== "entrada" && tipo !== "salida") || !id) return;
    yaAbierto.current = true;
    window.open(`/api/comprobante/${tipo}/${id}`, "_blank");
  }, [comprobante]);

  return null;
}
