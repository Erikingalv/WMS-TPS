import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_GESTIONAR_AUDITORIAS, tienePermiso } from "@/lib/auth/permisos";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConteoRow } from "@/components/auditorias/ConteoRow";
import { formatearFechaHora } from "@/lib/utils/dates";
import { cerrarAuditoria } from "@/app/(app)/auditorias/actions";
import type { Cliente, Lote, Producto, Ubicacion } from "@/lib/types/database";

type DetalleFila = {
  id: string;
  cantidad_sistema_piezas: number;
  cantidad_sistema_tarimas: number;
  cantidad_fisica_piezas: number | null;
  cantidad_fisica_tarimas: number | null;
  diferencia_piezas: number | null;
  diferencia_tarimas: number | null;
  lotes: (Pick<Lote, "codigo_lote"> & {
    productos: (Pick<Producto, "nombre"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
  }) | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

export default async function AuditoriaDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuarioActual = await getUsuarioActual();
  const puedeGestionar = usuarioActual
    ? tienePermiso(usuarioActual.rol, PUEDE_GESTIONAR_AUDITORIAS)
    : false;

  const [{ data: auditoria }, { data: detalleRaw }] = await Promise.all([
    supabase.from("auditorias").select("*, usuarios(nombre)").eq("id", id).single(),
    supabase
      .from("auditoria_detalle")
      .select(
        "id, cantidad_sistema_piezas, cantidad_sistema_tarimas, cantidad_fisica_piezas, cantidad_fisica_tarimas, diferencia_piezas, diferencia_tarimas, lotes(codigo_lote, productos(nombre, clientes(nombre))), ubicaciones(codigo)"
      )
      .eq("auditoria_id", id),
  ]);

  if (!auditoria) notFound();
  const detalle = (detalleRaw ?? []) as unknown as DetalleFila[];

  const cerrada = auditoria.estado === "cerrada";
  const sinContar = detalle.filter((d) => d.cantidad_fisica_piezas === null).length;
  const conDiferencia = detalle.filter(
    (d) => (d.diferencia_piezas ?? 0) !== 0 || (d.diferencia_tarimas ?? 0) !== 0
  ).length;

  const cerrarConId = async () => {
    "use server";
    await cerrarAuditoria(id);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-ink">
              Auditoría del {formatearFechaHora(auditoria.fecha_inicio)}
            </h1>
            <Badge tone={cerrada ? "neutral" : "info"}>{cerrada ? "Cerrada" : "En proceso"}</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            Responsable: {(auditoria as unknown as { usuarios: { nombre: string } | null }).usuarios?.nombre ?? "—"}
            {" · "}
            {detalle.length} renglones · {sinContar} sin contar · {conDiferencia} con diferencia
          </p>
        </div>
        {!cerrada && puedeGestionar && (
          <form action={cerrarConId}>
            <Button type="submit" variant="danger">
              Cerrar auditoría
            </Button>
          </form>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Cliente / Producto</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Sistema</th>
              <th className="px-4 py-3">Físico</th>
              <th className="px-4 py-3">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {detalle.map((d) => {
              const hayDiferencia = (d.diferencia_piezas ?? 0) !== 0 || (d.diferencia_tarimas ?? 0) !== 0;
              return (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <a
                      href={d.lotes ? `/lotes/${d.lotes.codigo_lote}` : undefined}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {d.lotes?.codigo_lote ?? "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {d.lotes?.productos?.clientes?.nombre ?? "—"}
                    <span className="block text-xs text-ink-faint">{d.lotes?.productos?.nombre}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {d.ubicaciones?.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">
                    {d.cantidad_sistema_piezas} pz · {d.cantidad_sistema_tarimas} tar
                  </td>
                  <td className="px-4 py-3">
                    <ConteoRow
                      detalleId={d.id}
                      piezasIniciales={d.cantidad_fisica_piezas}
                      tarimasIniciales={d.cantidad_fisica_tarimas}
                      disabled={cerrada || !puedeGestionar}
                    />
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {d.cantidad_fisica_piezas === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <Badge tone={hayDiferencia ? "crit" : "ok"}>
                        {d.diferencia_piezas! >= 0 ? "+" : ""}
                        {d.diferencia_piezas} pz · {d.diferencia_tarimas! >= 0 ? "+" : ""}
                        {d.diferencia_tarimas} tar
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
            {detalle.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-faint">
                  Esta auditoría no tiene renglones (no había existencia al iniciarla).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
