import { Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import type { Cliente, Producto, Lote, Ubicacion } from "@/lib/types/database";

type EntradaFila = {
  id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre"> | null;
  lotes: Pick<Lote, "codigo_lote"> | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

export default async function EntradasPage({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string }>;
}) {
  const { desde, hasta } = await searchParams;
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeCrear = usuario ? tienePermiso(usuario.rol, PUEDE_EDITAR_CLIENTES) : false;
  const filtrado = Boolean(desde || hasta);

  let query = supabase
    .from("entradas")
    .select(
      "id, fecha, cantidad_piezas, cantidad_tarimas, clientes(nombre), productos(nombre), lotes(codigo_lote), ubicaciones(codigo)"
    )
    .order("fecha", { ascending: false });
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (!filtrado) query = query.limit(100);
  const { data } = await query;
  const entradas = (data ?? []) as unknown as EntradaFila[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Entradas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {filtrado
              ? `Mostrando entradas ${desde ? `desde ${formatearFecha(desde)}` : ""}${hasta ? ` hasta ${formatearFecha(hasta)}` : ""} · `
              : "Últimos 100 movimientos"}
            {filtrado && (
              <Link href="/entradas" className="text-accent hover:underline">
                ver todas
              </Link>
            )}
          </p>
        </div>
        {puedeCrear && (
          <ButtonLink href="/entradas/nueva">
            <Plus size={17} /> Nueva entrada
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Ubicación</th>
            </tr>
          </thead>
          <tbody>
            {entradas.map((e) => (
              <tr key={e.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3 text-ink-soft">{formatearFechaHora(e.fecha)}</td>
                <td className="px-4 py-3 text-ink">{e.clientes?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-ink-soft">{e.productos?.nombre ?? "—"}</td>
                <td className="px-4 py-3">
                  <a
                    href={e.lotes ? `/lotes/${e.lotes.codigo_lote}` : undefined}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {e.lotes?.codigo_lote ?? "—"}
                  </a>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {e.cantidad_piezas} pz · {e.cantidad_tarimas} tar
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                  {e.ubicaciones?.codigo ?? "—"}
                </td>
              </tr>
            ))}
            {entradas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay entradas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
