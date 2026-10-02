import { formatearFecha } from "@/lib/utils/dates";
import { formatearNumero, formatearMoneda } from "@/lib/utils/numeros";
import type { ColumnaPdf } from "@/lib/reportes/pdf";
import type { CargoPeriodoLinea } from "@/lib/reportes/cargosPeriodo";

export const COLUMNAS_CARGOS: ColumnaPdf[] = [
  { encabezado: "Cliente", ancho: 1.5 },
  { encabezado: "Lote", ancho: 1.8 },
  { encabezado: "Producto", ancho: 2.6 },
  { encabezado: "SKU", ancho: 1.4 },
  { encabezado: "BL", ancho: 1.1 },
  { encabezado: "Fecha de entrada", ancho: 1.2 },
  { encabezado: "Última salida", ancho: 1.5 },
  { encabezado: "Días cobrados", ancho: 1.1 },
  { encabezado: "Tarifa", ancho: 1.2 },
  { encabezado: "Cargo almacenaje", ancho: 1.5 },
  { encabezado: "Tarimas entrada", ancho: 1 },
  { encabezado: "Maniobra entrada", ancho: 1.3 },
  { encabezado: "Tarimas salida", ancho: 1 },
  { encabezado: "Maniobra salida", ancho: 1.3 },
  { encabezado: "Total", ancho: 1.6 },
];

// Una fila por lote; al terminar cada cliente, una fila de subtotal (así se
// factura: por cliente), y al final el total general. Las filas de lotes
// sin tarifa configurada y las de subtotal/total salen en negrita.
export function construirTablaCargos(lineas: CargoPeriodoLinea[]): {
  filas: string[][];
  negritas: number[];
  sinTarifaLotes: number;
} {
  const filas: string[][] = [];
  const fechaCorta = (iso: string) => formatearFecha(iso);
  const textoSalida = (l: (typeof lineas)[number]) => {
    if (!l.fecha_ultima_salida) return "En bodega";
    return l.tarimas_restantes > 0
      ? `${fechaCorta(l.fecha_ultima_salida)} (parcial, aún hay ${formatearNumero(l.tarimas_restantes)} tar.)`
      : fechaCorta(l.fecha_ultima_salida);
  };

  type Sumas = { alm: number; tEnt: number; mEnt: number; tSal: number; mSal: number; total: number };
  const sumar = (ls: typeof lineas): Sumas => ({
    alm: ls.reduce((s, l) => s + l.costo_almacenaje, 0),
    tEnt: ls.reduce((s, l) => s + l.tarimas_entrada, 0),
    mEnt: ls.reduce((s, l) => s + l.costo_maniobra_entrada, 0),
    tSal: ls.reduce((s, l) => s + l.tarimas_salida, 0),
    mSal: ls.reduce((s, l) => s + l.costo_maniobra_salida, 0),
    total: ls.reduce((s, l) => s + l.costo_total, 0),
  });
  const filaSumas = (etiqueta: string, nota: string, m: Sumas): string[] => [
    etiqueta,
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    nota,
    formatearMoneda(m.alm),
    formatearNumero(m.tEnt),
    formatearMoneda(m.mEnt),
    formatearNumero(m.tSal),
    formatearMoneda(m.mSal),
    formatearMoneda(m.total),
  ];

  // Una fila por lote; al terminar cada cliente, una fila de subtotal
  // (así se factura: por cliente), y al final el total general.
  const negritas: number[] = [];
  const porCliente = new Map<string, typeof lineas>();
  lineas.forEach((l) => porCliente.set(l.cliente, [...(porCliente.get(l.cliente) ?? []), l]));

  for (const [cliente, ls] of porCliente) {
    ls.forEach((l) => {
      // Un $0 puede ser un cargo real de $0 o simplemente que a este
      // cliente nunca se le configuró una tarifa en /tarifas — sin esta
      // columna, ambos casos se ven idénticos en el reporte. Esas filas
      // salen en negrita para que salten a la vista.
      if (l.sin_tarifa) negritas.push(filas.length);
      filas.push([
        l.cliente,
        l.codigo_lote,
        l.producto,
        l.sku,
        l.numero_bl ?? "—",
        fechaCorta(l.fecha_ingreso),
        textoSalida(l),
        formatearNumero(l.dias_con_existencia),
        l.sin_tarifa ? "SIN TARIFA" : (l.tarifa_nombre ?? "—"),
        formatearMoneda(l.costo_almacenaje),
        formatearNumero(l.tarimas_entrada),
        formatearMoneda(l.costo_maniobra_entrada),
        formatearNumero(l.tarimas_salida),
        formatearMoneda(l.costo_maniobra_salida),
        formatearMoneda(l.costo_total),
      ]);
    });
    if (porCliente.size > 1 || ls.length > 1) {
      negritas.push(filas.length);
      filas.push(
        filaSumas(
          `SUBTOTAL ${cliente}`,
          ls.every((l) => l.sin_tarifa) ? "Sin tarifa" : "",
          sumar(ls)
        )
      );
    }
  }
  if (lineas.length > 0) {
    negritas.push(filas.length);
    filas.push(filaSumas("TOTAL GENERAL", "", sumar(lineas)));
  }


  return { filas, negritas, sinTarifaLotes: lineas.filter((l) => l.sin_tarifa).length };
}
