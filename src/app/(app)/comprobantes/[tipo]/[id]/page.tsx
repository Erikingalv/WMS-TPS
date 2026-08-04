import Image from "next/image";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_CORREGIR_MOVIMIENTOS, tienePermiso } from "@/lib/auth/permisos";
import { formatearFecha } from "@/lib/utils/dates";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { SignaturePad } from "@/components/salidas/SignaturePad";
import type { FilaEntrada, FilaSalida } from "@/lib/reportes/columnas";
import { formatearTarimas } from "@/lib/utils/tarimas";
import { firmarComprobante } from "./actions";

export default async function ComprobanteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string; id: string }>;
  searchParams: Promise<{ error?: string; firmado?: string }>;
}) {
  const { tipo, id } = await params;
  const { error, firmado } = await searchParams;

  if (tipo !== "entrada" && tipo !== "salida") notFound();

  const supabase = await createClient();

  const { data: dataRaw } =
    tipo === "entrada"
      ? await supabase
          .from("entradas")
          .select(
            "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), recibio:recibio_usuario_id(nombre)"
          )
          .eq("id", id)
          .single()
      : await supabase
          .from("salidas")
          .select(
            "*, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo), autorizo:autorizo_usuario_id(nombre)"
          )
          .eq("id", id)
          .single();

  if (!dataRaw) notFound();
  const data = dataRaw as unknown as (FilaEntrada | FilaSalida) & {
    lotes: { codigo_lote: string } | null;
  };

  const firmarConDatos = firmarComprobante.bind(null, tipo, id);
  const usuario = await getUsuarioActual();
  const puedeCorregir = usuario ? tienePermiso(usuario.rol, PUEDE_CORREGIR_MOVIMIENTOS) : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">
              Comprobante de {tipo === "entrada" ? "recibo" : "entrega"}
            </h1>
            <Badge tone={tipo === "entrada" ? "ok" : "crit"}>{tipo}</Badge>
          </div>
          <p className="mt-1 font-mono text-sm text-ink-soft">{data.lotes?.codigo_lote ?? "—"}</p>
        </div>
        <div className="flex gap-3">
          {puedeCorregir && (
            <ButtonLink href={`/${tipo === "entrada" ? "entradas" : "salidas"}/${id}/editar`} variant="secondary">
              <Pencil size={16} /> Corregir
            </ButtonLink>
          )}
          <ButtonLink href={`/api/comprobante/${tipo}/${id}`} variant="secondary">
            <FileDown size={16} /> Descargar PDF
          </ButtonLink>
        </div>
      </div>

      {firmado && (
        <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
          Firma guardada correctamente.
        </p>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">Detalle del movimiento</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Campo etiqueta="Fecha" valor={formatearFecha(data.fecha)} />
            <Campo etiqueta="Hora de carga/descarga" valor={data.hora_carga_descarga?.slice(0, 5) ?? "—"} />
            <Campo etiqueta="Cliente" valor={data.clientes?.nombre ?? "—"} />
            <Campo etiqueta="Producto" valor={data.productos?.nombre ?? "—"} />
            <Campo etiqueta="SKU" valor={data.productos?.sku ?? "—"} />
            <Campo etiqueta="Ubicación" valor={data.ubicaciones?.codigo ?? "—"} />
            <Campo etiqueta="Piezas" valor={String(data.cantidad_piezas)} />
            <Campo etiqueta="Tarimas" valor={String(data.cantidad_tarimas)} />
            {(() => {
              const tarimaNumeros = "tarima_numeros" in data ? data.tarima_numeros : null;
              const rango =
                tarimaNumeros && tarimaNumeros.length > 0
                  ? formatearTarimas(tarimaNumeros)
                  : data.tarima_desde != null
                    ? `${data.tarima_desde}-${data.tarima_hasta}`
                    : null;
              return rango ? <Campo etiqueta="Identificador de tarimas" valor={rango} /> : null;
            })()}
            <Campo etiqueta="Presentación" valor={data.presentacion ?? "—"} />
            <Campo
              etiqueta="Cajas por pallet"
              valor={data.cajas_por_pallet != null ? String(data.cajas_por_pallet) : "—"}
            />
            <Campo
              etiqueta="Cantidad por caja"
              valor={data.cantidad_por_caja != null ? String(data.cantidad_por_caja) : "—"}
            />
            <Campo etiqueta="Categoría" valor={data.categoria_producto ?? "—"} />
            <Campo etiqueta="Lote 1" valor={data.lote_1 ?? "—"} />
            <Campo etiqueta="Lote 2 (SAP)" valor={data.lote_2 ?? "—"} />
            <Campo etiqueta="Contenedor" valor={data.numero_contenedor ?? "—"} />
            <Campo etiqueta="BL / Referencia" valor={data.numero_bl ?? "—"} />
            {tipo === "entrada" && "peso_kg" in data && (
              <Campo etiqueta="Peso (kg)" valor={data.peso_kg != null ? String(data.peso_kg) : "—"} />
            )}
            {tipo === "salida" && "destino" in data && (
              <>
                <Campo etiqueta="Destino" valor={data.destino ?? "—"} />
                <Campo etiqueta="Transportista" valor={data.transportista ?? "—"} />
                <Campo etiqueta="Placas / unidad" valor={data.placas ?? "—"} />
                <Campo etiqueta="Operador" valor={data.operador ?? "—"} />
                {data.piezas_tarima_parcial != null && (
                  <Campo
                    etiqueta="Tarima parcial"
                    valor={`${data.numero_tarima_parcial != null ? `tarima #${data.numero_tarima_parcial}: ` : ""}${data.piezas_tarima_parcial} pz`}
                  />
                )}
              </>
            )}
            {tipo === "entrada" && "tarimas_parciales" in data && data.tarimas_parciales.length > 0 && (
              <div className="col-span-2">
                <Campo
                  etiqueta="Tarimas parciales"
                  valor={data.tarimas_parciales
                    .map((t) => `${t.numero_tarima != null ? `#${t.numero_tarima}` : "s/n"}: ${t.piezas} pz`)
                    .join(", ")}
                />
              </div>
            )}
            {data.observaciones && (
              <div className="col-span-2">
                <Campo etiqueta="Observaciones" valor={data.observaciones} />
              </div>
            )}
          </dl>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Firma digital</h2>
          {data.firma_digital_url ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-full rounded-lg border border-line bg-white p-2">
                <Image
                  src={data.firma_digital_url}
                  alt="Firma"
                  width={280}
                  height={100}
                  className="h-auto w-full"
                  unoptimized
                />
              </div>
              <Badge tone="ok">Firmado</Badge>
            </div>
          ) : (
            <form action={firmarConDatos} className="flex flex-col gap-3">
              <SignaturePad name="firma_digital_dataurl" />
              <SubmitButton pendingLabel="Guardando…" className="w-full">
                Guardar firma
              </SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}

function Campo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-faint">{etiqueta}</dt>
      <dd className="text-ink">{valor}</dd>
    </div>
  );
}
