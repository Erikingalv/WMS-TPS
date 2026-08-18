import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  generarComprobanteConsolidado,
  type CampoComprobante,
  type LineaConsolidado,
} from "@/lib/reportes/comprobante";
import { formatearFecha } from "@/lib/utils/dates";

async function obtenerFirmaPng(url: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    return new Uint8Array(await resp.arrayBuffer());
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tipo: string }> }
) {
  const { tipo } = await params;
  if (tipo !== "entrada" && tipo !== "salida") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Faltan los ids de los movimientos" }, { status: 400 });
  }

  const supabase = await createClient();
  const tabla = tipo === "entrada" ? "entradas" : "salidas";

  const { data: filasRaw } = await supabase
    .from(tabla)
    .select(
      tipo === "entrada"
        ? "id, fecha, hora_carga_descarga, cantidad_piezas, cantidad_tarimas, numero_contenedor, numero_bl, observaciones, firma_digital_url, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
        : "id, fecha, hora_carga_descarga, cantidad_piezas, cantidad_tarimas, destino, transportista, placas, operador, observaciones, firma_digital_url, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
    )
    .in("id", ids);

  if (!filasRaw || filasRaw.length === 0) {
    return NextResponse.json({ error: "No se encontraron los movimientos" }, { status: 404 });
  }

  type FilaConsolidadoRaw = {
    id: string;
    fecha: string;
    hora_carga_descarga: string | null;
    cantidad_piezas: number;
    cantidad_tarimas: number;
    numero_contenedor?: string | null;
    numero_bl?: string | null;
    destino?: string | null;
    transportista?: string | null;
    placas?: string | null;
    operador?: string | null;
    observaciones: string | null;
    firma_digital_url: string | null;
    clientes: { nombre: string } | null;
    productos: { nombre: string; sku: string } | null;
    lotes: { codigo_lote: string } | null;
    ubicaciones: { codigo: string } | null;
    recibio?: { nombre: string } | null;
    autorizo?: { nombre: string } | null;
  };

  const filas = filasRaw as unknown as FilaConsolidadoRaw[];
  // Orden estable: como se registraron.
  const primera = filas[0];

  const camposEncabezado: CampoComprobante[] =
    tipo === "entrada"
      ? [
          { etiqueta: "Fecha", valor: formatearFecha(primera.fecha) },
          { etiqueta: "Hora de carga/descarga", valor: primera.hora_carga_descarga?.slice(0, 5) ?? "—" },
          { etiqueta: "Contenedor", valor: primera.numero_contenedor ?? "—" },
          { etiqueta: "BL / Referencia", valor: primera.numero_bl ?? "—" },
        ]
      : [
          { etiqueta: "Fecha", valor: formatearFecha(primera.fecha) },
          { etiqueta: "Hora de carga/descarga", valor: primera.hora_carga_descarga?.slice(0, 5) ?? "—" },
          { etiqueta: "Destino", valor: primera.destino ?? "—" },
          { etiqueta: "Transportista", valor: primera.transportista ?? "—" },
          { etiqueta: "Placas / unidad", valor: primera.placas ?? "—" },
          { etiqueta: "Operador", valor: primera.operador ?? "—" },
        ];

  const lineas: LineaConsolidado[] = filas.map((f) => ({
    codigoLote: f.lotes?.codigo_lote ?? "—",
    cliente: f.clientes?.nombre ?? "—",
    producto: f.productos?.nombre ?? "—",
    sku: f.productos?.sku ?? "—",
    piezas: f.cantidad_piezas,
    tarimas: f.cantidad_tarimas,
    ubicacion: f.ubicaciones?.codigo ?? "—",
  }));

  // Observaciones y firma: se capturan una sola vez para todo el embarque
  // (mismos valores en todas las líneas), se toman de la primera.
  const observaciones = primera.observaciones;
  const nombreEntregaRecibe = (tipo === "entrada" ? primera.recibio?.nombre : primera.autorizo?.nombre) ?? null;
  const firmaDigitalPng = await obtenerFirmaPng(primera.firma_digital_url);

  let pdf: Uint8Array;
  try {
    pdf = await generarComprobanteConsolidado({
      tipo,
      camposEncabezado,
      observaciones,
      nombreEntregaRecibe,
      firmaDigitalPng,
      lineas,
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el PDF consolidado" }, { status: 500 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comprobante-${tipo}-consolidado.pdf"`,
    },
  });
}
