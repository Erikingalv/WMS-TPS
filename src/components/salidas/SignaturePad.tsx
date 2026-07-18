"use client";

import { useRef, useState, type PointerEvent } from "react";

export function SignaturePad({ name }: { name: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  function posicion(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const escalaX = canvas.width / rect.width;
    const escalaY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * escalaX, y: (e.clientY - rect.top) * escalaY };
  }

  function iniciar(e: PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function trazar(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicion(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#201F1C";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    setHasSignature(true);
  }

  function terminar() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hiddenRef.current && canvasRef.current) {
      hiddenRef.current.value = canvasRef.current.toDataURL("image/png");
    }
  }

  function limpiar() {
    const canvas = canvasRef.current!;
    canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    if (hiddenRef.current) hiddenRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-medium text-ink-soft">Firma digital</label>
      <canvas
        ref={canvasRef}
        width={600}
        height={180}
        className="w-full touch-none rounded-lg border border-line bg-paper-raised"
        onPointerDown={iniciar}
        onPointerMove={trazar}
        onPointerUp={terminar}
        onPointerLeave={terminar}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">
          {hasSignature ? "Firmado" : "Firma aquí con el dedo o el mouse"}
        </span>
        <button
          type="button"
          onClick={limpiar}
          className="text-xs font-medium text-accent hover:underline"
        >
          Limpiar
        </button>
      </div>
      <input ref={hiddenRef} type="hidden" name={name} />
    </div>
  );
}
