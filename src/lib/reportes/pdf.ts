import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { limpiarTextoPdf } from "@/lib/utils/pdfTexto";
import { envolverTexto } from "@/lib/reportes/pdfLayout";

const MARGEN = 40;
const ALTO_RENGLON = 18;
const TINTA = rgb(0.125, 0.121, 0.109); // #201F1C
const TINTA_SUAVE = rgb(0.36, 0.34, 0.3);
const LINEA = rgb(0.85, 0.84, 0.78);
const ACENTO_SUAVE = rgb(0.88, 0.92, 0.92);

export interface ColumnaPdf {
  encabezado: string;
  ancho: number; // proporción relativa
}

export async function generarPdfTabla(
  tituloOriginal: string,
  subtituloOriginal: string,
  columnasOriginales: ColumnaPdf[],
  filasOriginales: string[][],
  opciones?: {
    orientacion?: "vertical" | "horizontal";
    filasNegrita?: number[];
    // En vez de recortar con "…" el texto que no cabe, lo parte en varios
    // renglones dentro de la misma celda (la fila crece lo necesario).
    // Para reportes de cobro, donde un código de lote o un producto
    // recortado impide saber de qué renglón se trata.
    ajustarTexto?: boolean;
    tamanoFuente?: number;
    // Hoja tamaño oficio (legal) horizontal, para tablas con muchas columnas.
    paginaAncha?: boolean;
  }
): Promise<Uint8Array> {
  const titulo = limpiarTextoPdf(tituloOriginal);
  const subtitulo = limpiarTextoPdf(subtituloOriginal);
  const columnas = columnasOriginales.map((c) => ({ ...c, encabezado: limpiarTextoPdf(c.encabezado) }));
  const filas = filasOriginales.map((fila) => fila.map((celda) => limpiarTextoPdf(celda)));

  const horizontal = opciones?.orientacion === "horizontal";
  const anchoPagina = horizontal ? (opciones?.paginaAncha ? 1008 : 792) : 612;
  const altoPagina = horizontal ? 612 : 792;
  const filasNegrita = new Set(opciones?.filasNegrita ?? []);

  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const anchoUtil = anchoPagina - MARGEN * 2;
  const sumaProporciones = columnas.reduce((s, c) => s + c.ancho, 0);
  const anchosPx = columnas.map((c) => (c.ancho / sumaProporciones) * anchoUtil);

  const ajustar = opciones?.ajustarTexto === true;
  const tam = opciones?.tamanoFuente ?? 9;
  const tamEnc = ajustar ? tam : 8.5;
  const interlinea = tam + 2.5;

  let page = doc.addPage([anchoPagina, altoPagina]);
  let y = altoPagina - MARGEN;

  // Alto de un renglón de la tabla: con ajuste de texto depende de la
  // celda que ocupe más líneas.
  function lineasDeFila(celdas: string[], f: PDFFont, tamano: number): string[][] {
    return celdas.map((celda, i) => (celda ? envolverTexto(celda, f, tamano, anchosPx[i] - 8) : [""]));
  }

  function dibujarEncabezadoPagina(primeraPagina: boolean) {
    if (primeraPagina) {
      page.drawText(titulo, { x: MARGEN, y, size: 16, font: fuenteBold, color: TINTA });
      y -= 20;
      page.drawText(subtitulo, { x: MARGEN, y, size: 9, font: fuente, color: TINTA_SUAVE });
      y -= 24;
    }
    const lineasEnc = ajustar ? lineasDeFila(columnas.map((c) => c.encabezado), fuenteBold, tamEnc) : null;
    const altoEnc = lineasEnc ? Math.max(...lineasEnc.map((l) => l.length)) * interlinea + 6 : ALTO_RENGLON;
    page.drawRectangle({
      x: MARGEN,
      y: y - altoEnc + ALTO_RENGLON - 4,
      width: anchoUtil,
      height: altoEnc,
      color: ACENTO_SUAVE,
    });
    let x = MARGEN + 4;
    columnas.forEach((col, i) => {
      if (lineasEnc) {
        lineasEnc[i].forEach((t, li) => {
          page.drawText(t, { x, y: y - li * interlinea, size: tamEnc, font: fuenteBold, color: TINTA });
        });
      } else {
        const texto = truncarTexto(col.encabezado, fuenteBold, 8.5, anchosPx[i] - 8);
        page.drawText(texto, { x, y, size: 8.5, font: fuenteBold, color: TINTA });
      }
      x += anchosPx[i];
    });
    y -= altoEnc;
  }

  dibujarEncabezadoPagina(true);

  filas.forEach((fila, filaIdx) => {
    const negrita = filasNegrita.has(filaIdx);
    const fuenteFila = negrita ? fuenteBold : fuente;
    const lineas = ajustar ? lineasDeFila(fila, fuenteFila, tam) : null;
    const altoFila = lineas ? Math.max(...lineas.map((l) => l.length)) * interlinea + 6 : ALTO_RENGLON;

    if (y < MARGEN + altoFila) {
      page = doc.addPage([anchoPagina, altoPagina]);
      y = altoPagina - MARGEN;
      dibujarEncabezadoPagina(false);
    }

    let x = MARGEN + 4;
    fila.forEach((celda, i) => {
      if (lineas) {
        lineas[i].forEach((t, li) => {
          page.drawText(t, { x, y: y - li * interlinea, size: tam, font: fuenteFila, color: TINTA });
        });
      } else {
        const texto = truncarTexto(celda ?? "", fuenteFila, 9, anchosPx[i] - 8);
        page.drawText(texto, { x, y, size: 9, font: fuenteFila, color: TINTA });
      }
      x += anchosPx[i];
    });

    // Con texto en varios renglones la línea va justo bajo el último, no a
    // medio camino del espacio hacia la fila siguiente (donde cortaría su
    // primer renglón).
    const yLinea = lineas ? y - (Math.max(...lineas.map((l) => l.length)) - 1) * interlinea - 4 : y - 4;
    page.drawLine({
      start: { x: MARGEN, y: yLinea },
      end: { x: MARGEN + anchoUtil, y: yLinea },
      thickness: 0.5,
      color: LINEA,
    });

    y -= altoFila;
  });

  if (filas.length === 0) {
    page.drawText("Sin datos para los filtros seleccionados.", {
      x: MARGEN,
      y,
      size: 9,
      font: fuente,
      color: TINTA_SUAVE,
    });
  }

  return doc.save();
}

function truncarTexto(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string {
  if (fuente.widthOfTextAtSize(texto, tamano) <= anchoMax) return texto;
  let recortado = texto;
  while (recortado.length > 1 && fuente.widthOfTextAtSize(recortado + "…", tamano) > anchoMax) {
    recortado = recortado.slice(0, -1);
  }
  return recortado + "…";
}

// Une varios PDF en uno, en el orden dado (ej. hoja de resumen + detalle).
export async function unirPdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const salida = await PDFDocument.create();
  for (const bytes of pdfs) {
    const origen = await PDFDocument.load(bytes);
    const paginas = await salida.copyPages(origen, origen.getPageIndices());
    paginas.forEach((p) => salida.addPage(p));
  }
  return salida.save();
}
