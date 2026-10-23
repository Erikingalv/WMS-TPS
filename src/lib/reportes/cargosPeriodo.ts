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
  cliente_id: string;
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
  // Traspaso de cliente: un lote que cambió de cliente genera una línea por
  // cada cliente que lo tuvo en el periodo, cada una con sus propios días.
  fecha_inicio_cliente: string; // desde cuándo es de este cliente (ISO)
  viene_de_cliente: string | null; // nombre del cliente anterior, si es traspaso
  pasa_a_cliente: string | null; // nombre del cliente siguiente, si lo traspasaron
  fecha_traspaso_salida: string | null; // fecha (YYYY-MM-DD) en que pasó al siguiente cliente
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
  const lotes = (lotesRaw ?? []) as unknown as LoteConProducto[];
  if (lotes.length === 0) return [];

  const loteIds = lotes.map((l) => l.id);
  const [{ data: salidasRaw }, { data: traspasosRaw }, { data: clientesRaw }] = await Promise.all([
    supabase.from("salidas").select("lote_id, fecha, cantidad_tarimas").in("lote_id", loteIds).order("fecha"),
    supabase
      .from("traspasos_cliente")
      .select("lote_id, fecha, cliente_origen_id, cliente_destino_id, producto_origen_id, producto_destino_id")
      .in("lote_id", loteIds)
      .order("fecha"),
    supabase.from("clientes").select("id, nombre"),
  ]);

  const salidasPorLote = new Map<string, { fecha: string; cantidad_tarimas: number }[]>();
  (salidasRaw ?? []).forEach((s) => {
    const lista = salidasPorLote.get(s.lote_id) ?? [];
    lista.push({ fecha: s.fecha, cantidad_tarimas: s.cantidad_tarimas });
    salidasPorLote.set(s.lote_id, lista);
  });

  type Traspaso = NonNullable<typeof traspasosRaw>[number];
  const traspasosPorLote = new Map<string, Traspaso[]>();
  (traspasosRaw ?? []).forEach((t) => {
    const lista = traspasosPorLote.get(t.lote_id) ?? [];
    lista.push(t);
    traspasosPorLote.set(t.lote_id, lista);
  });

  const nombreCliente = new Map((clientesRaw ?? []).map((c) => [c.id, c.nombre]));

  const productoIds = [
    ...new Set((traspasosRaw ?? []).flatMap((t) => [t.producto_origen_id, t.producto_destino_id])),
  ];
  const { data: productosRaw } =
    productoIds.length > 0
      ? await supabase.from("productos").select("id, nombre, sku").in("id", productoIds)
      : { data: [] as { id: string; nombre: string; sku: string }[] };
  const productoPorId = new Map((productosRaw ?? []).map((p) => [p.id, p]));

  // Clientes que pueden tener tarifa en este reporte: los actuales y los
  // que alguna vez tuvieron un lote traspasado.
  const clienteIds = [
    ...new Set([
      ...(lotes.map((l) => l.productos?.cliente_id).filter(Boolean) as string[]),
      ...(traspasosRaw ?? []).flatMap((t) => [t.cliente_origen_id, t.cliente_destino_id]),
    ]),
  ];
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
  const inicioDia = (iso: string) => {
    const f = new Date(iso);
    return new Date(f.getFullYear(), f.getMonth(), f.getDate());
  };
  const lineas: CargoPeriodoLinea[] = [];

  for (const lote of lotes) {
    const salidas = salidasPorLote.get(lote.id) ?? [];
    const traspasos = traspasosPorLote.get(lote.id) ?? [];
    const fechaIngresoDia = inicioDia(lote.fecha_ingreso);

    // Quién es el dueño del lote en cada tramo de su historia: el cliente
    // original desde la entrada, y uno nuevo desde la fecha de cada
    // traspaso (ese día ya cuenta para el cliente nuevo).
    type Tramo = {
      clienteId: string;
      productoId: string;
      desde: Date;
      vieneDe: string | null;
      costoAlmacenaje: number;
      dias: number;
      tarimasDia: number;
      segmentos: SegmentoAlmacenaje[];
      tarimasEntrada: number;
      costoManiobraEntrada: number;
      tarimasSalida: number;
      costoManiobraSalida: number;
    };
    const nuevoTramo = (clienteId: string, productoId: string, desdeDia: Date, vieneDe: string | null): Tramo => ({
      clienteId,
      productoId,
      desde: desdeDia,
      vieneDe,
      costoAlmacenaje: 0,
      dias: 0,
      tarimasDia: 0,
      segmentos: [],
      tarimasEntrada: 0,
      costoManiobraEntrada: 0,
      tarimasSalida: 0,
      costoManiobraSalida: 0,
    });
    const tramos: Tramo[] = [];
    if (traspasos.length === 0) {
      tramos.push(nuevoTramo(lote.productos?.cliente_id ?? "", lote.producto_id, fechaIngresoDia, null));
    } else {
      tramos.push(nuevoTramo(traspasos[0].cliente_origen_id, traspasos[0].producto_origen_id, fechaIngresoDia, null));
      traspasos.forEach((t) =>
        tramos.push(
          nuevoTramo(t.cliente_destino_id, t.producto_destino_id, new Date(`${t.fecha}T00:00:00`), t.cliente_origen_id)
        )
      );
    }
    const tramoDelDia = (d: Date): Tramo => {
      let actual = tramos[0];
      for (const t of tramos) if (t.desde <= d) actual = t;
      return actual;
    };

    for (let d = new Date(fechaDesde); d <= fechaHasta; d.setDate(d.getDate() + 1)) {
      if (d < fechaIngresoDia) continue;
      const salidasAntes = salidas
        .filter((s) => new Date(s.fecha) <= new Date(d.getTime() + 24 * 60 * 60 * 1000 - 1))
        .reduce((sum, s) => sum + s.cantidad_tarimas, 0);
      const tarimasEseDia = lote.tarimas_inicial - salidasAntes;
      if (tarimasEseDia <= 0) continue;

      const tramo = tramoDelDia(d);
      const tarifa = tarifaPorCliente.get(tramo.clienteId);
      const escalones = tarifa ? (escalonesPorTarifa.get(tarifa.id) ?? []) : [];

      tramo.dias += 1;
      // La antigüedad (para los escalones de la tarifa) cuenta desde que el
      // material es de ese cliente: la entrada, o la fecha del traspaso.
      const edad = diasEntre(tramo.desde, d);
      const escalon = escalones.find(
        (e) => edad >= e.dia_inicio && (e.dia_fin == null || edad <= e.dia_fin)
      );
      const costoDia = escalon && !escalon.es_gratis ? tarimasEseDia * escalon.costo_por_tarima : 0;
      tramo.costoAlmacenaje += costoDia;
      tramo.tarimasDia += tarimasEseDia;

      const tarifaDia = escalon ? (escalon.es_gratis ? 0 : escalon.costo_por_tarima) : null;
      const gratisDia = escalon?.es_gratis === true;
      const ultimo = tramo.segmentos[tramo.segmentos.length - 1];
      if (ultimo && ultimo.tarimas === tarimasEseDia && ultimo.tarifa === tarifaDia && ultimo.gratis === gratisDia) {
        ultimo.dias += 1;
        ultimo.hasta = claveDia(d);
        ultimo.subtotal = Math.round((ultimo.subtotal + costoDia) * 100) / 100;
      } else {
        tramo.segmentos.push({
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

    // Maniobra de entrada: al cliente al que se le recibió el material.
    if (fechaIngresoDia >= fechaDesde && fechaIngresoDia <= fechaHasta) {
      const tramo = tramos[0];
      const tarifa = tarifaPorCliente.get(tramo.clienteId);
      tramo.tarimasEntrada = lote.tarimas_inicial;
      tramo.costoManiobraEntrada = tarifa ? tramo.tarimasEntrada * tarifa.costo_maniobra_entrada : 0;
    }

    // Maniobra de salida: al cliente dueño del lote el día de la salida.
    for (const s of salidas) {
      const dia = inicioDia(s.fecha);
      if (dia >= fechaDesde && dia <= fechaHasta) {
        const tramo = tramoDelDia(dia);
        const tarifa = tarifaPorCliente.get(tramo.clienteId);
        tramo.tarimasSalida += s.cantidad_tarimas;
        tramo.costoManiobraSalida += tarifa ? s.cantidad_tarimas * tarifa.costo_maniobra_salida : 0;
      }
    }

    tramos.forEach((tramo, i) => {
      if (tramo.dias === 0 && tramo.tarimasEntrada === 0 && tramo.tarimasSalida === 0) return;
      if (clienteId && tramo.clienteId !== clienteId) return;

      const tarifa = tarifaPorCliente.get(tramo.clienteId);
      const escalones = tarifa ? (escalonesPorTarifa.get(tarifa.id) ?? []) : [];
      const siguiente = tramos[i + 1];
      const producto = productoPorId.get(tramo.productoId);
      const costoTotal = tramo.costoAlmacenaje + tramo.costoManiobraEntrada + tramo.costoManiobraSalida;

      lineas.push({
        cliente_id: tramo.clienteId,
        lote_id: lote.id,
        codigo_lote: lote.codigo_lote,
        cliente: nombreCliente.get(tramo.clienteId) ?? lote.productos?.clientes?.nombre ?? "—",
        producto: producto?.nombre ?? lote.productos?.nombre ?? "—",
        sku: producto?.sku ?? lote.productos?.sku ?? "—",
        dias_con_existencia: tramo.dias,
        costo_almacenaje: Math.round(tramo.costoAlmacenaje * 100) / 100,
        tarimas_entrada: tramo.tarimasEntrada,
        costo_maniobra_entrada: Math.round(tramo.costoManiobraEntrada * 100) / 100,
        tarimas_salida: tramo.tarimasSalida,
        costo_maniobra_salida: Math.round(tramo.costoManiobraSalida * 100) / 100,
        costo_total: Math.round(costoTotal * 100) / 100,
        sin_tarifa: !tarifa,
        tarifa_nombre: tarifa?.nombre ?? null,
        numero_bl: lote.entradas?.[0]?.numero_bl ?? null,
        fecha_ingreso: lote.fecha_ingreso,
        fecha_ultima_salida: salidas.length > 0 ? salidas[salidas.length - 1].fecha : null,
        tarimas_restantes: Math.max(0, lote.tarimas_inicial - salidas.reduce((sum, x) => sum + x.cantidad_tarimas, 0)),
        segmentos: tramo.segmentos,
        tarimas_dia: tramo.tarimasDia,
        tarifa_texto: describirEscalones(escalones),
        maniobra_entrada_unitaria: tarifa ? tarifa.costo_maniobra_entrada : null,
        maniobra_salida_unitaria: tarifa ? tarifa.costo_maniobra_salida : null,
        fecha_inicio_cliente: i === 0 ? lote.fecha_ingreso : `${traspasos[i - 1].fecha}T12:00:00`,
        viene_de_cliente: tramo.vieneDe ? (nombreCliente.get(tramo.vieneDe) ?? null) : null,
        pasa_a_cliente: siguiente ? (nombreCliente.get(siguiente.clienteId) ?? null) : null,
        fecha_traspaso_salida: siguiente ? traspasos[i].fecha : null,
      });
    });
  }

  // Agrupado por cliente (que es como se factura), y dentro de cada uno por
  // fecha de entrada (o de traspaso, si el lote le llegó por traspaso).
  return lineas.sort(
    (a, b) =>
      a.cliente.localeCompare(b.cliente) ||
      new Date(a.fecha_inicio_cliente).getTime() - new Date(b.fecha_inicio_cliente).getTime() ||
      a.codigo_lote.localeCompare(b.codigo_lote)
  );
}
