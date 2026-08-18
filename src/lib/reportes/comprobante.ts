import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { limpiarTextoPdf } from "@/lib/utils/pdfTexto";

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

  if (datos.firmaDigitalPng) {
    const imagen = await doc.embedPng(datos.firmaDigitalPng);
    const anchoImg = 220;
    const altoImg = (imagen.height / imagen.width) * anchoImg;
    page.drawText("FIRMA DIGITAL REGISTRADA", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    page.drawImage(imagen, { x: MARGEN, y: y - altoImg - 6, width: anchoImg, height: altoImg });
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
  }

  page.drawText(
    `Generado automáticamente · ${new Date().toLocaleString("es-MX")}`,
    { x: MARGEN, y: MARGEN - 20, size: 7.5, font: fuente, color: TINTA_SUAVE }
  );

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
  piezas: number;
  tarimas: number;
  ubicacion: string;
};

export interface DatosComprobanteConsolidado {
  tipo: "entrada" | "salida";
  camposEncabezado: CampoComprobante[]; // Fecha/Hora/Contenedor/BL (entrada) o Fecha/Hora/Destino/Transportista/Placas/Operador (salida)
  observaciones: string | null;
  nombreEntregaRecibe: string | null;
  firmaDigitalPng?: Uint8Array | null;
  lineas: LineaConsolidado[];
}

const ANCHO_PAGINA_H = 792; // carta horizontal — más columnas que un comprobante normal
const ALTO_PAGINA_H = 612;
const ALTO_RENGLON_TABLA = 20;
const ALTO_MIN_PIE = 170; // espacio que necesitan observaciones + firma

const COLUMNAS_CONSOLIDADO: { encabezado: string; ancho: number; valor: (l: LineaConsolidado) => string }[] = [
  { encabezado: "Lote", ancho: 1.1, valor: (l) => l.codigoLote },
  { encabezado: "Cliente", ancho: 1.3, valor: (l) => l.cliente },
  { encabezado: "Producto", ancho: 2.3, valor: (l) => l.producto },
  { encabezado: "SKU", ancho: 1, valor: (l) => l.sku },
  { encabezado: "Piezas", ancho: 0.7, valor: (l) => String(l.piezas) },
  { encabezado: "Tarimas", ancho: 0.7, valor: (l) => String(l.tarimas) },
  { encabezado: "Ubicación", ancho: 0.9, valor: (l) => l.ubicacion },
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
  let page!: ReturnType<typeof doc.addPage>;
  let y = 0;

  const titulo = datos.tipo === "entrada" ? "Comprobante de recibo (consolidado)" : "Comprobante de entrega (consolidado)";
  const totalProductos = datos.lineas.length;
  const subtitulo = `${datos.tipo === "entrada" ? "Prueba de recibo" : "Prueba de entrega"} de mercancía · ${totalProductos} producto${totalProductos === 1 ? "" : "s"}`;

  function dibujarEncabezadoTabla() {
    page.drawRectangle({ x: MARGEN, y: y - 4, width: anchoUtil, height: ALTO_RENGLON_TABLA, color: ACENTO_SUAVE });
    let x = MARGEN + 4;
    COLUMNAS_CONSOLIDADO.forEach((c, i) => {
      page.drawText(c.encabezado.toUpperCase(), { x, y, size: 8, font: fuenteBold, color: TINTA });
      x += anchosCol[i];
    });
    y -= ALTO_RENGLON_TABLA;
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
      datos.camposEncabezado.forEach((c, i) => {
        const col = i % colsEncabezado;
        const fila = Math.floor(i / colsEncabezado);
        const x = MARGEN + col * colAnchoEnc;
        const yy = y - fila * 30;
        page.drawText(c.etiqueta.toUpperCase(), { x, y: yy, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
        page.drawText(c.valor || "—", { x, y: yy - 13, size: 10.5, font: fuente, color: TINTA, maxWidth: colAnchoEnc - 12 });
      });
      const filasEnc = Math.ceil(datos.camposEncabezado.length / colsEncabezado);
      y -= filasEnc * 30 + 16;
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

  datos.lineas.forEach((linea) => {
    if (y < MARGEN + ALTO_RENGLON_TABLA) {
      nuevaPagina(false);
    }
    let x = MARGEN + 4;
    COLUMNAS_CONSOLIDADO.forEach((c, i) => {
      const texto = c.valor(linea) || "—";
      page.drawText(texto, { x, y, size: 9, font: fuente, color: TINTA, maxWidth: anchosCol[i] - 8 });
      x += anchosCol[i];
    });
    page.drawLine({
      start: { x: MARGEN, y: y - 4 },
      end: { x: MARGEN + anchoUtil, y: y - 4 },
      thickness: 0.5,
      color: LINEA,
    });
    y -= ALTO_RENGLON_TABLA;
  });

  // Observaciones + firma van después de la tabla, en la misma página si
  // alcanza el espacio, o si no en una nueva.
  if (y < MARGEN + ALTO_MIN_PIE) {
    nuevaPaginaSoloPie();
  }
  y -= 14;

  if (datos.observaciones) {
    page.drawText("OBSERVACIONES", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    y -= 14;
    page.drawText(datos.observaciones, { x: MARGEN, y, size: 10, font: fuente, color: TINTA, maxWidth: anchoUtil });
    y -= 30;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGEN, y }, end: { x: MARGEN + anchoUtil, y }, thickness: 1, color: LINEA });
  y -= 24;

  const etiquetaResponsable = datos.tipo === "entrada" ? "Recibió (sistema)" : "Autorizó (sistema)";
  page.drawText(etiquetaResponsable.toUpperCase(), { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
  page.drawText(datos.nombreEntregaRecibe ?? "Sin especificar", { x: MARGEN, y: y - 14, size: 10.5, font: fuente, color: TINTA });
  y -= 60;

  if (datos.firmaDigitalPng) {
    const imagen = await doc.embedPng(datos.firmaDigitalPng);
    const anchoImg = 220;
    const altoImg = (imagen.height / imagen.width) * anchoImg;
    page.drawText("FIRMA DIGITAL REGISTRADA", { x: MARGEN, y, size: 7.5, font: fuenteBold, color: TINTA_SUAVE });
    page.drawImage(imagen, { x: MARGEN, y: y - altoImg - 6, width: anchoImg, height: altoImg });
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
  }

  page.drawText(
    `Generado automáticamente · ${new Date().toLocaleString("es-MX")}`,
    { x: MARGEN, y: MARGEN - 20, size: 7.5, font: fuente, color: TINTA_SUAVE }
  );

  return doc.save();
}
