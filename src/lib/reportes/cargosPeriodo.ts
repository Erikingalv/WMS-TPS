import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Lote, Producto, TarifaEscalon } from "@/lib/types/database";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type CargoPeriodoLinea = {
  lote_id: string;
  codigo_lote: string;
  cliente: string;
  producto: string;
  dias_con_existencia: number;
  costo_almacenaje: number;
  tarimas_entrada: number;
  costo_maniobra_entrada: number;
  tarimas_salida: number;
  costo_maniobra_salida: number;
  costo_total: number;
  sin_tarifa: boolean;
};

function diasEntre(a: Date, b: Date): number {
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.round((b.getTime() - a.getTime()) / msPorDia);
}

// Cobro de un periodo [desde, hasta] elegido en el reporte: recorre día por
// día (no solo "a hoy" como calcular_cargo_lote) aplicando los escalones de
// la tarifa vigente del cliente según la antigüedad de cada lote ese día,
// más el cobro de maniobra por cada tarima que entró o salió dentro del
// rango. Se calcula en la app (no en SQL) para poder iterar rápido sin
// depender de migraciones.
export async function calcularCargosPeriodo(
  supabase: SupabaseServerClient,
  { desde, hasta, clienteId }: { desde: string; hasta: string; clienteId: string | null }
): Promise<CargoPeriodoLinea[]> {
  type LoteConProducto = Pick<
    Lote,
    "id" | "codigo_lote" | "fecha_ingreso" | "tarimas_inicial" | "producto_id"
  > & {
    productos: (Pick<Producto, "nombre" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
  };

  const { data: lotesRaw } = await supabase
    .from("lotes")
    .select("id, codigo_lote, fecha_ingreso, tarimas_inicial, producto_id, productos(nombre, cliente_id, clientes(nombre))")
    .lte("fecha_ingreso", `${hasta}T23:59:59`);
  let lotes = (lotesRaw ?? []) as unknown as LoteConProducto[];
  if (clienteId) lotes = lotes.filter((l) => l.productos?.cliente_id === clienteId);
  if (lotes.length === 0) return [];

  const loteIds = lotes.map((l) => l.id);
  const { data: salidasRaw } = await supabase
    .from("salidas")
    .select("lote_id, fecha, cantidad_tarimas")
    .in("lote_id", loteIds)
    .order("fecha");
  const salidasPorLote = new Map<string, { fecha: string; cantidad_tarimas: number }[]>();
  (salidasRaw ?? []).forEach((s) => {
    const lista = salidasPorLote.get(s.lote_id) ?? [];
    lista.push({ fecha: s.fecha, cantidad_tarimas: s.cantidad_tarimas });
    salidasPorLote.set(s.lote_id, lista);
  });

  const clienteIds = [...new Set(lotes.map((l) => l.productos?.cliente_id).filter(Boolean))] as string[];
  const { data: tarifasRaw } = await supabase
    .from("tarifas_almacenaje")
    .select("*")
    .in("cliente_id", clienteIds)
    .eq("activo", true);
  const { data: escalonesRaw } = await supabase
    .from("tarifa_escalones")
    .select("*")
    .in("tarifa_id", (tarifasRaw ?? []).map((t) => t.id));

  const tarifaPorCliente = new Map((tarifasRaw ?? []).map((t) => [t.cliente_id, t]));
  const escalonesPorTarifa = new Map<string, TarifaEscalon[]>();
  (escalonesRaw ?? []).forEach((e) => {
    const lista = escalonesPorTarifa.get(e.tarifa_id) ?? [];
    lista.push(e);
    escalonesPorTarifa.set(e.tarifa_id, lista);
  });

  const fechaDesde = new Date(`${desde}T00:00:00`);
  const fechaHasta = new Date(`${hasta}T00:00:00`);
  const lineas: CargoPeriodoLinea[] = [];

  for (const lote of lotes) {
    const clienteIdLote = lote.productos?.cliente_id;
    const tarifa = clienteIdLote ? tarifaPorCliente.get(clienteIdLote) : undefined;
    const escalones = tarifa ? (escalonesPorTarifa.get(tarifa.id) ?? []) : [];
    const salidas = salidasPorLote.get(lote.id) ?? [];
    const fechaIngreso = new Date(lote.fecha_ingreso);
    const fechaIngresoDia = new Date(
      fechaIngreso.getFullYear(),
      fechaIngreso.getMonth(),
      fechaIngreso.getDate()
    );

    let costoAlmacenaje = 0;
    let diasConExistencia = 0;

    for (let d = new Date(fechaDesde); d <= fechaHasta; d.setDate(d.getDate() + 1)) {
      if (d < fechaIngresoDia) continue;
      const salidasAntes = salidas
        .filter((s) => new Date(s.fecha) <= new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1))
        .reduce((sum, s) => sum + s.cantidad_tarimas, 0);
      const tarimasEseDia = lote.tarimas_inicial - salidasAntes;
      if (tarimasEseDia <= 0) continue;

      diasConExistencia += 1;
      const edad = diasEntre(fechaIngresoDia, d);
      const escalon = escalones.find(
        (e) => edad >= e.dia_inicio && (e.dia_fin == null || edad <= e.dia_fin)
      );
      if (escalon && !escalon.es_gratis) {
        costoAlmacenaje += tarimasEseDia * escalon.costo_por_tarima;
      }
    }

    let tarimasEntrada = 0;
    let costoManiobraEntrada = 0;
    if (fechaIngresoDia >= fechaDesde && fechaIngresoDia <= fechaHasta) {
      tarimasEntrada = lote.tarimas_inicial;
      costoManiobraEntrada = tarifa ? tarimasEntrada * tarifa.costo_maniobra_entrada : 0;
    }

    let tarimasSalida = 0;
    let costoManiobraSalida = 0;
    for (const s of salidas) {
      const fechaSalidaDia = new Date(s.fecha);
      const dia = new Date(fechaSalidaDia.getFullYear(), fechaSalidaDia.getMonth(), fechaSalidaDia.getDate());
      if (dia >= fechaDesde && dia <= fechaHasta) {
        tarimasSalida += s.cantidad_tarimas;
        costoManiobraSalida += tarifa ? s.cantidad_tarimas * tarifa.costo_maniobra_salida : 0;
      }
    }

    const costoTotal = costoAlmacenaje + costoManiobraEntrada + costoManiobraSalida;
    if (diasConExistencia === 0 && tarimasEntrada === 0 && tarimasSalida === 0) continue;

    lineas.push({
      lote_id: lote.id,
      codigo_lote: lote.codigo_lote,
      cliente: lote.productos?.clientes?.nombre ?? "—",
      producto: lote.productos?.nombre ?? "—",
      dias_con_existencia: diasConExistencia,
      costo_almacenaje: Math.round(costoAlmacenaje * 100) / 100,
      tarimas_entrada: tarimasEntrada,
      costo_maniobra_entrada: Math.round(costoManiobraEntrada * 100) / 100,
      tarimas_salida: tarimasSalida,
      costo_maniobra_salida: Math.round(costoManiobraSalida * 100) / 100,
      costo_total: Math.round(costoTotal * 100) / 100,
      sin_tarifa: !tarifa,
    });
  }

  return lineas.sort((a, b) => a.codigo_lote.localeCompare(b.codigo_lote));
}
