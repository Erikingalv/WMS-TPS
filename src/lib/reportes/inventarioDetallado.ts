import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Lote, Producto, TarimaParcial, Ubicacion, Usuario } from "@/lib/types/database";
import { diasDesde, formatearFecha } from "@/lib/utils/dates";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type FilaInventarioTarima = {
  lote_id: string;
  codigo_lote: string;
  numero_tarima: number | null; // físico, si el lote tiene rango capturado
  identificador_interno: number | null; // interno (1..N), cuando no hay número físico
  es_parcial: boolean;
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

type Slot = {
  numero_tarima: number | null;
  identificador_interno: number;
  piezas: number;
  esParcial: boolean;
};

// Arma la lista completa de tarimas (1..tarimas_inicial) con las que llegó
// el lote, con número físico si el rango capturado cuadra exactamente con
// tarimas_inicial, o si no un identificador interno (siempre existe). Las
// excepciones en `tarimasParciales` se asignan primero (por número físico
// si lo traen, o si no a las últimas posiciones — así, para lotes sin
// seguimiento físico, son las últimas en considerarse "salidas" más
// adelante). El resto reparte parejo el remanente de piezas.
function construirSlots(
  lote: Pick<Lote, "tarima_desde" | "tarima_hasta" | "tarimas_inicial" | "piezas_inicial">,
  tarimasParciales: TarimaParcial[]
): { slots: Slot[]; usaFisico: boolean } {
  const numerosFisicos = rangoANumeros(lote.tarima_desde, lote.tarima_hasta);
  const usaFisico = numerosFisicos.length === lote.tarimas_inicial;

  const slots: Slot[] = [];
  for (let i = 0; i < lote.tarimas_inicial; i++) {
    slots.push({
      numero_tarima: usaFisico ? lote.tarima_desde! + i : null,
      identificador_interno: i + 1,
      piezas: 0,
      esParcial: false,
    });
  }

  const asignados = new Set<number>(); // índices en `slots`
  const excepcionesConNumero = tarimasParciales.filter((t) => t.numero_tarima != null);
  const excepcionesSinNumero = tarimasParciales.filter((t) => t.numero_tarima == null);

  for (const exc of excepcionesConNumero) {
    const idx = slots.findIndex((s) => s.numero_tarima === exc.numero_tarima);
    if (idx === -1) {
      // No hay ninguna tarima física con ese número (el lote cayó a modo
      // "sin seguimiento físico", o el número no cuadra con el rango
      // capturado) — las piezas capturadas NO se descartan, se asignan
      // igual que una excepción sin número para no perder el dato.
      excepcionesSinNumero.push(exc);
      continue;
    }
    slots[idx].piezas = exc.piezas;
    slots[idx].esParcial = true;
    asignados.add(idx);
  }

  // Las excepciones sin número (o todas, si el lote no tiene rango físico)
  // se asignan a las últimas posiciones libres.
  for (let i = slots.length - 1; i >= 0 && excepcionesSinNumero.length > 0; i--) {
    if (asignados.has(i)) continue;
    const exc = excepcionesSinNumero.shift()!;
    slots[i].piezas = exc.piezas;
    slots[i].esParcial = true;
    asignados.add(i);
  }

  const piezasAsignadas = slots.reduce((s, slot) => s + (slot.esParcial ? slot.piezas : 0), 0);
  const restantesIdx = slots.map((_, i) => i).filter((i) => !asignados.has(i));
  const piezasRestantes = Math.max(0, lote.piezas_inicial - piezasAsignadas);
  const tarimasRestantes = restantesIdx.length;

  if (tarimasRestantes > 0) {
    const base = Math.floor(piezasRestantes / tarimasRestantes);
    const residuo = piezasRestantes - base * tarimasRestantes;
    restantesIdx.forEach((idx, pos) => {
      slots[idx].piezas = base + (pos < residuo ? 1 : 0);
    });
  }

  return { slots, usaFisico };
}

// Inventario desglosado por tarima individual (como el Excel de control:
// una fila por tarima física o, si el lote no tiene seguimiento físico
// (ej. no se capturó rango de tarimas), por identificador interno — nunca
// se agrupa todo en una sola fila). Reconstruye qué tarimas siguen
// disponibles restando, del total con el que llegó el lote, las que ya
// salieron (por número exacto si la salida las capturó así; si el lote no
// tiene número físico, solo se sabe cuántas salieron, no cuáles, así que
// se van descontando desde el identificador interno más bajo).
//
// El total de piezas mostrado siempre se ajusta para cuadrar exacto con la
// existencia real (`inventario_lote_ubicacion`): una salida "parcial" solo
// se documenta como nota de exactitud (ver registrar_salida) y no mueve
// tarimas específicas del lote, así que el desglose por tarima puede
// necesitar un ajuste menor para no perder ni inventar piezas.
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
          | "codigo_lote"
          | "fecha_ingreso"
          | "producto_id"
          | "estado"
          | "tarima_desde"
          | "tarima_hasta"
          | "tarimas_inicial"
          | "piezas_inicial"
          | "tarimas_parciales"
        > & {
          productos: (Pick<Producto, "nombre" | "sku" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
        })
      | null;
    ubicaciones: Pick<Ubicacion, "codigo"> | null;
  };

  const { data: existenciasRaw } = await supabase
    .from("inventario_lote_ubicacion")
    .select(
      "lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas, lotes(codigo_lote, fecha_ingreso, producto_id, estado, tarima_desde, tarima_hasta, tarimas_inicial, piezas_inicial, tarimas_parciales, productos(nombre, sku, cliente_id, clientes(nombre))), ubicaciones(codigo)"
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

  type SalidaOrigen = { lote_id: string; cantidad_tarimas: number; tarima_desde: number | null; tarima_hasta: number | null; tarima_numeros: number[] | null };
  const { data: salidasRaw } = await supabase
    .from("salidas")
    .select("lote_id, cantidad_tarimas, tarima_desde, tarima_hasta, tarima_numeros")
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

    const { slots, usaFisico } = construirSlots(lote, (lote.tarimas_parciales ?? []) as TarimaParcial[]);

    let disponibles: Slot[];
    if (usaFisico) {
      const salidos = new Set<number>();
      for (const s of salidasPorLote.get(e.lote_id) ?? []) {
        const numeros = s.tarima_numeros && s.tarima_numeros.length > 0 ? s.tarima_numeros : rangoANumeros(s.tarima_desde, s.tarima_hasta);
        numeros.forEach((n) => salidos.add(n));
      }
      disponibles = slots.filter((s) => s.numero_tarima == null || !salidos.has(s.numero_tarima));
    } else {
      const totalSalido = (salidasPorLote.get(e.lote_id) ?? []).reduce((s, sal) => s + sal.cantidad_tarimas, 0);
      disponibles = slots.slice(Math.min(totalSalido, slots.length));
    }

    if (disponibles.length === 0) continue;

    // Ajuste para que el desglose siempre sume exacto con la existencia
    // real (una salida parcial documentada como nota no mueve piezas de
    // una tarima específica del desglose).
    const sumaDisponibles = disponibles.reduce((s, d) => s + d.piezas, 0);
    const diferencia = e.cantidad_piezas - sumaDisponibles;
    if (diferencia !== 0) {
      const ultimo = disponibles[disponibles.length - 1];
      disponibles = [
        ...disponibles.slice(0, -1),
        { ...ultimo, piezas: Math.max(0, ultimo.piezas + diferencia) },
      ];
    }

    for (const slot of disponibles) {
      filas.push({
        ...base,
        numero_tarima: slot.numero_tarima,
        identificador_interno: slot.numero_tarima == null ? slot.identificador_interno : null,
        es_parcial: slot.esParcial,
        piezas: slot.piezas,
      });
    }
  }

  // De mayor a menor antigüedad, y dentro del mismo lote por número de tarima.
  return filas.sort(
    (a, b) =>
      diasDesde(b.fecha_ingreso) - diasDesde(a.fecha_ingreso) ||
      (a.numero_tarima ?? a.identificador_interno ?? 0) - (b.numero_tarima ?? b.identificador_interno ?? 0)
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
  numero_tarima: {
    label: "Número de tarima",
    ancho: 1,
    valor: (f) => (f.numero_tarima != null ? String(f.numero_tarima) : f.identificador_interno != null ? `Interno #${f.identificador_interno}` : "—"),
  },
  parcial: { label: "Parcial", ancho: 0.8, valor: (f) => (f.es_parcial ? "Sí" : "No") },
  contenedor: { label: "Contenedor", ancho: 1.2, valor: (f) => f.numero_contenedor ?? "—" },
  bl: { label: "BL/Referencia", ancho: 1.2, valor: (f) => f.numero_bl ?? "—" },
  ubicacion: { label: "Ubicación", ancho: 1, valor: (f) => f.ubicacion },
  estado: { label: "Estatus", ancho: 0.9, valor: () => "DISPONIBLE" },
  creado_por: { label: "Creado por", ancho: 1.2, valor: (f) => f.creado_por ?? "—" },
  codigo_lote: { label: "Lote (sistema)", ancho: 1.3, valor: (f) => f.codigo_lote },
  dias: { label: "Días almacenado", ancho: 0.9, valor: (f) => String(f.dias) },
};

export const DEFAULT_COLS_INVENTARIO = Object.keys(COLUMNAS_INVENTARIO);
