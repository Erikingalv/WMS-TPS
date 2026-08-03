// Identificador de tarimas: acepta números sueltos y/o rangos mezclados,
// separados por coma — ej. "1,5,15-17" → [1, 5, 15, 16, 17]. Una salida no
// siempre es un rango continuo como una entrada.
export function parsearTarimas(texto: string): number[] | null {
  const limpio = texto.trim();
  if (!limpio) return null;

  const numeros = new Set<number>();
  for (const parteRaw of limpio.split(",")) {
    const parte = parteRaw.trim();
    if (!parte) continue;

    const rango = parte.match(/^(\d+)\s*-\s*(\d+)$/);
    if (rango) {
      const desde = Number(rango[1]);
      const hasta = Number(rango[2]);
      if (!Number.isFinite(desde) || !Number.isFinite(hasta) || desde > hasta) return null;
      for (let n = desde; n <= hasta; n++) numeros.add(n);
      continue;
    }

    if (/^\d+$/.test(parte)) {
      numeros.add(Number(parte));
      continue;
    }

    return null; // formato no reconocido
  }

  return numeros.size > 0 ? [...numeros].sort((a, b) => a - b) : null;
}

// Colapsa corridas consecutivas en rangos para mostrar compacto —
// [1, 5, 15, 16, 17] → "1, 5, 15-17".
export function formatearTarimas(numeros: number[] | null | undefined): string {
  if (!numeros || numeros.length === 0) return "—";
  const ordenados = [...numeros].sort((a, b) => a - b);
  const partes: string[] = [];
  let inicio = ordenados[0];
  let anterior = ordenados[0];

  for (let i = 1; i <= ordenados.length; i++) {
    const actual = ordenados[i];
    if (actual === anterior + 1) {
      anterior = actual;
      continue;
    }
    partes.push(inicio === anterior ? `${inicio}` : `${inicio}-${anterior}`);
    if (actual !== undefined) {
      inicio = actual;
      anterior = actual;
    }
  }

  return partes.join(", ");
}
