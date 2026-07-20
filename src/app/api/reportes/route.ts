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
import { diasDesde, formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import type { Cliente, Lote, Producto, Ubicacion } from "@/lib/types/database";

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

  if (tipo === "inventario") {
    columnas = [
      { encabezado: "Cliente", ancho: 2.6 },
      { encabezado: "Producto", ancho: 2.6 },
      { encabezado: "SKU", ancho: 1.6 },
      { encabezado: "Lote", ancho: 2 },
      { encabezado: "Ubic.", ancho: 1.2 },
      { encabezado: "Piezas", ancho: 1 },
      { encabezado: "Tarimas", ancho: 1 },
      { encabezado: "Días", ancho: 1 },
    ];
    type Fila = {
      cantidad_piezas: number;
      cantidad_tarimas: number;
      lotes:
        | (Pick<Lote, "codigo_lote" | "fecha_ingreso" | "producto_id"> & {
            productos:
              | (Pick<Producto, "nombre" | "sku" | "cliente_id"> & {
                  clientes: Pick<Cliente, "nombre"> | null;
                })
              | null;
          })
        | null;
      ubicaciones: Pick<Ubicacion, "codigo"> | null;
    };
    const { data } = await supabase
      .from("inventario_lote_ubicacion")
      .select(
        "cantidad_piezas, cantidad_tarimas, lotes(codigo_lote, fecha_ingreso, producto_id, productos(nombre, sku, cliente_id, clientes(nombre))), ubicaciones(codigo)"
      )
      .or("cantidad_piezas.gt.0,cantidad_tarimas.gt.0");
    let filas_ = (data ?? []) as unknown as Fila[];
    if (clienteId) filas_ = filas_.filter((r) => r.lotes?.productos?.cliente_id === clienteId);
    filas = filas_.map((r) => [
      r.lotes?.productos?.clientes?.nombre ?? "—",
      r.lotes?.productos?.nombre ?? "—",
      r.lotes?.productos?.sku ?? "—",
      r.lotes?.codigo_lote ?? "—",
      r.ubicaciones?.codigo ?? "—",
      String(r.cantidad_piezas),
      String(r.cantidad_tarimas),
      r.lotes ? String(diasDesde(r.lotes.fecha_ingreso)) : "",
    ]);
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
      String(r.cantidad_piezas),
      String(r.cantidad_tarimas),
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
      return [u.codigo, u.zona ?? "—", String(u.capacidad_max_tarimas), String(ocupado), `${pct}%`];
    });
  }

  if (tipo === "cargos") {
    columnas = [
      { encabezado: "Lote", ancho: 1.6 },
      { encabezado: "Cliente", ancho: 1.8 },
      { encabezado: "Producto", ancho: 2.2 },
      { encabezado: "Días", ancho: 0.8 },
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
    const fmt = (n: number) => `$${n.toFixed(2)}`;
    const lineas = await calcularCargosPeriodo(supabase, { desde, hasta, clienteId });
    filas = lineas.map((l) => [
      l.codigo_lote,
      l.cliente,
      l.producto,
      String(l.dias_con_existencia),
      fmt(l.costo_almacenaje),
      String(l.tarimas_entrada),
      fmt(l.costo_maniobra_entrada),
      String(l.tarimas_salida),
      fmt(l.costo_maniobra_salida),
      fmt(l.costo_total),
    ]);
    if (lineas.length > 0) {
      const suma = (f: (l: (typeof lineas)[number]) => number) => lineas.reduce((s, l) => s + f(l), 0);
      filas.push([
        "TOTAL",
        "",
        "",
        "",
        fmt(suma((l) => l.costo_almacenaje)),
        String(suma((l) => l.tarimas_entrada)),
        fmt(suma((l) => l.costo_maniobra_entrada)),
        String(suma((l) => l.tarimas_salida)),
        fmt(suma((l) => l.costo_maniobra_salida)),
        fmt(suma((l) => l.costo_total)),
      ]);
    }
  }

  const nombreArchivo = `${tipo}-${formatearFecha(new Date().toISOString()).replace(/\s/g, "-")}`;

  const esCargosConTotal = tipo === "cargos" && filas.length > 0 && filas[filas.length - 1][0] === "TOTAL";

  if (formato === "excel") {
    const buffer = await generarExcelTabla(
      TITULOS[tipo],
      columnas.map((c) => ({ encabezado: c.encabezado, ancho: c.ancho * 8 })),
      filas,
      { filasNegrita: esCargosConTotal ? [filas.length - 1] : [] }
    );
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nombreArchivo}.xlsx"`,
      },
    });
  }

  const subtitulo = `Generado el ${formatearFechaHora(new Date().toISOString())} · ${filas.length} registros`;
  const pdfBytes = await generarPdfTabla(TITULOS[tipo], subtitulo, columnas, filas, {
    orientacion: tipo === "cargos" ? "horizontal" : "vertical",
    filasNegrita: esCargosConTotal ? [filas.length - 1] : [],
  });
  return new NextResponse(new Uint8Array(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo}.pdf"`,
    },
  });
}
