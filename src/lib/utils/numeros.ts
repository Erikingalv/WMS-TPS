// Miles con coma para que las cantidades se lean rápido en reportes y
// comprobantes largos — 152136 vs 152,136.
export function formatearNumero(n: number): string {
  return n.toLocaleString("es-MX");
}

export function formatearMoneda(n: number): string {
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}
