import ExcelJS from "exceljs";

export async function generarExcelTabla(
  hoja: string,
  columnas: { encabezado: string; ancho: number }[],
  filas: (string | number)[][],
  opciones?: { filasNegrita?: number[] }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "WMS";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(hoja);
  sheet.columns = columnas.map((c) => ({ header: c.encabezado, width: c.ancho }));

  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE1EBEA" },
  };

  const filasNegrita = new Set(opciones?.filasNegrita ?? []);
  filas.forEach((fila, i) => {
    const row = sheet.addRow(fila);
    if (filasNegrita.has(i)) row.font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
