import { Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import type { Cliente, Producto, Lote } from "@/lib/types/database";

type SalidaFila = {
  id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  destino: string | null;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre"> | null;
  lotes: Pick<Lote, "codigo_lote"> | null;
};

export default async function SalidasPage({
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
    .from("salidas")
    .select(
      "id, fecha, cantidad_piezas, cantidad_tarimas, destino, clientes(nombre), productos(nombre), lotes(codigo_lote)"
    )
    .order("fecha", { ascending: false });
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (!filtrado) query = query.limit(100);
  const { data } = await query;
  const salidas = (data ?? []) as unknown as SalidaFila[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Salidas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {filtrado
              ? `Mostrando salidas ${desde ? `desde ${formatearFecha(desde)}` : ""}${hasta ? ` hasta ${formatearFecha(hasta)}` : ""} · `
              : "Últimos 100 movimientos"}
            {filtrado && (
              <Link href="/salidas" className="text-accent hover:underline">
                ver todas
              </Link>
            )}
          </p>
        </div>
        {puedeCrear && (
          <ButtonLink href="/salidas/nueva">
            <Plus size={17} /> Nueva salida
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
              <th className="px-4 py-3">Destino</th>
            </tr>
          </thead>
          <tbody>
            {salidas.map((s) => (
              <tr key={s.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3 text-ink-soft">{formatearFechaHora(s.fecha)}</td>
                <td className="px-4 py-3 text-ink">{s.clientes?.nombre ?? "—"}</td>
                <td className="px-4 py-3 text-ink-soft">{s.productos?.nombre ?? "—"}</td>
                <td className="px-4 py-3">
                  <a
                    href={s.lotes ? `/lotes/${s.lotes.codigo_lote}` : undefined}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {s.lotes?.codigo_lote ?? "—"}
                  </a>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {s.cantidad_piezas} pz · {s.cantidad_tarimas} tar
                </td>
                <td className="px-4 py-3 text-ink-soft">{s.destino ?? "—"}</td>
              </tr>
            ))}
            {salidas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay salidas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
