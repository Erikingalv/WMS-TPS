import type { Cliente, Entrada, Lote, Producto, Salida, Ubicacion, Usuario } from "@/lib/types/database";
import { formatearFecha } from "@/lib/utils/dates";

// Columnas seleccionables para Entradas/Salidas — mismos apartados que el
// Excel de control que ya llevaba Erik, para que el reporte le sirva tal
// cual para facturar.
export type FilaEntrada = Entrada & {
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre" | "sku"> | null;
  lotes: Pick<Lote, "codigo_lote" | "estado"> | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
  recibio: Pick<Usuario, "nombre"> | null;
};

export type FilaSalida = Salida & {
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre" | "sku"> | null;
  lotes: Pick<Lote, "codigo_lote" | "estado"> | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
  autorizo: Pick<Usuario, "nombre"> | null;
};

export const COLUMNAS_ENTRADAS: Record<string, { label: string; ancho: number; valor: (f: FilaEntrada) => string }> = {
  fecha: { label: "Fecha", ancho: 1.5, valor: (f) => formatearFecha(f.fecha) },
  hora: { label: "Hora carga/descarga", ancho: 1.3, valor: (f) => f.hora_carga_descarga?.slice(0, 5) ?? "—" },
  cliente: { label: "Cliente", ancho: 1.8, valor: (f) => f.clientes?.nombre ?? "—" },
  producto: { label: "Producto", ancho: 2.2, valor: (f) => f.productos?.nombre ?? "—" },
  sku: { label: "SKU", ancho: 1.3, valor: (f) => f.productos?.sku ?? "—" },
  presentacion: { label: "Presentación", ancho: 1.3, valor: (f) => f.presentacion ?? "—" },
  piezas: { label: "Piezas", ancho: 1, valor: (f) => String(f.cantidad_piezas) },
  tarimas: { label: "Tarimas", ancho: 1, valor: (f) => String(f.cantidad_tarimas) },
  cajas_pallet: { label: "Cajas/pallet", ancho: 1, valor: (f) => (f.cajas_por_pallet != null ? String(f.cajas_por_pallet) : "—") },
  cant_caja: { label: "Cant./caja", ancho: 1, valor: (f) => (f.cantidad_por_caja != null ? String(f.cantidad_por_caja) : "—") },
  categoria: { label: "Categoría", ancho: 1.6, valor: (f) => f.categoria_producto ?? "—" },
  lote: { label: "Lote", ancho: 1.6, valor: (f) => f.lotes?.codigo_lote ?? "—" },
  lote_1: { label: "Lote 1", ancho: 1.4, valor: (f) => f.lote_1 ?? "—" },
  lote_2: { label: "Lote 2 (SAP)", ancho: 1.4, valor: (f) => f.lote_2 ?? "—" },
  contenedor: { label: "Contenedor", ancho: 1.5, valor: (f) => f.numero_contenedor ?? "—" },
  bl: { label: "BL/Referencia", ancho: 1.5, valor: (f) => f.numero_bl ?? "—" },
  ubicacion: { label: "Ubicación", ancho: 1.2, valor: (f) => f.ubicaciones?.codigo ?? "—" },
  peso: { label: "Peso (kg)", ancho: 1, valor: (f) => (f.peso_kg != null ? String(f.peso_kg) : "—") },
  recibio: { label: "Recibió", ancho: 1.5, valor: (f) => f.recibio?.nombre ?? "—" },
  estado_lote: { label: "Estado", ancho: 1, valor: (f) => (f.lotes?.estado === "agotado" ? "Agotado" : "Activo") },
  observaciones: { label: "Observaciones", ancho: 2, valor: (f) => f.observaciones ?? "—" },
};

export const COLUMNAS_SALIDAS: Record<string, { label: string; ancho: number; valor: (f: FilaSalida) => string }> = {
  fecha: { label: "Fecha", ancho: 1.5, valor: (f) => formatearFecha(f.fecha) },
  hora: { label: "Hora carga/descarga", ancho: 1.3, valor: (f) => f.hora_carga_descarga?.slice(0, 5) ?? "—" },
  cliente: { label: "Cliente", ancho: 1.8, valor: (f) => f.clientes?.nombre ?? "—" },
  producto: { label: "Producto", ancho: 2.2, valor: (f) => f.productos?.nombre ?? "—" },
  sku: { label: "SKU", ancho: 1.3, valor: (f) => f.productos?.sku ?? "—" },
  presentacion: { label: "Presentación", ancho: 1.3, valor: (f) => f.presentacion ?? "—" },
  piezas: { label: "Piezas", ancho: 1, valor: (f) => String(f.cantidad_piezas) },
  tarimas: { label: "Tarimas", ancho: 1, valor: (f) => String(f.cantidad_tarimas) },
  cajas_pallet: { label: "Cajas/pallet", ancho: 1, valor: (f) => (f.cajas_por_pallet != null ? String(f.cajas_por_pallet) : "—") },
  cant_caja: { label: "Cant./caja", ancho: 1, valor: (f) => (f.cantidad_por_caja != null ? String(f.cantidad_por_caja) : "—") },
  categoria: { label: "Categoría", ancho: 1.6, valor: (f) => f.categoria_producto ?? "—" },
  lote: { label: "Lote", ancho: 1.6, valor: (f) => f.lotes?.codigo_lote ?? "—" },
  lote_1: { label: "Lote 1", ancho: 1.4, valor: (f) => f.lote_1 ?? "—" },
  lote_2: { label: "Lote 2 (SAP)", ancho: 1.4, valor: (f) => f.lote_2 ?? "—" },
  contenedor: { label: "Contenedor", ancho: 1.5, valor: (f) => f.numero_contenedor ?? "—" },
  bl: { label: "BL/Referencia", ancho: 1.5, valor: (f) => f.numero_bl ?? "—" },
  ubicacion: { label: "Ubicación", ancho: 1.2, valor: (f) => f.ubicaciones?.codigo ?? "—" },
  destino: { label: "Destino", ancho: 1.6, valor: (f) => f.destino ?? "—" },
  transportista: { label: "Transportista", ancho: 1.6, valor: (f) => f.transportista ?? "—" },
  placas: { label: "Placas/unidad", ancho: 1.2, valor: (f) => f.placas ?? "—" },
  operador: { label: "Operador", ancho: 1.5, valor: (f) => f.operador ?? "—" },
  autorizo: { label: "Autorizó", ancho: 1.5, valor: (f) => f.autorizo?.nombre ?? "—" },
  estado_lote: { label: "Estado", ancho: 1, valor: (f) => (f.lotes?.estado === "agotado" ? "Agotado" : "Activo") },
  observaciones: { label: "Observaciones", ancho: 2, valor: (f) => f.observaciones ?? "—" },
};

export const DEFAULT_COLS_ENTRADAS = ["fecha", "hora", "cliente", "producto", "lote", "piezas", "tarimas", "ubicacion"];
export const DEFAULT_COLS_SALIDAS = ["fecha", "hora", "cliente", "producto", "lote", "piezas", "tarimas", "destino"];

export const COLUMNAS_DISPONIBLES = {
  entradas: Object.fromEntries(Object.entries(COLUMNAS_ENTRADAS).map(([k, v]) => [k, v.label])),
  salidas: Object.fromEntries(Object.entries(COLUMNAS_SALIDAS).map(([k, v]) => [k, v.label])),
};
