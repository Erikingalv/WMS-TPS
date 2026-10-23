import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { puedeCorregirMovimientos } from "@/lib/auth/permisos";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { formatearNumero } from "@/lib/utils/numeros";
import type { Cliente, Producto, Ubicacion } from "@/lib/types/database";
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
    .select("id, codigo_lote, productos(nombre, sku, cliente_id, clientes(nombre))")
    .eq("codigo_lote", codigo)
    .single();
  if (!loteRaw) notFound();
  const lote = loteRaw as unknown as {
    id: string;
    codigo_lote: string;
    productos: (Pick<Producto, "nombre" | "sku" | "cliente_id"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
  };

  const [{ data: clientes }, { data: ubicaciones }, { data: existencias }, { data: tarifas }] = await Promise.all([
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("ubicaciones").select("id, codigo").eq("activo", true).order("codigo"),
    supabase
      .from("inventario_lote_ubicacion")
      .select("ubicacion_id, cantidad_piezas, cantidad_tarimas, ubicaciones(codigo)")
      .eq("lote_id", lote.id)
      .or("cantidad_piezas.gt.0,cantidad_tarimas.gt.0"),
    supabase.from("tarifas_almacenaje").select("cliente_id").eq("activo", true),
  ]);

  const conTarifa = new Set((tarifas ?? []).map((t) => t.cliente_id));
  const existenciasLote = (existencias ?? []) as unknown as {
    ubicacion_id: string;
    cantidad_piezas: number;
    cantidad_tarimas: number;
    ubicaciones: Pick<Ubicacion, "codigo"> | null;
  }[];
  const clienteActualId = lote.productos?.cliente_id ?? "";
  const hoy = new Date().toISOString().slice(0, 10);
  const accion = traspasarLoteAction.bind(null, codigo, lote.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Traspasar material</h1>
        <p className="mt-1 text-sm text-ink-soft">
          <span className="font-mono">{lote.codigo_lote}</span> · {lote.productos?.nombre ?? "—"} (
          {lote.productos?.sku ?? "—"}) · cliente actual:{" "}
          <strong>{lote.productos?.clientes?.nombre ?? "—"}</strong>
        </p>
        <p className="mt-1 text-xs text-ink-faint">
          Cambia el cliente de este lote completo y/o lo pasa a otra ubicación. Al cliente anterior se
          le cobra hasta el día anterior a la fecha del traspaso y al nuevo desde esa fecha; los cobros
          de días pasados no cambian.
        </p>
      </div>

      <form action={accion} className="flex max-w-2xl flex-col gap-5">
        {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Cliente nuevo"
            name="cliente_destino_id"
            defaultValue={clienteActualId}
            hint="Déjalo igual si solo cambias de ubicación"
          >
            {(clientes ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
                {c.id === clienteActualId ? " (actual)" : ""}
                {!conTarifa.has(c.id) ? " — sin tarifa configurada" : ""}
              </option>
            ))}
          </Select>
          <Input
            label="Fecha del traspaso"
            name="fecha"
            type="date"
            max={hoy}
            defaultValue={hoy}
            hint="Desde este día se le cobra al cliente nuevo"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Select
            label="Ubicación actual (de dónde sale)"
            name="ubicacion_origen_id"
            defaultValue={existenciasLote.length === 1 ? existenciasLote[0].ubicacion_id : ""}
            hint="Solo si también cambia de ubicación; se mueve todo lo que haya del lote ahí"
          >
            <option value="">No cambia de ubicación</option>
            {existenciasLote.map((e) => (
              <option key={e.ubicacion_id} value={e.ubicacion_id}>
                {e.ubicaciones?.codigo ?? "—"} · {formatearNumero(e.cantidad_piezas)} pz /{" "}
                {formatearNumero(e.cantidad_tarimas)} tar
              </option>
            ))}
          </Select>
          <Select label="Ubicación nueva" name="ubicacion_destino_id" defaultValue="">
            <option value="">No cambia de ubicación</option>
            {((ubicaciones ?? []) as Pick<Ubicacion, "id" | "codigo">[]).map((u) => (
              <option key={u.id} value={u.id}>
                {u.codigo}
              </option>
            ))}
          </Select>
        </div>

        <Textarea label="Motivo (opcional)" name="motivo" rows={2} />

        <div className="flex gap-3">
          <SubmitButton pendingLabel="Guardando…">Guardar traspaso</SubmitButton>
          <ButtonLink href={`/lotes/${codigo}`} variant="secondary">
            Cancelar
          </ButtonLink>
        </div>
      </form>
    </div>
  );
}
