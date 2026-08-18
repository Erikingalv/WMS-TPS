import { FileDown } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { CompartirComprobante } from "@/components/comprobantes/CompartirComprobante";
import type { Cliente, Producto } from "@/lib/types/database";

type FilaResumen = {
  id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre" | "sku"> | null;
  lotes: { codigo_lote: string } | null;
};

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

      {entradas.length > 1 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">Comprobante consolidado</p>
            <p className="text-xs text-ink-faint">
              Un solo PDF con los {entradas.length} productos de este embarque, en vez de uno por cada uno.
            </p>
          </div>
          <div className="flex gap-2">
            <ButtonLink
              href={`/api/comprobante/consolidado/entrada?ids=${entradas.map((e) => e.id).join(",")}`}
              variant="secondary"
            >
              <FileDown size={16} /> Descargar PDF
            </ButtonLink>
            <CompartirComprobante
              url={`/api/comprobante/consolidado/entrada?ids=${entradas.map((e) => e.id).join(",")}`}
              archivoNombre="comprobante-entrada-consolidado.pdf"
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
                  {e.cantidad_piezas} pz · {e.cantidad_tarimas} tar · lote{" "}
                  <span className="font-mono">{e.lotes?.codigo_lote ?? "—"}</span>
                </p>
              </div>
              <ButtonLink href={`/comprobantes/entrada/${e.id}`} variant="secondary" size="sm">
                Ver comprobante individual
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
