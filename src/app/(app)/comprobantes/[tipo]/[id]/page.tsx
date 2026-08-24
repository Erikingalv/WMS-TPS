import Image from "next/image";
import { notFound } from "next/navigation";
import { FileDown, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { urlPublica } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { puedeCorregirMovimientos, PUEDE_SUBIR_EVIDENCIA, tienePermiso } from "@/lib/auth/permisos";
import { formatearFecha } from "@/lib/utils/dates";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { SignaturePad } from "@/components/salidas/SignaturePad";
import { EvidenciaFotos } from "@/components/ui/EvidenciaFotos";
import { CompartirComprobante } from "@/components/comprobantes/CompartirComprobante";
import type { ArchivoAdjunto } from "@/lib/types/database";
import type { FilaEntrada, FilaSalida } from "@/lib/reportes/columnas";
import { formatearTarimas } from "@/lib/utils/tarimas";
import { firmarComprobante, agregarEvidenciaFotos } from "./actions";

type LineaGrupo = {
  id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  clientes: { nombre: string } | null;
  productos: { nombre: string; sku: string } | null;
  lotes: { codigo_lote: string } | null;
  ubicaciones: { codigo: string } | null;
};

export default async function ComprobanteDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string; id: string }>;
  searchParams: Promise<{ error?: string; firmado?: string; fotos?: string }>;
}) {
  const { tipo, id } = await params;
  const { error, firmado, fotos: fotosGuardadas } = await searchParams;

  if (tipo !== "entrada" && tipo !== "salida") notFound();

  const supabase = await createClient();
  const tabla = tipo === "entrada" ? "entradas" : "salidas";

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

  // Si otras líneas del mismo embarque/viaje comparten grupo_id, este
  // comprobante debe verse y firmarse como un solo movimiento con todos
  // los productos, no solo el de esta línea.
  const { data: hermanosRaw } = await supabase.from(tabla).select("id").eq("grupo_id", data.grupo_id);
  const idsGrupo = (hermanosRaw ?? []).map((r) => r.id as string);
  const esGrupo = idsGrupo.length > 1;

  let lineasGrupo: LineaGrupo[] = [];
  if (esGrupo) {
    const { data: filasRaw } = await supabase
      .from(tabla)
      .select("id, cantidad_piezas, cantidad_tarimas, clientes(nombre), productos(nombre, sku), lotes(codigo_lote), ubicaciones(codigo)")
      .in("id", idsGrupo);
    lineasGrupo = (filasRaw ?? []) as unknown as LineaGrupo[];
  }

  const { data: adjuntos } = await supabase
    .from("archivos_adjuntos")
    .select("*")
    .eq("entidad_tipo", tipo)
    .eq("entidad_id", id)
    .eq("tipo_documento", "foto");
  const fotos = (adjuntos ?? []) as ArchivoAdjunto[];

  const firmarConDatos = firmarComprobante.bind(null, tipo, id);
  const agregarFotosConDatos = agregarEvidenciaFotos.bind(null, tipo, id);
  const usuario = await getUsuarioActual();
  const puedeCorregir = usuario ? puedeCorregirMovimientos(usuario) : false;
  const puedeSubirEvidencia = usuario ? tienePermiso(usuario.rol, PUEDE_SUBIR_EVIDENCIA) : false;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">
              Comprobante de {tipo === "entrada" ? "recibo" : "entrega"}
            </h1>
            <Badge tone={tipo === "entrada" ? "ok" : "crit"}>{tipo}</Badge>
            {esGrupo && <Badge tone="info">{lineasGrupo.length} productos</Badge>}
          </div>
          <p className="mt-1 font-mono text-sm text-ink-soft">
            {esGrupo
              ? lineasGrupo.map((l) => l.lotes?.codigo_lote ?? "—").join(" · ")
              : (data.lotes?.codigo_lote ?? "—")}
          </p>
        </div>
        <div className="flex gap-3">
          {puedeCorregir && !esGrupo && (
            <ButtonLink href={`/${tipo === "entrada" ? "entradas" : "salidas"}/${id}/editar`} variant="secondary">
              <Pencil size={16} /> Corregir
            </ButtonLink>
          )}
          <ButtonLink href={`/api/comprobante/${tipo}/${id}`} variant="secondary">
            <FileDown size={16} /> Descargar PDF
          </ButtonLink>
          <CompartirComprobante
            url={`/api/comprobante/${tipo}/${id}`}
            archivoNombre={
              esGrupo
                ? `comprobante-${tipo}-consolidado.pdf`
                : `comprobante-${tipo}-${data.lotes?.codigo_lote ?? id.slice(0, 8)}.pdf`
            }
          />
        </div>
      </div>

      {firmado && (
        <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
          Firma guardada correctamente.
        </p>
      )}
      {fotosGuardadas && (
        <p className="rounded-lg bg-ok-soft px-3.5 py-2.5 text-sm text-ok">
          Fotos guardadas correctamente.
        </p>
      )}
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-ink">Detalle del movimiento</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <Campo etiqueta="Fecha" valor={formatearFecha(data.fecha)} />
            <Campo etiqueta="Hora de carga/descarga" valor={data.hora_carga_descarga?.slice(0, 5) ?? "—"} />
            {!esGrupo && (
              <>
                <Campo etiqueta="Cliente" valor={data.clientes?.nombre ?? "—"} />
                <Campo etiqueta="Producto" valor={data.productos?.nombre ?? "—"} />
                <Campo etiqueta="SKU" valor={data.productos?.sku ?? "—"} />
                <Campo etiqueta="Ubicación" valor={data.ubicaciones?.codigo ?? "—"} />
                <Campo etiqueta="Piezas" valor={String(data.cantidad_piezas)} />
                <Campo etiqueta="Tarimas" valor={String(data.cantidad_tarimas)} />
              </>
            )}
            {!esGrupo &&
              (() => {
                const tarimaNumeros = "tarima_numeros" in data ? data.tarima_numeros : null;
                const rango =
                  tarimaNumeros && tarimaNumeros.length > 0
                    ? formatearTarimas(tarimaNumeros)
                    : data.tarima_desde != null
                      ? `${data.tarima_desde}-${data.tarima_hasta}`
                      : null;
                return rango ? <Campo etiqueta="Identificador de tarimas" valor={rango} /> : null;
              })()}
            {!esGrupo && (
              <>
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
              </>
            )}
            {tipo === "entrada" && (
              <>
                <Campo etiqueta="Contenedor" valor={data.numero_contenedor ?? "—"} />
                <Campo etiqueta="BL / Referencia" valor={data.numero_bl ?? "—"} />
                {!esGrupo && "peso_kg" in data && (
                  <Campo etiqueta="Peso (kg)" valor={data.peso_kg != null ? String(data.peso_kg) : "—"} />
                )}
              </>
            )}
            {tipo === "salida" && "destino" in data && (
              <>
                <Campo etiqueta="Destino" valor={data.destino ?? "—"} />
                <Campo etiqueta="Transportista" valor={data.transportista ?? "—"} />
                <Campo etiqueta="Placas / unidad" valor={data.placas ?? "—"} />
                <Campo etiqueta="Operador" valor={data.operador ?? "—"} />
                {!esGrupo && data.piezas_tarima_parcial != null && (
                  <Campo
                    etiqueta="Tarima parcial"
                    valor={`${data.numero_tarima_parcial != null ? `tarima #${data.numero_tarima_parcial}: ` : ""}${data.piezas_tarima_parcial} pz`}
                  />
                )}
              </>
            )}
            {!esGrupo && "tarimas_parciales" in data && data.tarimas_parciales.length > 0 && (
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

          {esGrupo && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Productos de este {tipo === "entrada" ? "embarque" : "viaje"}
              </p>
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
                      <th className="px-3 py-2">Lote</th>
                      <th className="px-3 py-2">Cliente</th>
                      <th className="px-3 py-2">Producto</th>
                      <th className="px-3 py-2">Piezas</th>
                      <th className="px-3 py-2">Tarimas</th>
                      <th className="px-3 py-2">Ubicación</th>
                      {puedeCorregir && <th className="px-3 py-2" />}
                    </tr>
                  </thead>
                  <tbody>
                    {lineasGrupo.map((l) => (
                      <tr key={l.id} className="border-b border-line last:border-0">
                        <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                          {l.lotes?.codigo_lote ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-ink">{l.clientes?.nombre ?? "—"}</td>
                        <td className="px-3 py-2 text-ink-soft">
                          {l.productos?.nombre ?? "—"}{" "}
                          <span className="font-mono text-xs text-ink-faint">{l.productos?.sku}</span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-ink">{l.cantidad_piezas}</td>
                        <td className="px-3 py-2 tabular-nums text-ink">{l.cantidad_tarimas}</td>
                        <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                          {l.ubicaciones?.codigo ?? "—"}
                        </td>
                        {puedeCorregir && (
                          <td className="px-3 py-2 text-right">
                            <a
                              href={`/${tipo === "entrada" ? "entradas" : "salidas"}/${l.id}/editar`}
                              className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                            >
                              <Pencil size={12} /> Corregir
                            </a>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
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

        <Card className="p-5 lg:col-span-3">
          <h2 className="mb-3 text-sm font-semibold text-ink">Fotografías de evidencia</h2>
          {fotos.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-3">
              {fotos.map((f) => (
                <a key={f.id} href={urlPublica(supabase, "documentos", f.storage_path)} target="_blank">
                  <Image
                    src={urlPublica(supabase, "documentos", f.storage_path)}
                    alt="Evidencia fotográfica"
                    width={80}
                    height={80}
                    className="size-20 rounded-lg border border-line object-cover"
                  />
                </a>
              ))}
            </div>
          )}
          {fotos.length === 0 && (
            <p className="mb-4 text-sm text-ink-faint">Todavía no hay fotos de este movimiento.</p>
          )}
          {puedeSubirEvidencia ? (
            <form action={agregarFotosConDatos} encType="multipart/form-data" className="flex flex-col gap-3">
              <EvidenciaFotos name="fotos" label="Agregar más fotos" />
              <SubmitButton pendingLabel="Guardando…" className="w-fit">
                Guardar fotos
              </SubmitButton>
            </form>
          ) : (
            !usuario && <p className="text-xs text-ink-faint">Inicia sesión para poder agregar fotos.</p>
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
