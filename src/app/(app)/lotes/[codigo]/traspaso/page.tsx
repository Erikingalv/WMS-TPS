import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { puedeCorregirMovimientos } from "@/lib/auth/permisos";
import { obtenerExistenciasDisponibles } from "@/lib/inventario";
import { piezasPorTarima } from "@/lib/utils/numeros";
import { TraspasoForm } from "@/components/lotes/TraspasoForm";
import type { Cliente, Producto } from "@/lib/types/database";
import { traspasarLoteAction } from "./actions";

export default async function TraspasoLotePage({
  params,
  searchParams,
}: {
  params: Promise<{ codigo: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { codigo } = await params;
  const { error } = await searchParams;
  const usuario = await getUsuarioActual();
  if (!usuario || !puedeCorregirMovimientos(usuario)) {
    redirect(`/lotes/${codigo}`);
  }

  const supabase = await createClient();
  const { data: loteRaw } = await supabase
    .from("lotes")
    .select("id, codigo_lote, tarima_desde, tarima_hasta, productos(nombre, sku, cliente_id, clientes(nombre))")
    .eq("codigo_lote", codigo)
    .single();
  if (!loteRaw) notFound();
  const lote = loteRaw as unknown as {
    id: string;
    codigo_lote: string;
    tarima_desde: number | null;
    tarima_hasta: number | null;
    productos: (Pick<Producto, "nombre" | "sku" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
  };

  const [{ data: clientes }, { data: ubicaciones }, { data: tarifas }, { data: entrada }, disponibles] =
    await Promise.all([
      supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
      supabase.from("ubicaciones").select("id, codigo").eq("activo", true).order("codigo"),
      supabase.from("tarifas_almacenaje").select("cliente_id").eq("activo", true),
      supabase.from("entradas").select("cajas_por_pallet, cantidad_por_caja").eq("lote_id", lote.id).limit(1).maybeSingle(),
      obtenerExistenciasDisponibles(supabase),
    ]);

  const conTarifa = new Set((tarifas ?? []).map((t) => t.cliente_id));
  const existencias = disponibles
    .filter((e) => e.lote_id === lote.id)
    .map((e) => ({
      ubicacion_id: e.ubicacion_id,
      codigo: e.ubicacion_codigo,
      piezas: e.cantidad_piezas,
      tarimas: e.cantidad_tarimas,
    }));
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Traspasar material</h1>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-mono">{lote.codigo_lote}</span> · {lote.productos?.nombre ?? "—"} (
          {lote.productos?.sku ?? "—"}) · cliente actual:{" "}
          <strong>{lote.productos?.clientes?.nombre ?? "—"}</strong>
        </p>
        <p className="mt-1 max-w-2xl text-xs text-ink-faint">
          Elige cuántas tarimas pasan (todas o solo algunas), a qué cliente y/o a qué ubicación. Al cliente
          anterior se le cobra hasta el día anterior a la fecha del traspaso y al nuevo desde esa fecha; los
          cobros de días pasados no cambian.
        </p>
      </div>

      <TraspasoForm
        action={traspasarLoteAction.bind(null, codigo, lote.id)}
        volverHref={`/lotes/${codigo}`}
        clientes={(clientes ?? []).map((c) => ({ id: c.id, nombre: c.nombre, conTarifa: conTarifa.has(c.id) }))}
        clienteActualId={lote.productos?.cliente_id ?? ""}
        ubicaciones={ubicaciones ?? []}
        existencias={existencias}
        piezasPorTarima={piezasPorTarima(entrada?.cajas_por_pallet, entrada?.cantidad_por_caja)}
        rangoLote={lote.tarima_desde != null ? `${lote.tarima_desde}-${lote.tarima_hasta}` : null}
        hoy={hoy}
        error={error}
      />
    </div>
  );
}
