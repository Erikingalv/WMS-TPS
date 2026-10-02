import type { PDFFont } from "pdf-lib";

// ---------------------------------------------------------------
// Texto con salto de línea manual: pdf-lib envuelve el texto solo cuando
// se le da maxWidth, pero no informa en cuántas líneas quedó — y este
// documento coloca la siguiente fila de campos a una altura fija después
// de cada una. Sin saber cuántas líneas usó un valor largo (un nombre de
// producto, un destino), la fila de abajo se dibuja encima. Por eso aquí
// se calcula el envuelto a mano: así se sabe exactamente cuánta altura
// ocupó cada campo antes de dibujar el que sigue.
// ---------------------------------------------------------------
function envolverParrafo(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const limpio = texto || "—";
  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length === 0) return ["—"];

  const lineas: string[] = [];
  let actual = "";

  const partirPalabraLarga = (palabra: string) => {
    let resto = palabra;
    while (fuente.widthOfTextAtSize(resto, tamano) > anchoMax && resto.length > 1) {
      let corte = resto.length;
      while (corte > 1 && fuente.widthOfTextAtSize(resto.slice(0, corte), tamano) > anchoMax) corte--;
      lineas.push(resto.slice(0, corte));
      resto = resto.slice(corte);
    }
    return resto;
  };

  for (const palabra of palabras) {
    const candidato = actual ? `${actual} ${palabra}` : palabra;
    if (fuente.widthOfTextAtSize(candidato, tamano) <= anchoMax) {
      actual = candidato;
      continue;
    }
    if (actual) lineas.push(actual);
    actual = fuente.widthOfTextAtSize(palabra, tamano) > anchoMax ? partirPalabraLarga(palabra) : palabra;
  }
  if (actual) lineas.push(actual);
  return lineas.length > 0 ? lineas : ["—"];
}

// Igual, pero respeta los saltos de línea del texto (cada "\n" empieza un
// renglón nuevo) — para celdas con varias líneas, como el cálculo de un cobro.
export function envolverTexto(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
  const parrafos = (texto || "—").split("\n");
  if (parrafos.length === 1) return envolverParrafo(texto, fuente, tamano, anchoMax);
  return parrafos.flatMap((p) => (p.trim() === "" ? [""] : envolverParrafo(p, fuente, tamano, anchoMax)));
}
