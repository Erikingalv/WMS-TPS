import { createClient } from "@/lib/supabase/server";
import { SalidaForm, type ExistenciaDisponible } from "@/components/salidas/SalidaForm";
import { crearSalida } from "@/app/(app)/salidas/actions";
import type { Lote, Ubicacion } from "@/lib/types/database";

type ExistenciaRaw = {
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  lotes: Pick<Lote, "codigo_lote" | "fecha_ingreso" | "producto_id" | "estado"> | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

export default async function NuevaSalidaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const [{ data: clientes }, { data: productos }, { data: usuarios }, { data: existenciasRaw }] =
    await Promise.all([
      supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
      supabase.from("usuarios").select("*").eq("activo", true).order("nombre"),
      supabase
        .from("inventario_lote_ubicacion")
        .select(
          "lote_id, ubicacion_id, cantidad_piezas, cantidad_tarimas, lotes(codigo_lote, fecha_ingreso, producto_id, estado), ubicaciones(codigo)"
        ),
    ]);

  const existencias: ExistenciaDisponible[] = ((existenciasRaw ?? []) as unknown as ExistenciaRaw[])
    .filter(
      (e) => e.lotes?.estado === "activo" && (e.cantidad_piezas > 0 || e.cantidad_tarimas > 0)
    )
    .map((e) => ({
      lote_id: e.lote_id,
      ubicacion_id: e.ubicacion_id,
      producto_id: e.lotes!.producto_id,
      codigo_lote: e.lotes!.codigo_lote,
      fecha_ingreso: e.lotes!.fecha_ingreso,
      ubicacion_codigo: e.ubicaciones?.codigo ?? "—",
      cantidad_piezas: e.cantidad_piezas,
      cantidad_tarimas: e.cantidad_tarimas,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva salida</h1>
        <p className="mt-1 text-sm text-ink-soft">
          El sistema nunca deja el inventario en negativo.
        </p>
      </div>
      <SalidaForm
        action={crearSalida}
        clientes={clientes ?? []}
        productos={productos ?? []}
        existencias={existencias}
        usuarios={usuarios ?? []}
        error={params.error}
      />
    </div>
  );
}
