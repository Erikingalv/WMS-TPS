import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarPdfTabla, type ColumnaPdf } from "@/lib/reportes/pdf";
import { generarExcelTabla } from "@/lib/reportes/excel";
import { calcularCargosPeriodo } from "@/lib/reportes/cargosPeriodo";
import {
  COLUMNAS_ENTRADAS,
  COLUMNAS_SALIDAS,
  DEFAULT_COLS_ENTRADAS,
  DEFAULT_COLS_SALIDAS,
  type FilaEntrada,
  type FilaSalida,
} from "@/lib/reportes/columnas";
import {
  obtenerInventarioDetallado,
  COLUMNAS_INVENTARIO,
  DEFAULT_COLS_INVENTARIO,
} from "@/lib/reportes/inventarioDetallado";
import { formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import { formatearNumero, formatearMoneda } from "@/lib/utils/numeros";

type TipoReporte = "inventario" | "entradas" | "salidas" | "movimientos" | "ocupacion" | "cargos";

const TITULOS: Record<TipoReporte, string> = {
  inventario: "Inventario",
  entradas: "Entradas",
  salidas: "Salidas",
  movimientos: "Movimientos internos",
  ocupacion: "Ocupación de la bodega",
  cargos: "Cargos por periodo",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = (searchParams.get("tipo") as TipoReporte) || "inventario";
  const formato = searchParams.get("formato") === "excel" ? "excel" : "pdf";
  const clienteId = searchParams.get("cliente_id") || null;
  const desde = searchParams.get("desde") || null;
  const hasta = searchParams.get("hasta") || null;
  const colsParam = searchParams.getAll("cols");

  if (!(tipo in TITULOS)) {
    return NextResponse.json({ error: "Tipo de reporte inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  let columnas: ColumnaPdf[] = [];
  let filas: string[][] = [];
  let filasSinTarifa: number[] = [];

  if (tipo === "inventario") {
    const claves = (colsParam.length > 0 ? colsParam : DEFAULT_COLS_INVENTARIO).filter(
      (k) => k in COLUMNAS_INVENTARIO
    );
    const defs = claves.map((k) => COLUMNAS_INVENTARIO[k]);
    columnas = defs.map((d) => ({ encabezado: d.label, ancho: d.ancho }));

    // Desglosado por tarima individual (una fila por tarima física), igual
    // que el Excel de control — no una fila agregada por lote.
    const filasInventario = await obtenerInventarioDetallado(supabase, { clienteId, desde, hasta });
    filas = filasInventario.map((f) => defs.map((d) => d.valor(f)));
  }

  if (tipo === "entradas") {
    const claves = (colsParam.length > 0 ? colsParam : DEFAULT_COLS_ENTRADAS).filter(
      (k) => k in COLUMNAS_ENTRADAS
    );
    const defs = claves.map((k) => COLUMNAS_ENTRADAS[k]);
    columnas = defs.map((d) => ({ encabezado: d.label, ancho: d.ancho }));

    let query = supabase
      .from("entradas")
      .select(
        "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote, estado), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
      )
      .order("fecha", { ascending: false })
      .limit(1000);
    if (clienteId) query = query.eq("cliente_id", clienteId);
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    const { data } = await query;
    const filasTyped = (data ?? []) as unknown as FilaEntrada[];
    filas = filasTyped.map((f) => defs.map((d) => d.valor(f)));
  }

  if (tipo === "salidas") {
    const claves = (colsParam.length > 0 ? colsParam : DEFAULT_COLS_SALIDAS).filter(
      (k) => k in COLUMNAS_SALIDAS
    );
    const defs = claves.map((k) => COLUMNAS_SALIDAS[k]);
    columnas = defs.map((d) => ({ encabezado: d.label, ancho: d.ancho }));

    let query = supabase
      .from("salidas")
      .select(
        "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote, estado), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
      )
      .order("fecha", { ascending: false })
      .limit(1000);
    if (clienteId) query = query.eq("cliente_id", clienteId);
    if (desde) query = query.gte("fecha", desde);
    if (hasta) query = query.lte("fecha", hasta);
    const { data } = await query;
    const filasTyped = (data ?? []) as unknown as FilaSalida[];
    filas = filasTyped.map((f) => defs.map((d) => d.valor(f)));
  }

  if (tipo === "movimientos") {
    columnas = [
      { encabezado: "Fecha", ancho: 1.6 },
      { encabezado: "Lote", ancho: 2 },
      { encabezado: "De", ancho: 1.2 },
      { encabezado: "A", ancho: 1.2 },
      { encabezado: "Piezas", ancho: 1 },
      { encabezado: "Tarimas", ancho: 1 },
      { encabezado: "Motivo", ancho: 2 },
    ];
    let query = supabase
      .from("movimientos_internos")
      .select("created_at, cantidad_piezas, cantidad_tarimas, motivo, lote_id, ubicacion_origen_id, ubicacion_destino_id")
      .order("created_at", { ascending: false })
      .limit(1000);
    if (desde) query = query.gte("created_at", desde);
    if (hasta) query = query.lte("created_at", hasta);
    const { data } = await query;
    const [{ data: lotes }, { data: ubicaciones }] = await Promise.all([
      supabase.from("lotes").select("id, codigo_lote"),
      supabase.from("ubicaciones").select("id, codigo"),
    ]);
    const mapaLotes = new Map((lotes ?? []).map((l) => [l.id, l.codigo_lote]));
    const mapaUbic = new Map((ubicaciones ?? []).map((u) => [u.id, u.codigo]));
    filas = (data ?? []).map((r) => [
      formatearFechaHora(r.created_at),
      mapaLotes.get(r.lote_id) ?? "—",
      mapaUbic.get(r.ubicacion_origen_id) ?? "—",
      mapaUbic.get(r.ubicacion_destino_id) ?? "—",
      formatearNumero(r.cantidad_piezas),
      formatearNumero(r.cantidad_tarimas),
      r.motivo ?? "—",
    ]);
  }

  if (tipo === "ocupacion") {
    columnas = [
      { encabezado: "Ubicación", ancho: 1.5 },
      { encabezado: "Zona", ancho: 1.5 },
      { encabezado: "Capacidad", ancho: 1.2 },
      { encabezado: "Ocupado", ancho: 1.2 },
      { encabezado: "% Ocupación", ancho: 1.2 },
    ];
    const [{ data: ubicaciones }, { data: inventario }] = await Promise.all([
      supabase.from("ubicaciones").select("*").eq("activo", true).order("codigo"),
      supabase.from("inventario_lote_ubicacion").select("ubicacion_id, cantidad_tarimas"),
    ]);
    const ocupadoPorUbicacion = new Map<string, number>();
    (inventario ?? []).forEach((i) => {
      ocupadoPorUbicacion.set(i.ubicacion_id, (ocupadoPorUbicacion.get(i.ubicacion_id) ?? 0) + i.cantidad_tarimas);
    });
    filas = (ubicaciones ?? []).map((u) => {
      const ocupado = ocupadoPorUbicacion.get(u.id) ?? 0;
      const pct = u.capacidad_max_tarimas > 0 ? Math.round((ocupado / u.capacidad_max_tarimas) * 100) : 0;
      return [u.codigo, u.zona ?? "—", formatearNumero(u.capacidad_max_tarimas), formatearNumero(ocupado), `${pct}%`];
    });
  }

  if (tipo === "cargos") {
    columnas = [
      { encabezado: "Lote", ancho: 1.6 },
      { encabezado: "Cliente", ancho: 1.8 },
      { encabezado: "Producto", ancho: 2.2 },
      { encabezado: "SKU", ancho: 1.3 },
      { encabezado: "Días", ancho: 0.8 },
      { encabezado: "Tarifa aplicada", ancho: 1.5 },
      { encabezado: "Cargo almacenaje", ancho: 1.4 },
      { encabezado: "Tarimas entrada", ancho: 1 },
      { encabezado: "Maniobra entrada", ancho: 1.3 },
      { encabezado: "Tarimas salida", ancho: 1 },
      { encabezado: "Maniobra salida", ancho: 1.3 },
      { encabezado: "Total", ancho: 1.3 },
    ];
    if (!desde || !hasta) {
      return NextResponse.json(
        { error: "Selecciona un rango de fechas (desde/hasta) para el reporte de cargos" },
        { status: 400 }
      );
    }
    // Ya viene ordenado de mayor a menor antigüedad (días con existencia).
    const lineas = await calcularCargosPeriodo(supabase, { desde, hasta, clienteId });
    filas = lineas.map((l) => [
      l.codigo_lote,
      l.cliente,
      l.producto,
      l.sku,
      formatearNumero(l.dias_con_existencia),
      // Un $0 puede ser un cargo real de $0 o simplemente que a este
      // cliente nunca se le configuró una tarifa en /tarifas — sin esta
      // columna, ambos casos se ven idénticos en el reporte.
      l.sin_tarifa ? "SIN TARIFA CONFIGURADA" : (l.tarifa_nombre ?? "—"),
      formatearMoneda(l.costo_almacenaje),
      formatearNumero(l.tarimas_entrada),
      formatearMoneda(l.costo_maniobra_entrada),
      formatearNumero(l.tarimas_salida),
      formatearMoneda(l.costo_maniobra_salida),
      formatearMoneda(l.costo_total),
    ]);
    // Las filas sin tarifa configurada se resaltan en negrita para que
    // salten a la vista en vez de perderse entre ceros silenciosos.
    filasSinTarifa = lineas.map((l, i) => (l.sin_tarifa ? i : -1)).filter((i) => i >= 0);
    if (lineas.length > 0) {
      const suma = (f: (l: (typeof lineas)[number]) => number) => lineas.reduce((s, l) => s + f(l), 0);
      filas.push([
        "TOTAL",
        "",
        "",
        "",
        "",
        "",
        formatearMoneda(suma((l) => l.costo_almacenaje)),
        formatearNumero(suma((l) => l.tarimas_entrada)),
        formatearMoneda(suma((l) => l.costo_maniobra_entrada)),
        formatearNumero(suma((l) => l.tarimas_salida)),
        formatearMoneda(suma((l) => l.costo_maniobra_salida)),
        formatearMoneda(suma((l) => l.costo_total)),
      ]);
    }
  }

  const nombreArchivo = `${tipo}-${formatearFecha(new Date().toISOString()).replace(/\s/g, "-")}`;

  const esCargosConTotal = tipo === "cargos" && filas.length > 0 && filas[filas.length - 1][0] === "TOTAL";
  const filasNegrita = esCargosConTotal ? [...filasSinTarifa, filas.length - 1] : filasSinTarifa;

  if (formato === "excel") {
    const buffer = await generarExcelTabla(
      TITULOS[tipo],
      columnas.map((c) => ({ encabezado: c.encabezado, ancho: c.ancho * 8 })),
      filas,
      { filasNegrita }
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    });
  }

  const subtitulo =
    `Generado el ${formatearFechaHora(new Date().toISOString())} · ${filas.length} registros` +
    (filasSinTarifa.length > 0
      ? ` · ${filasSinTarifa.length} sin tarifa configurada (revisa /tarifas)`
      : "");
  let pdfBytes: Uint8Array;
  try {
    pdfBytes = await generarPdfTabla(TITULOS[tipo], subtitulo, columnas, filas, {
      orientacion: tipo === "cargos" || tipo === "inventario" || columnas.length > 9 ? "horizontal" : "vertical",
      filasNegrita,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF de este reporte" }, { status: 500 });
  }
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.pdf"`,
    },
  });
}
