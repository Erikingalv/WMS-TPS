import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

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
  titulo: string,
  subtitulo: string,
  columnas: ColumnaPdf[],
  filas: string[][],
  opciones?: { orientacion?: "vertical" | "horizontal"; filasNegrita?: number[] }
): Promise<Uint8Array> {
  const horizontal = opciones?.orientacion === "horizontal";
  const anchoPagina = horizontal ? 792 : 612;
  const altoPagina = horizontal ? 612 : 792;
  const filasNegrita = new Set(opciones?.filasNegrita ?? []);

  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const anchoUtil = anchoPagina - MARGEN * 2;
  const sumaProporciones = columnas.reduce((s, c) => s + c.ancho, 0);
  const anchosPx = columnas.map((c) => (c.ancho / sumaProporciones) * anchoUtil);

  let page = doc.addPage([anchoPagina, altoPagina]);
  let y = altoPagina - MARGEN;

  function dibujarEncabezadoPagina(primeraPagina: boolean) {
    if (primeraPagina) {
      page.drawText(titulo, { x: MARGEN, y, size: 16, font: fuenteBold, color: TINTA });
      y -= 20;
      page.drawText(subtitulo, { x: MARGEN, y, size: 9, font: fuente, color: TINTA_SUAVE });
      y -= 24;
    }
    page.drawRectangle({
      x: MARGEN,
      y: y - 4,
      width: anchoUtil,
      height: ALTO_RENGLON,
      color: ACENTO_SUAVE,
    });
    let x = MARGEN + 4;
    columnas.forEach((col, i) => {
      const texto = truncarTexto(col.encabezado, fuenteBold, 8.5, anchosPx[i] - 8);
      page.drawText(texto, { x, y, size: 8.5, font: fuenteBold, color: TINTA });
      x += anchosPx[i];
    });
    y -= ALTO_RENGLON;
  }

  dibujarEncabezadoPagina(true);

  filas.forEach((fila, filaIdx) => {
    if (y < MARGEN + ALTO_RENGLON) {
      page = doc.addPage([anchoPagina, altoPagina]);
      y = altoPagina - MARGEN;
      dibujarEncabezadoPagina(false);
    }

    const negrita = filasNegrita.has(filaIdx);
    const fuenteFila = negrita ? fuenteBold : fuente;
    let x = MARGEN + 4;
    fila.forEach((celda, i) => {
      const texto = truncarTexto(celda ?? "", fuenteFila, 9, anchosPx[i] - 8);
      page.drawText(texto, { x, y, size: 9, font: fuenteFila, color: TINTA });
      x += anchosPx[i];
    });

    page.drawLine({
      start: { x: MARGEN, y: y - 4 },
      end: { x: MARGEN + anchoUtil, y: y - 4 },
      thickness: 0.5,
      color: LINEA,
    });

    y -= ALTO_RENGLON;
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
