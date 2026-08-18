// pdf-lib con las fuentes estándar (Helvetica) solo puede dibujar texto en
// WinAnsi (cp1252) — un solo carácter fuera de ese set (emoji, alguna
// comilla o símbolo raro pegado desde WhatsApp/Excel) hace que truene al
// generar el PDF. Como el texto de observaciones/destino/cliente/etc. lo
// escriben personas a mano, esto pasa con ciertos movimientos sí y otros
// no, según lo que se haya tecleado en cada uno — por eso algunos
// comprobantes/reportes fallan y otros no. Limpiar el texto antes de
// pasarlo a pdf-lib evita el error en vez de solo evitar mostrarlo.

const REEMPLAZOS: Record<string, string> = {
  "‘": "'",
  "’": "'",
  "‚": ",",
  "“": '"',
  "”": '"',
  "„": '"',
  "–": "-",
  "—": "-",
  "…": "...",
  "•": "-",
  " ": " ",
  "‹": "<",
  "›": ">",
  "（": "(",
  "）": ")",
  "，": ",",
  "：": ":",
};

// Puntos de código que WinAnsi sí soporta fuera de ASCII/Latin-1 básico
// (bloque 0x80-0x9F de cp1252).
const EXTRA_WINANSI = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function esWinAnsi(codigo: number): boolean {
  if (codigo === 0x0a) return true; // salto de línea: pdf-lib sí lo interpreta
  if (codigo >= 0x20 && codigo <= 0x7e) return true;
  if (codigo >= 0xa0 && codigo <= 0xff) return true;
  return EXTRA_WINANSI.has(codigo);
}

export function limpiarTextoPdf(texto: string | null | undefined): string {
  if (!texto) return "";
  // Normaliza saltos de línea (\r\n de Windows/Excel, \r solo de Mac
  // clásico) a \n antes de filtrar — si no, el \r suelto (control, fuera de
  // WinAnsi) también tronaba, y ya no queda ni el salto de línea.
  let resultado = texto.replace(/\r\n?/g, "\n");
  for (const [buscar, reemplazo] of Object.entries(REEMPLAZOS)) {
    resultado = resultado.split(buscar).join(reemplazo);
  }
  return Array.from(resultado)
    .map((ch) => (esWinAnsi(ch.codePointAt(0) ?? 0) ? ch : "?"))
    .join("");
}
