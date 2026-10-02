import type { createClient } from "@/lib/supabase/server";
import type { Cliente, Lote, Producto, TarifaEscalon } from "@/lib/types/database";
import { formatearMoneda } from "@/lib/utils/numeros";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

// Un tramo del cobro de almacenaje: días consecutivos con la misma cantidad
// de tarimas en bodega y la misma tarifa. Es lo que permite explicar el
// monto ("20 tarimas × 63 días × $7.50") aun cuando salieron tarimas a la
// mitad del periodo o cambió el escalón de la tarifa.
export type SegmentoAlmacenaje = {
  tarimas: number;
  dias: number;
  // Costo por tarima por día; null si ningún escalón de la tarifa cubre esos días.
  tarifa: number | null;
  gratis: boolean;
  subtotal: number;
  desde: string; // YYYY-MM-DD
  hasta: string;
};

export type CargoPeriodoLinea = {
  lote_id: string;
  codigo_lote: string;
  cliente: string;
  producto: string;
  sku: string;
  dias_con_existencia: number;
  costo_almacenaje: number;
  tarimas_entrada: number;
  costo_maniobra_entrada: number;
  tarimas_salida: number;
  costo_maniobra_salida: number;
  costo_total: number;
  sin_tarifa: boolean;
  tarifa_nombre: string | null;
  numero_bl: string | null;
  fecha_ingreso: string;
  // Última salida registrada del lote (de cualquier fecha, no solo del
  // periodo) y cuántas tarimas siguen en bodega al día de hoy — para poder
  // mostrar "entró el X, salió el Y" o "sigue en bodega".
  fecha_ultima_salida: string | null;
  tarimas_restantes: number;
  segmentos: SegmentoAlmacenaje[];
  tarimas_dia: number; // suma de tarimas × días con existencia en el periodo
  tarifa_texto: string | null; // la tarifa en pesos, ej. "$7.50 por tarima por día"
  maniobra_entrada_unitaria: number | null;
  maniobra_salida_unitaria: number | null;
};

// La tarifa en pesos, legible: "$7.50 por tarima por día", o por tramos si
// tiene escalones ("Días 0 al 4: gratis · Del día 5 en adelante: $7.50").
export function describirEscalones(escalones: TarifaEscalon[]): string | null {
  if (escalones.length === 0) return null;
  const orden = [...escalones].sort((a, b) => a.dia_inicio - b.dia_inicio);
  const precio = (e: TarifaEscalon) => (e.es_gratis ? "gratis" : `${formatearMoneda(e.costo_por_tarima)} por tarima por día`);
  if (orden.length === 1 && orden[0].dia_inicio === 0 && orden[0].dia_fin == null) return precio(orden[0]);
  return orden
    .map((e) => {
      const rango =
        e.dia_fin == null
          ? `Del día ${e.dia_inicio} en adelante`
          : e.dia_inicio === e.dia_fin
            ? `Día ${e.dia_inicio}`
            : `Del día ${e.dia_inicio} al ${e.dia_fin}`;
      return `${rango}: ${precio(e)}`;
    })
    .join(" · ");
}

function claveDia(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

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
    productos:
      | (Pick<Producto, "nombre" | "sku" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null })
      | null;
    entradas: { numero_bl: string | null }[] | null;
  };

  const { data: lotesRaw } = await supabase
    .from("lotes")
    .select("id, codigo_lote, fecha_ingreso, tarimas_inicial, producto_id, productos(nombre, sku, cliente_id, clientes(nombre)), entradas(numero_bl)")
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
    let tarimasDia = 0;
    const segmentos: SegmentoAlmacenaje[] = [];

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
      const costoDia = escalon && !escalon.es_gratis ? tarimasEseDia * escalon.costo_por_tarima : 0;
      costoAlmacenaje += costoDia;
      tarimasDia += tarimasEseDia;

      const tarifaDia = escalon ? (escalon.es_gratis ? 0 : escalon.costo_por_tarima) : null;
      const gratisDia = escalon?.es_gratis === true;
      const ultimo = segmentos[segmentos.length - 1];
      if (ultimo && ultimo.tarimas === tarimasEseDia && ultimo.tarifa === tarifaDia && ultimo.gratis === gratisDia) {
        ultimo.dias += 1;
        ultimo.hasta = claveDia(d);
        ultimo.subtotal = Math.round((ultimo.subtotal + costoDia) * 100) / 100;
      } else {
        segmentos.push({
          tarimas: tarimasEseDia,
          dias: 1,
          tarifa: tarifaDia,
          gratis: gratisDia,
          subtotal: Math.round(costoDia * 100) / 100,
          desde: claveDia(d),
          hasta: claveDia(d),
        });
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
      sku: lote.productos?.sku ?? "—",
      dias_con_existencia: diasConExistencia,
      costo_almacenaje: Math.round(costoAlmacenaje * 100) / 100,
      tarimas_entrada: tarimasEntrada,
      costo_maniobra_entrada: Math.round(costoManiobraEntrada * 100) / 100,
      tarimas_salida: tarimasSalida,
      costo_maniobra_salida: Math.round(costoManiobraSalida * 100) / 100,
      costo_total: Math.round(costoTotal * 100) / 100,
      sin_tarifa: !tarifa,
      tarifa_nombre: tarifa?.nombre ?? null,
      numero_bl: lote.entradas?.[0]?.numero_bl ?? null,
      fecha_ingreso: lote.fecha_ingreso,
      fecha_ultima_salida: salidas.length > 0 ? salidas[salidas.length - 1].fecha : null,
      tarimas_restantes: Math.max(0, lote.tarimas_inicial - salidas.reduce((sum, x) => sum + x.cantidad_tarimas, 0)),
      segmentos,
      tarimas_dia: tarimasDia,
      tarifa_texto: describirEscalones(escalones),
      maniobra_entrada_unitaria: tarifa ? tarifa.costo_maniobra_entrada : null,
      maniobra_salida_unitaria: tarifa ? tarifa.costo_maniobra_salida : null,
    });
  }

  // Agrupado por cliente (que es como se factura), y dentro de cada uno por
  // fecha de entrada.
  return lineas.sort(
    (a, b) =>
      a.cliente.localeCompare(b.cliente) ||
      new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime() ||
      a.codigo_lote.localeCompare(b.codigo_lote)
  );
}
