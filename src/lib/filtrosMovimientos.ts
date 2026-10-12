// Filtros de las listas de Entradas y Salidas — los mismos que Inventario
// (cliente, producto, ubicación, lote, BL) más rango de fechas.
export type FiltrosMovimientos = {
  desde?: string;
  hasta?: string;
  cliente_id?: string;
  producto_id?: string;
  ubicacion_id?: string;
  lote?: string;
  bl?: string;
};

export type LineaFiltrable = {
  grupo_id: string;
  cliente_id: string;
  producto_id: string;
  ubicacion_id: string;
  numero_bl: string | null;
  lotes: { codigo_lote: string } | null;
};

export function hayFiltros(f: FiltrosMovimientos): boolean {
  return Object.values(f).some(Boolean);
}

// Un movimiento consolidado tiene una línea por producto. Si alguna línea
// cumple los filtros, el movimiento se muestra completo (con todas sus
// líneas), no solo la que coincidió — así el total y el número de
// productos del renglón siguen siendo los reales.
// (Las fechas se filtran en la consulta, no aquí.)
export function filtrarPorMovimiento<T extends LineaFiltrable>(lineas: T[], f: FiltrosMovimientos): T[] {
  const lote = f.lote?.trim().toLowerCase();
  const bl = f.bl?.trim().toLowerCase();
  if (!f.cliente_id && !f.producto_id && !f.ubicacion_id && !lote && !bl) return lineas;

  const cumple = (l: T) =>
    (!f.cliente_id || l.cliente_id === f.cliente_id) &&
    (!f.producto_id || l.producto_id === f.producto_id) &&
    (!f.ubicacion_id || l.ubicacion_id === f.ubicacion_id) &&
    (!lote || (l.lotes?.codigo_lote ?? "").toLowerCase().includes(lote)) &&
    (!bl || (l.numero_bl ?? "").toLowerCase().includes(bl));

  const gruposQueCumplen = new Set(lineas.filter(cumple).map((l) => l.grupo_id));
  return lineas.filter((l) => gruposQueCumplen.has(l.grupo_id));
}
