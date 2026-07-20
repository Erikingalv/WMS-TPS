import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const MARGEN = 48;
const ANCHO_PAGINA = 612; // carta
const ALTO_PAGINA = 792;
const TINTA = rgb(0.125, 0.121, 0.109);
const TINTA_SUAVE = rgb(0.36, 0.34, 0.3);
const LINEA = rgb(0.82, 0.81, 0.75);
const ACENTO_SUAVE = rgb(0.88, 0.92, 0.92);

export type CampoComprobante = { etiqueta: string; valor: string };

export interface DatosComprobante {
  tipo: "entrada" | "salida";
  folio: string; // codigo_lote u otro identificador visible
  fecha: string; // ya formateada
  hora: string;
  cliente: string;
  producto: string;
  campos: CampoComprobante[]; // detalle específico (piezas, tarimas, lote, ubicación, etc.)
  observaciones: string | null;
  nombreEntregaRecibe: string | null; // "Recibió" en entrada, "Autorizó" en salida
}

export async function generarComprobante(datos: DatosComprobante): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  const anchoUtil = ANCHO_PAGINA - MARGEN * 2;
  let y = ALTO_PAGINA - MARGEN;

  const titulo = datos.tipo === "entrada" ? "Comprobante de recibo" : "Comprobante de entrega";
  const subtitulo = datos.tipo === "entrada" ? "Prueba de recibo de mercancía" : "Prueba de entrega de mercancía";

  page.drawText("WMS — Resguardo & Control", { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
  page.drawText(datos.folio, { x: ANCHO_PAGINA - MARGEN - fuente.widthOfTextAtSize(datos.folio, 10), y, size: 10, font: fuenteBold, color: TINTA });
  y -= 26;

  page.drawText(titulo, { x: MARGEN, y, size: 20, font: fuenteBold, color: TINTA });
  y -= 18;
  page.drawText(subtitulo, { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
  y -= 28;

  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
  y -= 22;

  function filaEncabezado(etiqueta: string, valor: string, x: number, ancho: number) {
    page.drawText(etiqueta.toUpperCase(), { x, y, size: 8, font: fuenteBold, color: TINTA_SUAVE });
    page.drawText(valor, { x, y: y - 14, size: 11, font: fuente, color: TINTA, maxWidth: ancho });
  }

  const mitad = anchoUtil / 2;
  filaEncabezado("Fecha", datos.fecha, MARGEN, mitad - 10);
  filaEncabezado("Hora de carga/descarga", datos.hora, MARGEN + mitad, mitad - 10);
  y -= 40;
  filaEncabezado("Cliente", datos.cliente, MARGEN, mitad - 10);
  filaEncabezado("Producto", datos.producto, MARGEN + mitad, mitad - 10);
  y -= 40;

  page.drawRectangle({ x: MARGEN, y: y - 4, width: anchoUtil, height: 20, color: ACENTO_SUAVE });
  page.drawText("Detalle del movimiento", { x: MARGEN + 6, y, size: 9.5, font: fuenteBold, color: TINTA });
  y -= 28;

  const colAncho = anchoUtil / 2;
  datos.campos.forEach((c, i) => {
    const col = i % 2;
    const fila = Math.floor(i / 2);
    const x = MARGEN + col * colAncho;
    const yy = y - fila * 32;
    page.drawText(c.etiqueta.toUpperCase(), { x, y: yy, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    page.drawText(c.valor || "—", { x, y: yy - 14, size: 10.5, font: fuente, color: TINTA, maxWidth: colAncho - 12 });
  });
  const filasCampos = Math.ceil(datos.campos.length / 2);
  y -= filasCampos * 32 + 10;

  if (datos.observaciones) {
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    y -= 14;
    page.drawText(datos.observaciones, { x: MARGEN, y, size: 10, font: fuente, color: TINTA, maxWidth: anchoUtil });
    y -= 30;
  }

  // Firma de referencia (quien recibió/autorizó en el sistema) + firmas físicas.
  y -= 10;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
  y -= 24;

  const etiquetaResponsable = datos.tipo === "entrada" ? "Recibió (sistema)" : "Autorizó (sistema)";
  page.drawText(etiquetaResponsable.toUpperCase(), { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
  page.drawText(datos.nombreEntregaRecibe ?? "Sin especificar", { x: MARGEN, y: y - 14, size: 10.5, font: fuente, color: TINTA });
  y -= 60;

  const anchoFirma = (anchoUtil - 30) / 2;
  const etiquetaIzq = datos.tipo === "entrada" ? "Firma de quien entrega" : "Firma de quien entrega (almacén)";
  const etiquetaDer = datos.tipo === "entrada" ? "Firma de quien recibe (almacén)" : "Firma de quien recibe";

  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoFirma, y }, thickness: 1, color: TINTA_SUAVE });
  page.drawText(etiquetaIzq, { x: MARGEN, y: y - 14, size: 9, font: fuente, color: TINTA_SUAVE });
  page.drawText("Nombre: ______________________________", { x: MARGEN, y: y - 32, size: 9, font: fuente, color: TINTA_SUAVE });

  const xDer = MARGEN + anchoFirma + 30;
  page.drawLine({ start: { x: xDer, y }, end: { x: xDer + anchoFirma, y }, thickness: 1, color: TINTA_SUAVE });
  page.drawText(etiquetaDer, { x: xDer, y: y - 14, size: 9, font: fuente, color: TINTA_SUAVE });
  page.drawText("Nombre: ______________________________", { x: xDer, y: y - 32, size: 9, font: fuente, color: TINTA_SUAVE });

  page.drawText(
    `Generado automáticamente · ${new Date().toLocaleString("es-MX")}`,
    { x: MARGEN, y: MARGEN - 20, size: 7.5, font: fuente, color: TINTA_SUAVE }
  );

  return doc.save();
}
