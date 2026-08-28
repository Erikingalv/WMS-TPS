import type { createClient } from "@/lib/supabase/server";
import {
  generarComprobante,
  generarComprobanteConsolidado,
  type CampoComprobante,
  type LineaConsolidado,
} from "@/lib/reportes/comprobante";
import { formatearFecha } from "@/lib/utils/dates";
import { formatearTarimas } from "@/lib/utils/tarimas";
import { formatearNumero } from "@/lib/utils/numeros";
import type { FilaEntrada, FilaSalida } from "@/lib/reportes/columnas";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type Tipo = "entrada" | "salida";

type ResultadoPdf = { pdf: Uint8Array; filename: string } | { error: string; status: number };

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

// Un embarque/viaje consolidado registra un movimiento (entrada o salida)
// por producto, todos con el mismo grupo_id — pero deben documentarse
// como uno solo. Esta función es el único punto de entrada para generar
// el PDF de "un movimiento": revisa si `id` tiene hermanos en su grupo y
// arma el comprobante consolidado si los tiene, o el individual si no.
export async function generarPdfMovimiento(
  supabase: SupabaseServerClient,
  tipo: Tipo,
  id: string
): Promise<ResultadoPdf> {
  const tabla = tipo === "entrada" ? "entradas" : "salidas";

  const { data: base } = await supabase.from(tabla).select("grupo_id").eq("id", id).single();
  if (!base) return { error: "No encontrado", status: 404 };

  const { data: hermanosRaw } = await supabase.from(tabla).select("id").eq("grupo_id", base.grupo_id);
  const ids = (hermanosRaw ?? []).map((r) => r.id as string);

  if (ids.length > 1) {
    return generarPdfConsolidado(supabase, tipo, ids);
  }
  return generarPdfIndividual(supabase, tipo, id);
}

async function generarPdfIndividual(
  supabase: SupabaseServerClient,
  tipo: Tipo,
  id: string
): Promise<ResultadoPdf> {
  if (tipo === "entrada") {
    const { data: dataRaw } = await supabase
      .from("entradas")
      .select(
        "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
      )
      .eq("id", id)
      .single();

    if (!dataRaw) return { error: "No encontrado", status: 404 };
    const data = dataRaw as unknown as FilaEntrada;

    const campos: CampoComprobante[] = [
      { etiqueta: "Lote", valor: data.lotes?.codigo_lote ?? "—" },
      { etiqueta: "SKU", valor: data.productos?.sku ?? "—" },
      { etiqueta: "Piezas", valor: formatearNumero(data.cantidad_piezas) },
      { etiqueta: "Tarimas", valor: formatearNumero(data.cantidad_tarimas) },
      {
        etiqueta: "Identificador de tarimas",
        valor: data.tarima_desde != null ? `${data.tarima_desde}-${data.tarima_hasta}` : "—",
      },
      { etiqueta: "Ubicación", valor: data.ubicaciones?.codigo ?? "—" },
      { etiqueta: "Presentación", valor: data.presentacion ?? "—" },
      { etiqueta: "Cajas por pallet", valor: data.cajas_por_pallet != null ? formatearNumero(data.cajas_por_pallet) : "—" },
      { etiqueta: "Cantidad por caja", valor: data.cantidad_por_caja != null ? formatearNumero(data.cantidad_por_caja) : "—" },
      { etiqueta: "Categoría", valor: data.categoria_producto ?? "—" },
      { etiqueta: "Lote 1", valor: data.lote_1 ?? "—" },
      { etiqueta: "Lote 2 (SAP)", valor: data.lote_2 ?? "—" },
      { etiqueta: "Contenedor", valor: data.numero_contenedor ?? "—" },
      { etiqueta: "BL / Referencia", valor: data.numero_bl ?? "—" },
      { etiqueta: "Peso (kg)", valor: data.peso_kg != null ? formatearNumero(data.peso_kg) : "—" },
      ...(data.tarimas_parciales && data.tarimas_parciales.length > 0
        ? [
            {
              etiqueta: "Tarimas parciales",
              valor: data.tarimas_parciales
                .map((t) => `${t.numero_tarima != null ? `#${t.numero_tarima}` : "s/n"}: ${formatearNumero(t.piezas)} pz`)
                .join(", "),
            },
          ]
        : []),
    ];

    try {
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
        firmaDigitalPng: await obtenerFirmaPng(data.firma_digital_url),
      });
      return { pdf, filename: `comprobante-entrada-${data.lotes?.codigo_lote ?? id.slice(0, 8)}.pdf` };
    } catch {
      return { error: "No se pudo generar el PDF de este comprobante", status: 500 };
    }
  }

  const { data: dataRaw } = await supabase
    .from("salidas")
    .select(
      "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
    )
    .eq("id", id)
    .single();

  if (!dataRaw) return { error: "No encontrado", status: 404 };
  const data = dataRaw as unknown as FilaSalida;

  const campos: CampoComprobante[] = [
    { etiqueta: "Lote", valor: data.lotes?.codigo_lote ?? "—" },
    { etiqueta: "SKU", valor: data.productos?.sku ?? "—" },
    { etiqueta: "Piezas", valor: formatearNumero(data.cantidad_piezas) },
    { etiqueta: "Tarimas", valor: formatearNumero(data.cantidad_tarimas) },
    {
      etiqueta: "Identificador de tarimas",
      valor:
        data.tarima_numeros && data.tarima_numeros.length > 0
          ? formatearTarimas(data.tarima_numeros)
          : data.tarima_desde != null
            ? `${data.tarima_desde}-${data.tarima_hasta}`
            : "—",
    },
    { etiqueta: "Ubicación", valor: data.ubicaciones?.codigo ?? "—" },
    { etiqueta: "Destino", valor: data.destino ?? "—" },
    { etiqueta: "Transportista", valor: data.transportista ?? "—" },
    { etiqueta: "Placas / unidad", valor: data.placas ?? "—" },
    { etiqueta: "Operador", valor: data.operador ?? "—" },
    { etiqueta: "Presentación", valor: data.presentacion ?? "—" },
    { etiqueta: "Cajas por pallet", valor: data.cajas_por_pallet != null ? formatearNumero(data.cajas_por_pallet) : "—" },
    { etiqueta: "Cantidad por caja", valor: data.cantidad_por_caja != null ? formatearNumero(data.cantidad_por_caja) : "—" },
    { etiqueta: "Categoría", valor: data.categoria_producto ?? "—" },
    { etiqueta: "Lote 1", valor: data.lote_1 ?? "—" },
    { etiqueta: "Lote 2 (SAP)", valor: data.lote_2 ?? "—" },
    { etiqueta: "Contenedor", valor: data.numero_contenedor ?? "—" },
    { etiqueta: "BL / Referencia", valor: data.numero_bl ?? "—" },
    ...(data.piezas_tarima_parcial != null
      ? [
          {
            etiqueta: "Tarima parcial",
            valor: `${data.numero_tarima_parcial != null ? `tarima #${data.numero_tarima_parcial}: ` : ""}${formatearNumero(data.piezas_tarima_parcial)} pz`,
          },
        ]
      : []),
  ];

  try {
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
      firmaDigitalPng: await obtenerFirmaPng(data.firma_digital_url),
    });
    return { pdf, filename: `comprobante-salida-${data.lotes?.codigo_lote ?? id.slice(0, 8)}.pdf` };
  } catch {
    return { error: "No se pudo generar el PDF de este comprobante", status: 500 };
  }
}

async function generarPdfConsolidado(
  supabase: SupabaseServerClient,
  tipo: Tipo,
  ids: string[]
): Promise<ResultadoPdf> {
  const tabla = tipo === "entrada" ? "entradas" : "salidas";

  const { data: filasRaw } = await supabase
    .from(tabla)
    .select(
      tipo === "entrada"
        ? "id, fecha, hora_carga_descarga, cantidad_piezas, cantidad_tarimas, numero_contenedor, numero_bl, observaciones, firma_digital_url, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
        : "id, fecha, hora_carga_descarga, cantidad_piezas, cantidad_tarimas, destino, transportista, placas, operador, numero_bl, observaciones, firma_digital_url, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
    )
    .in("id", ids);

  if (!filasRaw || filasRaw.length === 0) {
    return { error: "No se encontraron los movimientos", status: 404 };
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
          { etiqueta: "BL / Referencia", valor: primera.numero_bl ?? "—" },
        ];

  const lineas: LineaConsolidado[] = filas.map((f) => ({
    codigoLote: f.lotes?.codigo_lote ?? "—",
    cliente: f.clientes?.nombre ?? "—",
    producto: f.productos?.nombre ?? "—",
    sku: f.productos?.sku ?? "—",
    bl: f.numero_bl ?? "—",
    piezas: f.cantidad_piezas,
    tarimas: f.cantidad_tarimas,
    ubicacion: f.ubicaciones?.codigo ?? "—",
  }));

  const observaciones = primera.observaciones;
  const nombreEntregaRecibe = (tipo === "entrada" ? primera.recibio?.nombre : primera.autorizo?.nombre) ?? null;
  const firmaDigitalPng = await obtenerFirmaPng(primera.firma_digital_url);

  try {
    const pdf = await generarComprobanteConsolidado({
      tipo,
      camposEncabezado,
      observaciones,
      nombreEntregaRecibe,
      firmaDigitalPng,
      lineas,
    });
    return { pdf, filename: `comprobante-${tipo}-consolidado.pdf` };
  } catch {
    return { error: "No se pudo generar el PDF consolidado", status: 500 };
  }
}
