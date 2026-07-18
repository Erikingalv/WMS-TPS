import { Scanner } from "@/components/escanear/Scanner";

export default function EscanearPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Escanear</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Apunta la cámara al QR impreso en una tarima para ver su detalle.
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <Scanner />
      </div>
    </div>
  );
}
