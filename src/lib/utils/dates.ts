export function diasDesde(fechaIso: string): number {
  const inicio = new Date(fechaIso).getTime();
  const ahora = Date.now();
  return Math.max(0, Math.floor((ahora - inicio) / (1000 * 60 * 60 * 24)));
}

export function formatearFecha(fechaIso: string): string {
  return new Date(fechaIso).toLocaleDateString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function formatearFechaHora(fechaIso: string): string {
  return new Date(fechaIso).toLocaleString("es-MX", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
