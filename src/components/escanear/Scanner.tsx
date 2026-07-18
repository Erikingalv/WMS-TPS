"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Html5Qrcode } from "html5-qrcode";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const CONTENEDOR_ID = "wms-qr-reader";

export function Scanner() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [codigoManual, setCodigoManual] = useState("");
  const escaneado = useRef(false);

  useEffect(() => {
    const scanner = new Html5Qrcode(CONTENEDOR_ID);
    escaneado.current = false;

    scanner
      .start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 260 },
        (decodedText) => {
          if (escaneado.current) return;
          escaneado.current = true;
          scanner.stop().catch(() => {});
          router.push(`/lotes/${encodeURIComponent(decodedText.trim())}`);
        },
        () => {
          // Callback de "no se detectó código en este frame" — ruido normal, se ignora.
        }
      )
      .catch(() => {
        setError("No se pudo acceder a la cámara. Revisa los permisos del navegador.");
      });

    return () => {
      // stop() puede lanzar de forma síncrona (no solo rechazar la promesa)
      // cuando la cámara nunca llegó a iniciar — p. ej. permiso denegado.
      try {
        scanner.stop().catch(() => {});
      } catch {
        // No había nada que detener.
      }
    };
  }, [router]);

  return (
    <div className="flex flex-col gap-6">
      <div id={CONTENEDOR_ID} className="overflow-hidden rounded-xl border border-line" />

      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (codigoManual.trim()) router.push(`/lotes/${encodeURIComponent(codigoManual.trim())}`);
        }}
        className="flex items-end gap-3 border-t border-line pt-5"
      >
        <div className="flex-1">
          <Input
            label="¿Sin cámara? Escribe el código de lote"
            value={codigoManual}
            onChange={(e) => setCodigoManual(e.target.value)}
            placeholder="L-260718-00001"
          />
        </div>
        <Button type="submit" variant="secondary">
          Buscar
        </Button>
      </form>
    </div>
  );
}
