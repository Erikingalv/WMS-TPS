import { formatearFecha } from "@/lib/utils/dates";
import { formatearNumero, formatearMoneda } from "@/lib/utils/numeros";
import type { ColumnaPdf } from "@/lib/reportes/pdf";
import type { CargoPeriodoLinea } from "@/lib/reportes/cargosPeriodo";

export const COLUMNAS_CARGOS: ColumnaPdf[] = [
  { encabezado: "Cliente", ancho: 1.4 },
  { encabezado: "Lote", ancho: 1.7 },
  { encabezado: "Producto", ancho: 2.2 },
  { encabezado: "SKU", ancho: 1.2 },
  { encabezado: "BL", ancho: 1 },
  { encabezado: "Fecha de entrada", ancho: 1.1 },
  { encabezado: "Última salida", ancho: 1.4 },
  { encabezado: "Días cobrados", ancho: 1.1 },
  { encabezado: "Tarifa", ancho: 1.8 },
  { encabezado: "Cargo almacenaje", ancho: 1.5 },
  { encabezado: "Tarimas entrada", ancho: 1.1 },
  { encabezado: "Maniobra entrada", ancho: 1.2 },
  { encabezado: "Tarimas salida", ancho: 1.1 },
  { encabezado: "Maniobra salida", ancho: 1.2 },
  { encabezado: "Total", ancho: 1.5 },
  { encabezado: "Cómo se calculó", ancho: 3.4 },
];

export const COLUMNAS_RESUMEN_CARGOS: ColumnaPdf[] = [
  { encabezado: "Cliente", ancho: 2 },
  { encabezado: "Tarifa", ancho: 3.6 },
  { encabezado: "Lotes", ancho: 0.7 },
  { encabezado: "Tarimas-día en bodega", ancho: 1.2 },
  { encabezado: "Tarimas entrada", ancho: 1 },
  { encabezado: "Tarimas salida", ancho: 1 },
  { encabezado: "Cargo almacenaje", ancho: 1.5 },
  { encabezado: "Maniobras", ancho: 1.4 },
  { encabezado: "Total a cobrar", ancho: 1.6 },
];

const fechaDiaMes = (clave: string) =>
  new Date(`${clave}T12:00:00`).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });

// El desglose de cómo se llegó al monto de un lote, una operación por línea:
// "20 tar × 63 d × $7.50 = $9,450.00". Si salieron tarimas a la mitad del
// periodo o cambió el escalón, hay un tramo por cada cambio, con sus fechas.
function textoCalculo(l: CargoPeriodoLinea): string {
  if (l.sin_tarifa) {
    return "Sin tarifa configurada: no se calculó cargo (configúrala en /tarifas).";
  }
  const lineas: string[] = [];
  const varios = l.segmentos.length > 1;
  l.segmentos.forEach((seg) => {
    const rango = varios ? ` (${fechaDiaMes(seg.desde)} al ${fechaDiaMes(seg.hasta)})` : "";
    const base = `Almacenaje${rango}: ${formatearNumero(seg.tarimas)} tar × ${formatearNumero(seg.dias)} d`;
    if (seg.tarifa === null) lineas.push(`${base} — sin escalón de tarifa que aplique = ${formatearMoneda(0)}`);
    else if (seg.gratis) lineas.push(`${base} × gratis = ${formatearMoneda(0)}`);
    else lineas.push(`${base} × ${formatearMoneda(seg.tarifa)} = ${formatearMoneda(seg.subtotal)}`);
  });
  if (l.segmentos.length === 0) lineas.push("Almacenaje: sin días con existencia en el periodo");
  const sinCobroManiobra = (l.maniobra_entrada_unitaria ?? 0) === 0 && (l.maniobra_salida_unitaria ?? 0) === 0;
  if (sinCobroManiobra) {
    // Evita 2 renglones de "× $0.00 = $0.00" y deja claro por qué no hay maniobra.
    lineas.push("Maniobra: la tarifa vigente no cobra maniobra ($0.00 por tarima)");
  } else {
    if (l.tarimas_entrada > 0 && l.maniobra_entrada_unitaria != null) {
      lineas.push(
        `Maniobra entrada: ${formatearNumero(l.tarimas_entrada)} tar × ${formatearMoneda(l.maniobra_entrada_unitaria)} = ${formatearMoneda(l.costo_maniobra_entrada)}`
      );
    }
    if (l.tarimas_salida > 0 && l.maniobra_salida_unitaria != null) {
      lineas.push(
        `Maniobra salida: ${formatearNumero(l.tarimas_salida)} tar × ${formatearMoneda(l.maniobra_salida_unitaria)} = ${formatearMoneda(l.costo_maniobra_salida)}`
      );
    }
  }
  return lineas.join("\n");
}

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
    "",
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
        l.sin_tarifa ? "SIN TARIFA" : (l.tarifa_texto ?? "—"),
        formatearMoneda(l.costo_almacenaje),
        formatearNumero(l.tarimas_entrada),
        formatearMoneda(l.costo_maniobra_entrada),
        formatearNumero(l.tarimas_salida),
        formatearMoneda(l.costo_maniobra_salida),
        formatearMoneda(l.costo_total),
        textoCalculo(l),
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

// Hoja de resumen que va al inicio del reporte: una línea por cliente con
// lo que se le cobra y la tarifa que se le aplicó, para ver el cobro
// completo de un vistazo antes de entrar al detalle por lote.
export function construirResumenCargos(lineas: CargoPeriodoLinea[]): {
  filas: string[][];
  negritas: number[];
} {
  const filas: string[][] = [];
  const negritas: number[] = [];
  const porCliente = new Map<string, CargoPeriodoLinea[]>();
  lineas.forEach((l) => porCliente.set(l.cliente, [...(porCliente.get(l.cliente) ?? []), l]));

  const suma = (ls: CargoPeriodoLinea[], f: (l: CargoPeriodoLinea) => number) => ls.reduce((s, l) => s + f(l), 0);

  for (const [cliente, ls] of porCliente) {
    const sinTarifa = ls.every((l) => l.sin_tarifa);
    const ref = ls.find((l) => !l.sin_tarifa);
    const tarifa = sinTarifa
      ? "SIN TARIFA CONFIGURADA: no se calculó cobro (configúrala en /tarifas)"
      : `Almacenaje: ${ref?.tarifa_texto ?? "—"}\nManiobra: ${formatearMoneda(ref?.maniobra_entrada_unitaria ?? 0)} por tarima que entra, ${formatearMoneda(ref?.maniobra_salida_unitaria ?? 0)} por tarima que sale`;
    if (sinTarifa) negritas.push(filas.length);
    filas.push([
      cliente,
      tarifa,
      formatearNumero(ls.length),
      formatearNumero(suma(ls, (l) => l.tarimas_dia)),
      formatearNumero(suma(ls, (l) => l.tarimas_entrada)),
      formatearNumero(suma(ls, (l) => l.tarimas_salida)),
      formatearMoneda(suma(ls, (l) => l.costo_almacenaje)),
      formatearMoneda(suma(ls, (l) => l.costo_maniobra_entrada + l.costo_maniobra_salida)),
      formatearMoneda(suma(ls, (l) => l.costo_total)),
    ]);
  }
  if (lineas.length > 0) {
    negritas.push(filas.length);
    filas.push([
      "TOTAL GENERAL",
      "",
      formatearNumero(lineas.length),
      formatearNumero(suma(lineas, (l) => l.tarimas_dia)),
      formatearNumero(suma(lineas, (l) => l.tarimas_entrada)),
      formatearNumero(suma(lineas, (l) => l.tarimas_salida)),
      formatearMoneda(suma(lineas, (l) => l.costo_almacenaje)),
      formatearMoneda(suma(lineas, (l) => l.costo_maniobra_entrada + l.costo_maniobra_salida)),
      formatearMoneda(suma(lineas, (l) => l.costo_total)),
    ]);
  }
  return { filas, negritas };
}
