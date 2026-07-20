import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarComprobante, type CampoComprobante } from "@/lib/reportes/comprobante";
import { formatearFecha } from "@/lib/utils/dates";
import type { FilaEntrada, FilaSalida } from "@/lib/reportes/columnas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tipo: string; id: string }> }
) {
  const { tipo, id } = await params;
  if (tipo !== "entrada" && tipo !== "salida") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const supabase = await createClient();

  if (tipo === "entrada") {
    const { data: dataRaw } = await supabase
      .from("entradas")
      .select(
        "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
      )
      .eq("id", id)
      .single();

    if (!dataRaw) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    const data = dataRaw as unknown as FilaEntrada;

    const campos: CampoComprobante[] = [
      { etiqueta: "Lote", valor: data.lotes?.codigo_lote ?? "—" },
      { etiqueta: "SKU", valor: data.productos?.sku ?? "—" },
      { etiqueta: "Piezas", valor: String(data.cantidad_piezas) },
      { etiqueta: "Tarimas", valor: String(data.cantidad_tarimas) },
      { etiqueta: "Ubicación", valor: data.ubicaciones?.codigo ?? "—" },
      { etiqueta: "Presentación", valor: data.presentacion ?? "—" },
      { etiqueta: "Cajas por pallet", valor: data.cajas_por_pallet != null ? String(data.cajas_por_pallet) : "—" },
      { etiqueta: "Cantidad por caja", valor: data.cantidad_por_caja != null ? String(data.cantidad_por_caja) : "—" },
      { etiqueta: "Categoría", valor: data.categoria_producto ?? "—" },
      { etiqueta: "Lote 1", valor: data.lote_1 ?? "—" },
      { etiqueta: "Lote 2 (SAP)", valor: data.lote_2 ?? "—" },
      { etiqueta: "Contenedor", valor: data.numero_contenedor ?? "—" },
      { etiqueta: "BL / Referencia", valor: data.numero_bl ?? "—" },
      { etiqueta: "Peso (kg)", valor: data.peso_kg != null ? String(data.peso_kg) : "—" },
    ];

    const pdf = await generarComprobante({
      tipo: "entrada",
      folio: data.lotes?.codigo_lote ?? id.slice(0, 8),
      fecha: formatearFecha(data.fecha),
      hora: data.hora_carga_descarga?.slice(0, 5) ?? "—",
      cliente: data.clientes?.nombre ?? "—",
      producto: data.productos?.nombre ?? "—",
      campos,
      observaciones: data.observaciones,
      nombreEntregaRecibe: data.recibio?.nombre ?? null,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="comprobante-entrada-${data.lotes?.codigo_lote ?? id.slice(0, 8)}.pdf"`,
      },
    });
  }

  const { data: dataRaw } = await supabase
    .from("salidas")
    .select(
      "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
    )
    .eq("id", id)
    .single();

  if (!dataRaw) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const data = dataRaw as unknown as FilaSalida;

  const campos: CampoComprobante[] = [
    { etiqueta: "Lote", valor: data.lotes?.codigo_lote ?? "—" },
    { etiqueta: "SKU", valor: data.productos?.sku ?? "—" },
    { etiqueta: "Piezas", valor: String(data.cantidad_piezas) },
    { etiqueta: "Tarimas", valor: String(data.cantidad_tarimas) },
    { etiqueta: "Ubicación", valor: data.ubicaciones?.codigo ?? "—" },
    { etiqueta: "Destino", valor: data.destino ?? "—" },
    { etiqueta: "Transportista", valor: data.transportista ?? "—" },
    { etiqueta: "Placas / unidad", valor: data.placas ?? "—" },
    { etiqueta: "Operador", valor: data.operador ?? "—" },
    { etiqueta: "Presentación", valor: data.presentacion ?? "—" },
    { etiqueta: "Cajas por pallet", valor: data.cajas_por_pallet != null ? String(data.cajas_por_pallet) : "—" },
    { etiqueta: "Cantidad por caja", valor: data.cantidad_por_caja != null ? String(data.cantidad_por_caja) : "—" },
    { etiqueta: "Categoría", valor: data.categoria_producto ?? "—" },
    { etiqueta: "Lote 1", valor: data.lote_1 ?? "—" },
    { etiqueta: "Contenedor", valor: data.numero_contenedor ?? "—" },
    { etiqueta: "BL / Referencia", valor: data.numero_bl ?? "—" },
  ];

  const pdf = await generarComprobante({
    tipo: "salida",
    folio: data.lotes?.codigo_lote ?? id.slice(0, 8),
    fecha: formatearFecha(data.fecha),
    hora: data.hora_carga_descarga?.slice(0, 5) ?? "—",
    cliente: data.clientes?.nombre ?? "—",
    producto: data.productos?.nombre ?? "—",
    campos,
    observaciones: data.observaciones,
    nombreEntregaRecibe: data.autorizo?.nombre ?? null,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="comprobante-salida-${data.lotes?.codigo_lote ?? id.slice(0, 8)}.pdf"`,
    },
  });
}
