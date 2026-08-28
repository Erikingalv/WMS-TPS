import { FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CompartirComprobante } from "@/components/comprobantes/CompartirComprobante";
import { formatearNumero } from "@/lib/utils/numeros";
import type { Cliente, Producto } from "@/lib/types/database";

type FilaResumen = {
  id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre" | "sku"> | null;
  lotes: { codigo_lote: string } | null;
};

// Solo se llega aquí cuando el embarque tuvo al menos un producto que no
// se pudo registrar — si todo salió bien, el comprobante (individual o
// consolidado, según tenga hermanos en su grupo) se abre directo desde la
// página del lote, sin pasar por aquí.
export default async function RegistroMultipleEntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;

  const ids = (ok ?? "")
    .split(",")
    .filter(Boolean)
    .map((par) => par.split(":")[0]);
  const errores = (error ?? "").split(" | ").filter(Boolean);

  const supabase = await createClient();
  const { data: entradasRaw } =
    ids.length > 0
      ? await supabase
          .from("entradas")
          .select("id, cantidad_piezas, cantidad_tarimas, clientes(nombre), productos(nombre, sku), lotes(codigo_lote)")
          .in("id", ids)
      : { data: [] as FilaResumen[] };
  const entradas = (entradasRaw ?? []) as unknown as FilaResumen[];

  const total = ids.length + errores.length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Entradas del embarque</h1>
        <p className="mt-1 text-sm text-ink-soft">
          {entradas.length} de {total} producto{total === 1 ? "" : "s"} se registraron correctamente.
        </p>
      </div>

      {errores.length > 0 && (
        <div className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
          <p className="mb-1 font-semibold">No se pudieron registrar:</p>
          <ul className="list-disc pl-5">
            {errores.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {entradas.length > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Comprobante</p>
            <p className="text-xs text-ink-faint">
              {entradas.length > 1
                ? `Un solo documento con los ${entradas.length} productos que sí se registraron.`
                : "Del producto que se registró."}
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink href={`/api/comprobante/entrada/${entradas[0].id}`} variant="secondary">
              <FileDown size={16} /> Descargar PDF
            </ButtonLink>
            <CompartirComprobante
              url={`/api/comprobante/entrada/${entradas[0].id}`}
              archivoNombre={
                entradas.length > 1 ? "comprobante-entrada-consolidado.pdf" : `comprobante-entrada-${entradas[0].lotes?.codigo_lote ?? entradas[0].id}.pdf`
              }
            />
          </div>
        </Card>
      )}

      {entradas.length > 0 && (
        <div className="flex flex-col gap-3">
          {entradas.map((e) => (
            <Card key={e.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  {e.clientes?.nombre ?? "—"} · {e.productos?.nombre ?? "—"}{" "}
                  <span className="font-mono text-xs text-ink-faint">({e.productos?.sku})</span>
                </p>
                <p className="text-xs text-ink-faint">
                  {formatearNumero(e.cantidad_piezas)} pz · {formatearNumero(e.cantidad_tarimas)} tar · lote{" "}
                  <span className="font-mono">{e.lotes?.codigo_lote ?? "—"}</span>
                </p>
              </div>
              <ButtonLink href={`/lotes/${e.lotes?.codigo_lote ?? ""}`} variant="secondary" size="sm">
                Ver lote
              </ButtonLink>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <ButtonLink href="/entradas/nueva">Registrar otro embarque</ButtonLink>
        <ButtonLink href="/entradas" variant="secondary">
          Ir a Entradas
        </ButtonLink>
      </div>
    </div>
  );
}
