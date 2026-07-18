import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

const MARGEN = 40;
const ALTO_PAGINA = 792; // carta, en puntos
const ANCHO_PAGINA = 612;
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
  filas: string[][]
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const anchoUtil = ANCHO_PAGINA - MARGEN * 2;
  const sumaProporciones = columnas.reduce((s, c) => s + c.ancho, 0);
  const anchosPx = columnas.map((c) => (c.ancho / sumaProporciones) * anchoUtil);

  let page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
  let y = ALTO_PAGINA - MARGEN;

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
      page.drawText(col.encabezado, { x, y, size: 8.5, font: fuenteBold, color: TINTA });
      x += anchosPx[i];
    });
    y -= ALTO_RENGLON;
  }

  dibujarEncabezadoPagina(true);

  for (const fila of filas) {
    if (y < MARGEN + ALTO_RENGLON) {
      page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
      y = ALTO_PAGINA - MARGEN;
      dibujarEncabezadoPagina(false);
    }

    let x = MARGEN + 4;
    fila.forEach((celda, i) => {
      const texto = truncarTexto(celda ?? "", fuente, 9, anchosPx[i] - 8);
      page.drawText(texto, { x, y, size: 9, font: fuente, color: TINTA });
      x += anchosPx[i];
    });

    page.drawLine({
      start: { x: MARGEN, y: y - 4 },
      end: { x: MARGEN + anchoUtil, y: y - 4 },
      thickness: 0.5,
      color: LINEA,
    });

    y -= ALTO_RENGLON;
  }

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
