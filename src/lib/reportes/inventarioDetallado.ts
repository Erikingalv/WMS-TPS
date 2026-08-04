import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Lote, Producto, Ubicacion, Usuario } from "@/lib/types/database";
import { diasDesde, formatearFecha } from "@/lib/utils/dates";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type FilaInventarioTarima = {
  lote_id: string;
  codigo_lote: string;
  numero_tarima: number | null; // null si el lote no tiene rango capturado (no se pudo desglosar)
  piezas: number;
  fecha_ingreso: string;
  hora_carga_descarga: string | null;
  cliente: string;
  producto: string;
  sku: string;
  presentacion: string | null;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
  categoria_producto: string | null;
  lote_1: string | null;
  lote_2: string | null;
  numero_contenedor: string | null;
  numero_bl: string | null;
  ubicacion: string;
  estado_lote: string;
  creado_por: string | null;
  dias: number;
};

function rangoANumeros(desde: number | null, hasta: number | null): number[] {
  if (desde == null || hasta == null) return [];
  const out: number[] = [];
  for (let n = desde; n <= hasta; n++) out.push(n);
  return out;
}

// Inventario desglosado por tarima individual (como el Excel de control:
// una fila por tarima física, no una fila por lote). Reconstruye qué
// números de tarima siguen disponibles restando, del rango original con el
// que llegó el lote, los que ya salieron (por número exacto si la salida
// los capturó así, o por rango si no).
export async function obtenerInventarioDetallado(
  supabase: SupabaseServerClient,
  { clienteId, desde, hasta }: { clienteId: string | null; desde: string | null; hasta: string | null }
): Promise<FilaInventarioTarima[]> {
  type ExistenciaRaw = {
    lote_id: string;
    ubicacion_id: string;
    cantidad_piezas: number;
    cantidad_tarimas: number;
    lotes:
      | (Pick<
          Lote,
          "codigo_lote" | "fecha_ingreso" | "producto_id" | "estado" | "tarima_desde" | "tarima_hasta" | "tarimas_inicial"
        > & {
          productos: (Pick<Producto, "nombre" | "sku" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
        })
      | null;
    ubicaciones: Pick<Ubicacion, "codigo"> | null;
  };

  const { data: existenciasRaw } = await supabase
    .from("inventario_lote_ubicacion")
    .select(
      "lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas, lotes(codigo_lote, fecha_ingreso, producto_id, estado, tarima_desde, tarima_hasta, tarimas_inicial, productos(nombre, sku, cliente_id, clientes(nombre))), ubicaciones(codigo)"
    )
    .or("cantidad_piezas.gt.0,cantidad_tarimas.gt.0");

  let existencias = (existenciasRaw ?? []) as unknown as ExistenciaRaw[];
  existencias = existencias.filter((e) => e.lotes != null);
  if (desde) existencias = existencias.filter((e) => e.lotes!.fecha_ingreso >= `${desde}T00:00:00`);
  if (hasta) existencias = existencias.filter((e) => e.lotes!.fecha_ingreso <= `${hasta}T23:59:59`);
  if (clienteId) existencias = existencias.filter((e) => e.lotes?.productos?.cliente_id === clienteId);

  if (existencias.length === 0) return [];

  const loteIds = existencias.map((e) => e.lote_id);

  type EntradaOrigen = {
    lote_id: string;
    fecha: string;
    hora_carga_descarga: string;
    presentacion: string | null;
    cajas_por_pallet: number | null;
    cantidad_por_caja: number | null;
    categoria_producto: string | null;
    lote_1: string | null;
    lote_2: string | null;
    numero_contenedor: string | null;
    numero_bl: string | null;
    recibio: Pick<Usuario, "nombre"> | null;
  };
  const { data: entradasRaw } = await supabase
    .from("entradas")
    .select(
      "lote_id, fecha, hora_carga_descarga, presentacion, cajas_por_pallet, cantidad_por_caja, categoria_producto, lote_1, lote_2, numero_contenedor, numero_bl, recibio:recibio_usuario_id(nombre)"
    )
    .in("lote_id", loteIds);
  const entradaPorLote = new Map(
    ((entradasRaw ?? []) as unknown as EntradaOrigen[]).map((e) => [e.lote_id, e])
  );

  type SalidaOrigen = { lote_id: string; tarima_desde: number | null; tarima_hasta: number | null; tarima_numeros: number[] | null };
  const { data: salidasRaw } = await supabase
    .from("salidas")
    .select("lote_id, tarima_desde, tarima_hasta, tarima_numeros")
    .in("lote_id", loteIds);
  const salidasPorLote = new Map<string, SalidaOrigen[]>();
  ((salidasRaw ?? []) as unknown as SalidaOrigen[]).forEach((s) => {
    const lista = salidasPorLote.get(s.lote_id) ?? [];
    lista.push(s);
    salidasPorLote.set(s.lote_id, lista);
  });

  const filas: FilaInventarioTarima[] = [];

  for (const e of existencias) {
    const lote = e.lotes!;
    const entrada = entradaPorLote.get(e.lote_id) ?? null;
    const dias = diasDesde(lote.fecha_ingreso);
    const base = {
      lote_id: e.lote_id,
      codigo_lote: lote.codigo_lote,
      fecha_ingreso: lote.fecha_ingreso,
      hora_carga_descarga: entrada?.hora_carga_descarga ?? null,
      cliente: lote.productos?.clientes?.nombre ?? "—",
      producto: lote.productos?.nombre ?? "—",
      sku: lote.productos?.sku ?? "—",
      presentacion: entrada?.presentacion ?? null,
      cajas_por_pallet: entrada?.cajas_por_pallet ?? null,
      cantidad_por_caja: entrada?.cantidad_por_caja ?? null,
      categoria_producto: entrada?.categoria_producto ?? null,
      lote_1: entrada?.lote_1 ?? null,
      lote_2: entrada?.lote_2 ?? null,
      numero_contenedor: entrada?.numero_contenedor ?? null,
      numero_bl: entrada?.numero_bl ?? null,
      ubicacion: e.ubicaciones?.codigo ?? "—",
      estado_lote: lote.estado === "agotado" ? "Agotado" : "Activo",
      creado_por: entrada?.recibio?.nombre ?? null,
      dias,
    };

    const numerosOriginales = rangoANumeros(lote.tarima_desde, lote.tarima_hasta);
    if (numerosOriginales.length !== lote.tarimas_inicial) {
      // Sin rango capturado, o el rango no cuadra con las tarimas reales del
      // lote (dato incompleto/mal capturado): no se puede desglosar por
      // tarima individual sin inventar números, se deja una sola fila
      // agregada con la existencia actual completa para no perder piezas.
      filas.push({ ...base, numero_tarima: null, piezas: e.cantidad_piezas });
      continue;
    }

    const salidos = new Set<number>();
    for (const s of salidasPorLote.get(e.lote_id) ?? []) {
      const numeros = s.tarima_numeros && s.tarima_numeros.length > 0 ? s.tarima_numeros : rangoANumeros(s.tarima_desde, s.tarima_hasta);
      numeros.forEach((n) => salidos.add(n));
    }
    const disponibles = numerosOriginales.filter((n) => !salidos.has(n));

    if (disponibles.length === 0) continue; // no debería pasar (ya viene filtrado por existencia > 0)

    const piezasPorTarima = e.cantidad_tarimas > 0 ? Math.round(e.cantidad_piezas / e.cantidad_tarimas) : 0;
    for (const numero of disponibles) {
      filas.push({ ...base, numero_tarima: numero, piezas: piezasPorTarima });
    }
  }

  // De mayor a menor antigüedad, y dentro del mismo lote por número de tarima.
  return filas.sort(
    (a, b) => diasDesde(b.fecha_ingreso) - diasDesde(a.fecha_ingreso) || (a.numero_tarima ?? 0) - (b.numero_tarima ?? 0)
  );
}

export const COLUMNAS_INVENTARIO: Record<
  string,
  { label: string; ancho: number; valor: (f: FilaInventarioTarima) => string }
> = {
  fecha: { label: "Fecha de entrada", ancho: 1.3, valor: (f) => formatearFecha(f.fecha_ingreso) },
  hora: { label: "Hora de descarga", ancho: 1.1, valor: (f) => f.hora_carga_descarga?.slice(0, 5) ?? "—" },
  cliente: { label: "Cliente", ancho: 1.5, valor: (f) => f.cliente },
  producto: { label: "Producto", ancho: 2, valor: (f) => f.producto },
  presentacion: { label: "Presentación", ancho: 1.1, valor: (f) => f.presentacion ?? "—" },
  piezas: { label: "Piezas", ancho: 0.9, valor: (f) => String(f.piezas) },
  cajas_pallet: { label: "Cajas/pallet", ancho: 0.9, valor: (f) => (f.cajas_por_pallet != null ? String(f.cajas_por_pallet) : "—") },
  cant_caja: { label: "Cant./caja", ancho: 0.9, valor: (f) => (f.cantidad_por_caja != null ? String(f.cantidad_por_caja) : "—") },
  categoria: { label: "Categoría", ancho: 1.3, valor: (f) => f.categoria_producto ?? "—" },
  sku: { label: "SKU", ancho: 1.1, valor: (f) => f.sku },
  lote_2: { label: "Lote SAP", ancho: 1.1, valor: (f) => f.lote_2 ?? "—" },
  lote_1: { label: "Lote", ancho: 1.1, valor: (f) => f.lote_1 ?? "—" },
  numero_tarima: { label: "Número de tarima", ancho: 1, valor: (f) => (f.numero_tarima != null ? String(f.numero_tarima) : "—") },
  contenedor: { label: "Contenedor", ancho: 1.2, valor: (f) => f.numero_contenedor ?? "—" },
  bl: { label: "BL/Referencia", ancho: 1.2, valor: (f) => f.numero_bl ?? "—" },
  ubicacion: { label: "Ubicación", ancho: 1, valor: (f) => f.ubicacion },
  estado: { label: "Estatus", ancho: 0.9, valor: () => "DISPONIBLE" },
  creado_por: { label: "Creado por", ancho: 1.2, valor: (f) => f.creado_por ?? "—" },
  codigo_lote: { label: "Lote (sistema)", ancho: 1.3, valor: (f) => f.codigo_lote },
  dias: { label: "Días almacenado", ancho: 0.9, valor: (f) => String(f.dias) },
};

export const DEFAULT_COLS_INVENTARIO = Object.keys(COLUMNAS_INVENTARIO);
