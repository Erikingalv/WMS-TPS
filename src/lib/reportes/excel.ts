import ExcelJS from "exceljs";

export async function generarExcelTabla(
  hoja: string,
  columnas: { encabezado: string; ancho: number }[],
  filas: (string | number)[][]
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

  filas.forEach((fila) => sheet.addRow(fila));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
