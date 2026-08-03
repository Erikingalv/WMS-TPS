import type { createClient } from "@/lib/supabase/server";
import type { Entrada, Lote, Ubicacion } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const CAMPOS_ENTRADA_ORIGEN = [
  "cajas_por_pallet",
  "cantidad_por_caja",
  "categoria_producto",
  "presentacion",
  "lote_1",
  "lote_2",
  "numero_contenedor",
  "numero_bl",
] as const;
type EntradaOrigen = Pick<Entrada, (typeof CAMPOS_ENTRADA_ORIGEN)[number]>;

export type ExistenciaDisponible = {
  lote_id: string;
  ubicacion_id: string;
  producto_id: string;
  codigo_lote: string;
  fecha_ingreso: string;
  ubicacion_codigo: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  tarima_desde: number | null;
  tarima_hasta: number | null;
} & EntradaOrigen;

type ExistenciaRaw = {
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  lotes:
    | (Pick<Lote, "codigo_lote" | "fecha_ingreso" | "producto_id" | "estado" | "tarima_desde" | "tarima_hasta"> & {
        entradas: EntradaOrigen[] | null;
      })
    | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

// Existencia por lote+ubicación ya neta de reservas activas — el "de verdad
// disponible" para salidas, movimientos internos o nuevas reservas. Único
// punto de esta cuenta: antes vivía duplicada en cada página y una de las
// copias se quedó desactualizada al agregar reservas (mostraba el bruto).
export async function obtenerExistenciasDisponibles(
  supabase: SupabaseServerClient
): Promise<ExistenciaDisponible[]> {
  const [{ data: existenciasRaw }, { data: reservasActivas }] = await Promise.all([
    supabase
      .from("inventario_lote_ubicacion")
      .select(
        `lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas,
         lotes(codigo_lote, fecha_ingreso, producto_id, estado, tarima_desde, tarima_hasta,
           entradas(${CAMPOS_ENTRADA_ORIGEN.join(", ")})),
         ubicaciones(codigo)`
      ),
    supabase
      .from("reservas")
      .select("lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas")
      .eq("estado", "activa"),
  ]);

  const reservado = new Map<string, { piezas: number; tarimas: number }>();
  (reservasActivas ?? []).forEach((r) => {
    const key = `${r.lote_id}:${r.ubicacion_id}`;
    const actual = reservado.get(key) ?? { piezas: 0, tarimas: 0 };
    reservado.set(key, {
      piezas: actual.piezas + r.cantidad_piezas,
      tarimas: actual.tarimas + r.cantidad_tarimas,
    });
  });

  return ((existenciasRaw ?? []) as unknown as ExistenciaRaw[])
    .filter((e) => e.lotes?.estado === "activo")
    .map((e) => {
      const key = `${e.lote_id}:${e.ubicacion_id}`;
      const r = reservado.get(key) ?? { piezas: 0, tarimas: 0 };
      const entradaOrigen = e.lotes!.entradas?.[0] ?? null;
      return {
        lote_id: e.lote_id,
        ubicacion_id: e.ubicacion_id,
        producto_id: e.lotes!.producto_id,
        codigo_lote: e.lotes!.codigo_lote,
        fecha_ingreso: e.lotes!.fecha_ingreso,
        ubicacion_codigo: e.ubicaciones?.codigo ?? "—",
        cantidad_piezas: e.cantidad_piezas - r.piezas,
        cantidad_tarimas: e.cantidad_tarimas - r.tarimas,
        tarima_desde: e.lotes!.tarima_desde,
        tarima_hasta: e.lotes!.tarima_hasta,
        cajas_por_pallet: entradaOrigen?.cajas_por_pallet ?? null,
        cantidad_por_caja: entradaOrigen?.cantidad_por_caja ?? null,
        categoria_producto: entradaOrigen?.categoria_producto ?? null,
        presentacion: entradaOrigen?.presentacion ?? null,
        lote_1: entradaOrigen?.lote_1 ?? null,
        lote_2: entradaOrigen?.lote_2 ?? null,
        numero_contenedor: entradaOrigen?.numero_contenedor ?? null,
        numero_bl: entradaOrigen?.numero_bl ?? null,
      };
    })
    .filter((e) => e.cantidad_piezas > 0 || e.cantidad_tarimas > 0);
}
