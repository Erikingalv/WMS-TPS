import Image from "next/image";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { urlPublica } from "@/lib/supabase/storage";
import { generarQrDataUrl } from "@/lib/qr";
import { diasDesde, formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type {
  ArchivoAdjunto,
  Cliente,
  Producto,
  Ubicacion,
} from "@/lib/types/database";

function tonoPorDias(dias: number) {
  if (dias >= 90) return "crit" as const;
  if (dias >= 30) return "warn" as const;
  return "ok" as const;
}

function detalleLogistico(mov: {
  hora_carga_descarga: string;
  numero_contenedor: string | null;
  numero_bl: string | null;
  presentacion: string | null;
  categoria_producto: string | null;
  lote_1: string | null;
  lote_2: string | null;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
}) {
  const partes = [
    `carga/descarga ${mov.hora_carga_descarga.slice(0, 5)}`,
    mov.numero_contenedor ? `contenedor ${mov.numero_contenedor}` : null,
    mov.numero_bl ? `BL ${mov.numero_bl}` : null,
    mov.presentacion,
    mov.categoria_producto,
    mov.lote_1 ? `lote 1: ${mov.lote_1}` : null,
    mov.lote_2 ? `lote 2: ${mov.lote_2}` : null,
    mov.cajas_por_pallet ? `${mov.cajas_por_pallet} cajas/pallet` : null,
    mov.cantidad_por_caja ? `${mov.cantidad_por_caja} pz/caja` : null,
  ].filter(Boolean);
  return partes.length > 0 ? ` (${partes.join(" · ")})` : "";
}

type Movimiento =
  | { tipo: "entrada"; fecha: string; detalle: string }
  | { tipo: "salida"; fecha: string; detalle: string }
  | { tipo: "movimiento"; fecha: string; detalle: string };

export default async function LoteDetallePage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const supabase = await createClient();

  const { data: lote } = await supabase
    .from("lotes")
    .select("*, productos(nombre, sku, cliente_id, clientes(nombre))")
    .eq("codigo_lote", codigo)
    .single();

  if (!lote) notFound();

  const producto = (
    lote as unknown as {
      productos: (Pick<Producto, "nombre" | "sku" | "cliente_id"> & {
        clientes: Pick<Cliente, "nombre"> | null;
      }) | null;
    }
  ).productos;

  const [
    { data: existencias },
    { data: ubicacionesTodas },
    { data: entradas },
    { data: salidas },
    { data: movimientosInternos },
  ] = await Promise.all([
    supabase
      .from("inventario_lote_ubicacion")
      .select("*, ubicaciones(codigo, zona)")
      .eq("lote_id", lote.id),
    supabase.from("ubicaciones").select("id, codigo"),
    supabase.from("entradas").select("*").eq("lote_id", lote.id).order("fecha"),
    supabase.from("salidas").select("*").eq("lote_id", lote.id).order("fecha"),
    supabase
      .from("movimientos_internos")
      .select("*")
      .eq("lote_id", lote.id)
      .order("created_at"),
  ]);

  const mapaUbicaciones = new Map(
    (ubicacionesTodas ?? []).map((u: Pick<Ubicacion, "id" | "codigo">) => [u.id, u.codigo])
  );

  const primeraEntrada = (entradas ?? [])[0];
  const { data: adjuntos } = primeraEntrada
    ? await supabase
        .from("archivos_adjuntos")
        .select("*")
        .eq("entidad_tipo", "entrada")
        .eq("entidad_id", primeraEntrada.id)
    : { data: [] as ArchivoAdjunto[] };

  const fotos = (adjuntos ?? []).filter((a) => a.tipo_documento === "foto");
  const documentos = (adjuntos ?? []).filter((a) => a.tipo_documento !== "foto");

  const movimientos: Movimiento[] = [
    ...(entradas ?? []).map((e) => ({
      tipo: "entrada" as const,
      fecha: e.fecha,
      detalle: `Entrada de ${e.cantidad_piezas} pz / ${e.cantidad_tarimas} tar a ${mapaUbicaciones.get(e.ubicacion_id) ?? "?"}${detalleLogistico(e)}`,
    })),
    ...(salidas ?? []).map((s) => ({
      tipo: "salida" as const,
      fecha: s.fecha,
      detalle: `Salida de ${s.cantidad_piezas} pz / ${s.cantidad_tarimas} tar desde ${mapaUbicaciones.get(s.ubicacion_id) ?? "?"}${s.destino ? ` hacia ${s.destino}` : ""}${detalleLogistico(s)}`,
    })),
    ...(movimientosInternos ?? []).map((m) => ({
      tipo: "movimiento" as const,
      fecha: m.created_at,
      detalle: `Reubicación de ${m.cantidad_piezas} pz / ${m.cantidad_tarimas} tar: ${mapaUbicaciones.get(m.ubicacion_origen_id) ?? "?"} → ${mapaUbicaciones.get(m.ubicacion_destino_id) ?? "?"}`,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const dias = diasDesde(lote.fecha_ingreso);
  const qrDataUrl = await generarQrDataUrl(lote.qr_payload);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold text-ink">{lote.codigo_lote}</h1>
            <Badge tone={lote.estado === "activo" ? "ok" : "neutral"}>
              {lote.estado === "activo" ? "Activo" : "Agotado"}
            </Badge>
            <Badge tone={tonoPorDias(dias)}>{dias} días almacenado</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {producto?.nombre ?? "—"} · <span className="font-mono">{producto?.sku}</span> ·{" "}
            {producto?.clientes?.nombre ?? "—"}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Existencia actual</h2>
            <div className="flex flex-col gap-2">
              {(existencias ?? []).map((ex) => {
                const u = (ex as unknown as { ubicaciones: Pick<Ubicacion, "codigo" | "zona"> | null })
                  .ubicaciones;
                return (
                  <div
                    key={ex.id}
                    className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5 text-sm"
                  >
                    <span className="font-mono text-ink">{u?.codigo ?? "—"}</span>
                    <span className="tabular-nums text-ink-soft">
                      {ex.cantidad_piezas} pz · {ex.cantidad_tarimas} tar
                    </span>
                  </div>
                );
              })}
              {(existencias ?? []).length === 0 && (
                <p className="flex items-center gap-2 text-sm text-ink-faint">
                  <Package size={16} /> Sin existencia registrada.
                </p>
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Historial del lote</h2>
            <ol className="flex flex-col gap-3">
              {movimientos.map((m, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <Badge
                    tone={m.tipo === "entrada" ? "ok" : m.tipo === "salida" ? "crit" : "info"}
                  >
                    {m.tipo}
                  </Badge>
                  <div>
                    <p className="text-ink">{m.detalle}</p>
                    <p className="text-xs text-ink-faint">{formatearFechaHora(m.fecha)}</p>
                  </div>
                </li>
              ))}
              {movimientos.length === 0 && (
                <p className="text-sm text-ink-faint">Sin movimientos todavía.</p>
              )}
            </ol>
          </Card>

          {(fotos.length > 0 || documentos.length > 0) && (
            <Card className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-ink">Fotografías y documentos</h2>
              {fotos.length > 0 && (
                <div className="mb-4 flex flex-wrap gap-3">
                  {fotos.map((f) => (
                    <a key={f.id} href={urlPublica(supabase, "documentos", f.storage_path)} target="_blank">
                      <Image
                        src={urlPublica(supabase, "documentos", f.storage_path)}
                        alt=""
                        width={80}
                        height={80}
                        className="size-20 rounded-lg border border-line object-cover"
                      />
                    </a>
                  ))}
                </div>
              )}
              {documentos.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {documentos.map((d) => (
                    <li key={d.id}>
                      <a
                        href={urlPublica(supabase, "documentos", d.storage_path)}
                        target="_blank"
                        className="text-sm text-accent hover:underline"
                      >
                        {d.nombre_archivo ?? d.storage_path}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card className="flex flex-col items-center p-5 text-center">
            {/* Fondo blanco fijo (no depende del tema): un QR necesita
                contraste constante para escanear y, eventualmente, imprimirse
                en una etiqueta. Generado en servidor con `qrcode`, por eso es
                una imagen embebida y no pasa por next/image. */}
            <div className="rounded-lg bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrDataUrl} alt={`QR del lote ${lote.codigo_lote}`} width={220} height={220} />
            </div>
            <p className="mt-2 text-xs text-ink-faint">Escanéalo desde Inventario → Escanear</p>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-ink">Detalle</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Ingreso</dt>
                <dd className="text-ink">{formatearFecha(lote.fecha_ingreso)}</dd>
              </div>
              {lote.fecha_caducidad && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink-faint">Caducidad</dt>
                  <dd className="text-ink">{formatearFecha(lote.fecha_caducidad)}</dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-ink-faint">Ingreso inicial</dt>
                <dd className="tabular-nums text-ink">
                  {lote.piezas_inicial} pz · {lote.tarimas_inicial} tar
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
