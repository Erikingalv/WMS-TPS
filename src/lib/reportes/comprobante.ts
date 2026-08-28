import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { limpiarTextoPdf } from "@/lib/utils/pdfTexto";
import { formatearNumero } from "@/lib/utils/numeros";

const MARGEN = 48;
const ANCHO_PAGINA = 612; // carta
const ALTO_PAGINA = 792;
const TINTA = rgb(0.125, 0.121, 0.109);
const TINTA_SUAVE = rgb(0.36, 0.34, 0.3);
const LINEA = rgb(0.82, 0.81, 0.75);
const ACENTO_SUAVE = rgb(0.88, 0.92, 0.92);

export type CampoComprobante = { etiqueta: string; valor: string };

// ---------------------------------------------------------------
// Texto con salto de línea manual: pdf-lib envuelve el texto solo cuando
// se le da maxWidth, pero no informa en cuántas líneas quedó — y este
// documento coloca la siguiente fila de campos a una altura fija después
// de cada una. Sin saber cuántas líneas usó un valor largo (un nombre de
// producto, un destino), la fila de abajo se dibuja encima. Por eso aquí
// se calcula el envuelto a mano: así se sabe exactamente cuánta altura
// ocupó cada campo antes de dibujar el que sigue.
// ---------------------------------------------------------------
function envolverTexto(texto: string, fuente: PDFFont, tamano: number, anchoMax: number): string[] {
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

const INTERLINEA_CAMPO = 13;
const ALTO_ETIQUETA = 14;

// Dibuja ETIQUETA + valor (con salto de línea si hace falta) y devuelve la
// altura total que ocupó, para que quien llama sepa cuánto avanzar antes
// de dibujar lo siguiente.
function dibujarCampo(
  page: PDFPage,
  x: number,
  yTop: number,
  etiqueta: string,
  valor: string,
  anchoCol: number,
  fuente: PDFFont,
  fuenteBold: PDFFont,
  tamanoValor = 10.5
): number {
  page.drawText(etiqueta.toUpperCase(), { x, y: yTop, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
  const lineas = envolverTexto(valor, fuente, tamanoValor, anchoCol);
  lineas.forEach((linea, i) => {
    page.drawText(linea, { x, y: yTop - ALTO_ETIQUETA - i * INTERLINEA_CAMPO, size: tamanoValor, font: fuente, color: TINTA });
  });
  return ALTO_ETIQUETA + lineas.length * INTERLINEA_CAMPO;
}

function altoCampo(valor: string, anchoCol: number, fuente: PDFFont, tamanoValor = 10.5): number {
  return ALTO_ETIQUETA + envolverTexto(valor, fuente, tamanoValor, anchoCol).length * INTERLINEA_CAMPO;
}

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
  firmaDigitalPng?: Uint8Array | null; // si ya se firmó digitalmente desde /comprobantes
}

export async function generarComprobante(datosOriginales: DatosComprobante): Promise<Uint8Array> {
  const datos: DatosComprobante = {
    ...datosOriginales,
    folio: limpiarTextoPdf(datosOriginales.folio),
    fecha: limpiarTextoPdf(datosOriginales.fecha),
    hora: limpiarTextoPdf(datosOriginales.hora),
    cliente: limpiarTextoPdf(datosOriginales.cliente),
    producto: limpiarTextoPdf(datosOriginales.producto),
    campos: datosOriginales.campos.map((c) => ({
      etiqueta: limpiarTextoPdf(c.etiqueta),
      valor: limpiarTextoPdf(c.valor),
    })),
    observaciones: datosOriginales.observaciones ? limpiarTextoPdf(datosOriginales.observaciones) : null,
    nombreEntregaRecibe: datosOriginales.nombreEntregaRecibe
      ? limpiarTextoPdf(datosOriginales.nombreEntregaRecibe)
      : null,
  };

  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const anchoUtil = ANCHO_PAGINA - MARGEN * 2;

  const titulo = datos.tipo === "entrada" ? "Comprobante de recibo" : "Comprobante de entrega";
  const subtitulo = datos.tipo === "entrada" ? "Prueba de recibo de mercancía" : "Prueba de entrega de mercancía";

  let page!: PDFPage;
  let y = 0;

  function nuevaPagina(continuacion: boolean) {
    page = doc.addPage([ANCHO_PAGINA, ALTO_PAGINA]);
    y = ALTO_PAGINA - MARGEN;

    page.drawText("WMS — Resguardo & Control", { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
    if (!continuacion) {
      page.drawText(datos.folio, {
        x: ANCHO_PAGINA - MARGEN - fuenteBold.widthOfTextAtSize(datos.folio, 10),
        y,
        size: 10,
        font: fuenteBold,
        color: TINTA,
      });
    }
    y -= 26;

    if (!continuacion) {
      page.drawText(titulo, { x: MARGEN, y, size: 20, font: fuenteBold, color: TINTA });
      y -= 18;
      page.drawText(subtitulo, { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
      y -= 28;
    } else {
      page.drawText(`${titulo} (continuación)`, { x: MARGEN, y, size: 12, font: fuenteBold, color: TINTA });
      y -= 24;
    }

    page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
    y -= 22;
  }

  // Si dibujar lo que sigue no cabe en lo que queda de página, empieza una
  // página nueva de continuación antes de dibujarlo.
  function asegurarEspacio(altoNecesario: number) {
    if (y - altoNecesario < MARGEN) {
      nuevaPagina(true);
    }
  }

  nuevaPagina(false);

  const mitad = anchoUtil / 2;
  const anchoColEncabezado = mitad - 10;
  const filaEncabezado = (etiquetaA: string, valorA: string, etiquetaB: string, valorB: string) => {
    const alto =
      Math.max(
        altoCampo(valorA, anchoColEncabezado, fuente, 11),
        altoCampo(valorB, anchoColEncabezado, fuente, 11)
      ) + 12;
    asegurarEspacio(alto);
    dibujarCampo(page, MARGEN, y, etiquetaA, valorA, anchoColEncabezado, fuente, fuenteBold, 11);
    dibujarCampo(page, MARGEN + mitad, y, etiquetaB, valorB, anchoColEncabezado, fuente, fuenteBold, 11);
    y -= alto;
  };

  filaEncabezado("Fecha", datos.fecha, "Hora de carga/descarga", datos.hora);
  filaEncabezado("Cliente", datos.cliente, "Producto", datos.producto);
  y -= 6;

  asegurarEspacio(28);
  page.drawRectangle({ x: MARGEN, y: y - 4, width: anchoUtil, height: 20, color: ACENTO_SUAVE });
  page.drawText("Detalle del movimiento", { x: MARGEN + 6, y, size: 9.5, font: fuenteBold, color: TINTA });
  y -= 28;

  const colAncho = anchoUtil / 2;
  const anchoColCampo = colAncho - 12;
  for (let fila = 0; fila < Math.ceil(datos.campos.length / 2); fila++) {
    const izq = datos.campos[fila * 2];
    const der = datos.campos[fila * 2 + 1];
    const alturas = [izq, der].filter(Boolean).map((c) => altoCampo(c!.valor || "—", anchoColCampo, fuente));
    const altoFila = Math.max(...alturas) + 8;
    asegurarEspacio(altoFila);
    if (izq) dibujarCampo(page, MARGEN, y, izq.etiqueta, izq.valor || "—", anchoColCampo, fuente, fuenteBold);
    if (der) dibujarCampo(page, MARGEN + colAncho, y, der.etiqueta, der.valor || "—", anchoColCampo, fuente, fuenteBold);
    y -= altoFila;
  }
  y -= 2;

  if (datos.observaciones) {
    const altoTexto = envolverTexto(datos.observaciones, fuente, 10, anchoUtil).length * 13;
    asegurarEspacio(14 + altoTexto + 16);
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    y -= 14;
    envolverTexto(datos.observaciones, fuente, 10, anchoUtil).forEach((linea, i) => {
      page.drawText(linea, { x: MARGEN, y: y - i * 13, size: 10, font: fuente, color: TINTA });
    });
    y -= altoTexto + 16;
  }

  // Firma de referencia (quien recibió/autorizó en el sistema) + firmas
  // físicas. La firma digital (si existe) se embebe antes de reservar
  // espacio: su alto real varía según la imagen capturada (no siempre es
  // la misma proporción), y sin saberlo de antemano el pie de página podía
  // terminar encimado con la propia firma.
  const imagenFirma = datos.firmaDigitalPng ? await doc.embedPng(datos.firmaDigitalPng) : null;
  const anchoImgFirma = 220;
  const altoImgFirma = imagenFirma ? (imagenFirma.height / imagenFirma.width) * anchoImgFirma : 0;
  const altoBloqueFirma = imagenFirma ? 14 + altoImgFirma + 6 : 46;

  asegurarEspacio(24 + 28 + 60 + altoBloqueFirma + 24);
  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
  y -= 24;

  const etiquetaResponsable = datos.tipo === "entrada" ? "Recibió (sistema)" : "Autorizó (sistema)";
  page.drawText(etiquetaResponsable.toUpperCase(), { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
  page.drawText(datos.nombreEntregaRecibe ?? "Sin especificar", { x: MARGEN, y: y - 14, size: 10.5, font: fuente, color: TINTA });
  y -= 60;

  let yFinBloqueFirma: number;
  if (imagenFirma) {
    page.drawText("FIRMA DIGITAL REGISTRADA", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    const yImg = y - altoImgFirma - 6;
    page.drawImage(imagenFirma, { x: MARGEN, y: yImg, width: anchoImgFirma, height: altoImgFirma });
    yFinBloqueFirma = yImg;
  } else {
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
    yFinBloqueFirma = y - 32;
  }

  // El pie normalmente va pegado al margen inferior de la página, pero si
  // la firma (sobre todo la digital, de alto variable) llega más abajo de
  // ese punto, el pie se recorre debajo de ella en vez de encimarse.
  page.drawText(`Generado automáticamente · ${new Date().toLocaleString("es-MX")}`, {
    x: MARGEN,
    y: Math.min(MARGEN - 20, yFinBloqueFirma - 16),
    size: 7.5,
    font: fuente,
    color: TINTA_SUAVE,
  });

  return doc.save();
}

// ---------------------------------------------------------------
// Comprobante consolidado — una entrada/salida con varios productos y/o
// clientes (embarque o viaje consolidado) genera un solo movimiento por
// producto en el sistema (ver EntradaLineaCard/SalidaLineaCard), pero el
// papel que se entrega/firma debe ser uno solo, con todos los productos
// listados — no uno por cada uno.
// ---------------------------------------------------------------

export type LineaConsolidado = {
  codigoLote: string;
  cliente: string;
  producto: string;
  sku: string;
  bl: string;
  piezas: number;
  tarimas: number;
  ubicacion: string;
};

export interface DatosComprobanteConsolidado {
  tipo: "entrada" | "salida";
  camposEncabezado: CampoComprobante[]; // Fecha/Hora/Contenedor (entrada) o Fecha/Hora/Destino/Transportista/Placas/Operador (salida)
  observaciones: string | null;
  nombreEntregaRecibe: string | null;
  firmaDigitalPng?: Uint8Array | null;
  lineas: LineaConsolidado[];
}

const ANCHO_PAGINA_H = 792; // carta horizontal — más columnas que un comprobante normal
const ALTO_PAGINA_H = 612;
const COLUMNAS_CONSOLIDADO: { encabezado: string; ancho: number; valor: (l: LineaConsolidado) => string }[] = [
  { encabezado: "Lote", ancho: 1, valor: (l) => l.codigoLote },
  { encabezado: "Cliente", ancho: 1.1, valor: (l) => l.cliente },
  { encabezado: "Producto", ancho: 1.9, valor: (l) => l.producto },
  { encabezado: "SKU", ancho: 0.9, valor: (l) => l.sku },
  { encabezado: "BL", ancho: 1, valor: (l) => l.bl },
  { encabezado: "Piezas", ancho: 0.7, valor: (l) => formatearNumero(l.piezas) },
  { encabezado: "Tarimas", ancho: 0.7, valor: (l) => formatearNumero(l.tarimas) },
  { encabezado: "Ubicación", ancho: 0.8, valor: (l) => l.ubicacion },
];

export async function generarComprobanteConsolidado(
  datosOriginales: DatosComprobanteConsolidado
): Promise<Uint8Array> {
  const datos: DatosComprobanteConsolidado = {
    ...datosOriginales,
    camposEncabezado: datosOriginales.camposEncabezado.map((c) => ({
      etiqueta: limpiarTextoPdf(c.etiqueta),
      valor: limpiarTextoPdf(c.valor),
    })),
    observaciones: datosOriginales.observaciones ? limpiarTextoPdf(datosOriginales.observaciones) : null,
    nombreEntregaRecibe: datosOriginales.nombreEntregaRecibe
      ? limpiarTextoPdf(datosOriginales.nombreEntregaRecibe)
      : null,
    lineas: datosOriginales.lineas.map((l) => ({
      ...l,
      codigoLote: limpiarTextoPdf(l.codigoLote),
      cliente: limpiarTextoPdf(l.cliente),
      producto: limpiarTextoPdf(l.producto),
      sku: limpiarTextoPdf(l.sku),
      bl: limpiarTextoPdf(l.bl),
      ubicacion: limpiarTextoPdf(l.ubicacion),
    })),
  };

  const anchoUtil = ANCHO_PAGINA_H - MARGEN * 2;
  const sumaProporciones = COLUMNAS_CONSOLIDADO.reduce((s, c) => s + c.ancho, 0);
  const anchosCol = COLUMNAS_CONSOLIDADO.map((c) => (c.ancho / sumaProporciones) * anchoUtil);

  const doc = await PDFDocument.create();
  const fuente = await doc.embedFont(StandardFonts.Helvetica);
  const fuenteBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // `nuevaPagina()` es quien crea cada página (la primera incluida) — no
  // se crea una aquí para no dejar una página en blanco antes de la real.
  // (el "!" le dice a TS que sí se asigna antes de usarse, en nuevaPagina)
  let page!: PDFPage;
  let y = 0;

  const titulo = datos.tipo === "entrada" ? "Comprobante de recibo (consolidado)" : "Comprobante de entrega (consolidado)";
  const totalProductos = datos.lineas.length;
  const subtitulo = `${datos.tipo === "entrada" ? "Prueba de recibo" : "Prueba de entrega"} de mercancía · ${totalProductos} producto${totalProductos === 1 ? "" : "s"}`;

  function dibujarEncabezadoTabla() {
    page.drawRectangle({ x: MARGEN, y: y - 4, width: anchoUtil, height: 20, color: ACENTO_SUAVE });
    let x = MARGEN + 4;
    COLUMNAS_CONSOLIDADO.forEach((c, i) => {
      page.drawText(c.encabezado.toUpperCase(), { x, y, size: 8, font: fuenteBold, color: TINTA });
      x += anchosCol[i];
    });
    y -= 20;
  }

  function nuevaPagina(conEncabezadoCompleto: boolean) {
    page = doc.addPage([ANCHO_PAGINA_H, ALTO_PAGINA_H]);
    y = ALTO_PAGINA_H - MARGEN;

    page.drawText("WMS — Resguardo & Control", { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
    y -= 22;

    if (conEncabezadoCompleto) {
      page.drawText(titulo, { x: MARGEN, y, size: 18, font: fuenteBold, color: TINTA });
      y -= 16;
      page.drawText(subtitulo, { x: MARGEN, y, size: 9.5, font: fuente, color: TINTA_SUAVE });
      y -= 20;
      page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
      y -= 18;

      const colsEncabezado = 4;
      const colAnchoEnc = anchoUtil / colsEncabezado;
      const anchoValorEnc = colAnchoEnc - 12;
      for (let fila = 0; fila < Math.ceil(datos.camposEncabezado.length / colsEncabezado); fila++) {
        const items = datos.camposEncabezado.slice(fila * colsEncabezado, fila * colsEncabezado + colsEncabezado);
        const altoFila = Math.max(...items.map((c) => altoCampo(c.valor || "—", anchoValorEnc, fuente))) + 8;
        items.forEach((c, i) => {
          dibujarCampo(page, MARGEN + i * colAnchoEnc, y, c.etiqueta, c.valor || "—", anchoValorEnc, fuente, fuenteBold);
        });
        y -= altoFila;
      }
      y -= 8;
    } else {
      page.drawText(`${titulo} (continuación)`, { x: MARGEN, y, size: 12, font: fuenteBold, color: TINTA });
      y -= 22;
    }

    dibujarEncabezadoTabla();
  }

  // Para cuando solo falta espacio para observaciones/firma, no para más
  // filas — no tiene caso repetir el encabezado de la tabla ahí.
  function nuevaPaginaSoloPie() {
    page = doc.addPage([ANCHO_PAGINA_H, ALTO_PAGINA_H]);
    y = ALTO_PAGINA_H - MARGEN;
    page.drawText("WMS — Resguardo & Control", { x: MARGEN, y, size: 10, font: fuente, color: TINTA_SUAVE });
    y -= 22;
    page.drawText(`${titulo} (continuación)`, { x: MARGEN, y, size: 12, font: fuenteBold, color: TINTA });
    y -= 26;
  }

  nuevaPagina(true);

  const ESPACIO_ENTRE_FILAS_TABLA = 16; // separación entre el pie de una fila y el inicio de la siguiente

  datos.lineas.forEach((linea) => {
    const numLineas = COLUMNAS_CONSOLIDADO.map(
      (c, i) => envolverTexto(c.valor(linea) || "—", fuente, 9, anchosCol[i] - 8).length
    );
    const altoTexto = Math.max(...numLineas, 1) * INTERLINEA_CAMPO;
    const altoFila = altoTexto + ESPACIO_ENTRE_FILAS_TABLA;

    if (y - altoFila < MARGEN) {
      nuevaPagina(false);
    }

    let x = MARGEN + 4;
    COLUMNAS_CONSOLIDADO.forEach((c, i) => {
      const lineas = envolverTexto(c.valor(linea) || "—", fuente, 9, anchosCol[i] - 8);
      lineas.forEach((texto, li) => {
        page.drawText(texto, { x, y: y - li * INTERLINEA_CAMPO, size: 9, font: fuente, color: TINTA });
      });
      x += anchosCol[i];
    });
    // La línea separadora va justo debajo del texto de esta fila (no a
    // medio camino del espacio entre filas), para que nunca quede pegada
    // — ni mucho menos encimada — con la primera línea de la fila
    // siguiente cuando una celda se envuelve en varios renglones.
    page.drawLine({
      start: { x: MARGEN, y: y - altoTexto - 4 },
      end: { x: MARGEN + anchoUtil, y: y - altoTexto - 4 },
      thickness: 0.5,
      color: LINEA,
    });
    y -= altoFila;
  });

  // La firma digital (si existe) se embebe antes de calcular cuánto
  // espacio reservar: su alto real varía según la imagen capturada, y sin
  // saberlo de antemano el pie de la firma podía calcular mal cuánto
  // necesitaba y terminar encimado con el texto "Generado automáticamente".
  const imagenFirma = datos.firmaDigitalPng ? await doc.embedPng(datos.firmaDigitalPng) : null;
  const anchoImgFirma = 220;
  const altoImgFirma = imagenFirma ? (imagenFirma.height / imagenFirma.width) * anchoImgFirma : 0;
  const altoBloqueFirma = imagenFirma ? 14 + altoImgFirma + 6 : 46;
  const altoPieCompleto = 14 + (datos.observaciones ? 14 + envolverTexto(datos.observaciones, fuente, 10, anchoUtil).length * 13 + 16 : 0) + 6 + 24 + 28 + 60 + altoBloqueFirma;

  // Observaciones + firma van después de la tabla, en la misma página si
  // alcanza el espacio, o si no en una nueva.
  if (y < MARGEN + altoPieCompleto) {
    nuevaPaginaSoloPie();
  }
  y -= 14;

  if (datos.observaciones) {
    const lineasObs = envolverTexto(datos.observaciones, fuente, 10, anchoUtil);
    const altoObs = lineasObs.length * 13;
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    y -= 14;
    lineasObs.forEach((linea, i) => {
      page.drawText(linea, { x: MARGEN, y: y - i * 13, size: 10, font: fuente, color: TINTA });
    });
    y -= altoObs + 16;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
  y -= 24;

  const etiquetaResponsable = datos.tipo === "entrada" ? "Recibió (sistema)" : "Autorizó (sistema)";
  page.drawText(etiquetaResponsable.toUpperCase(), { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
  page.drawText(datos.nombreEntregaRecibe ?? "Sin especificar", { x: MARGEN, y: y - 14, size: 10.5, font: fuente, color: TINTA });
  y -= 60;

  let yFinBloqueFirma: number;
  if (imagenFirma) {
    page.drawText("FIRMA DIGITAL REGISTRADA", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    const yImg = y - altoImgFirma - 6;
    page.drawImage(imagenFirma, { x: MARGEN, y: yImg, width: anchoImgFirma, height: altoImgFirma });
    yFinBloqueFirma = yImg;
  } else {
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
    yFinBloqueFirma = y - 32;
  }

  // El pie normalmente va pegado al margen inferior de la página, pero si
  // la firma llega más abajo de ese punto, el pie se recorre debajo de
  // ella en vez de encimarse.
  page.drawText(`Generado automáticamente · ${new Date().toLocaleString("es-MX")}`, {
    x: MARGEN,
    y: Math.min(MARGEN - 20, yFinBloqueFirma - 16),
    size: 7.5,
    font: fuente,
    color: TINTA_SUAVE,
  });

  return doc.save();
}
