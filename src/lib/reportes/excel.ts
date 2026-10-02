import ExcelJS from "exceljs";

export type HojaExcel = {
  nombre: string;
  columnas: { encabezado: string; ancho: number }[];
  filas: (string | number)[][];
  filasNegrita?: number[];
};

export async function generarExcelLibro(hojas: HojaExcel[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WMS";
  workbook.created = new Date();

  for (const hoja of hojas) {
    const sheet = workbook.addWorksheet(hoja.nombre);
    sheet.columns = hoja.columnas.map((c) => ({ header: c.encabezado, width: c.ancho }));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).alignment = { wrapText: true, vertical: "top" };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE1EBEA" },
    };

    const filasNegrita = new Set(hoja.filasNegrita ?? []);
    hoja.filas.forEach((fila, i) => {
      const row = sheet.addRow(fila);
      // Las celdas con varias líneas (ej. el cálculo de un cobro) se ven
      // completas en vez de en una sola línea cortada.
      row.alignment = { wrapText: true, vertical: "top" };
      if (filasNegrita.has(i)) row.font = { bold: true };
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function generarExcelTabla(
  hoja: string,
  columnas: { encabezado: string; ancho: number }[],
  filas: (string | number)[][],
  opciones?: { filasNegrita?: number[] }
): Promise<Buffer> {
  return generarExcelLibro([{ nombre: hoja, columnas, filas, filasNegrita: opciones?.filasNegrita }]);
}
