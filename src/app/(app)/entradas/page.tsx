import { Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFecha, formatearFechaHora } from "@/lib/utils/dates";
import type { Cliente, Producto, Lote, Ubicacion } from "@/lib/types/database";

type EntradaFila = {
  id: string;
  grupo_id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre"> | null;
  lotes: Pick<Lote, "codigo_lote"> | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
};

type GrupoEntrada = {
  id: string; // de la primera línea — a dónde apunta el comprobante del grupo
  fecha: string;
  clientes: string;
  productos: string;
  lotesTexto: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  ubicaciones: string;
  numProductos: number;
};

function unicos(valores: (string | undefined)[]): string[] {
  return Array.from(new Set(valores.filter((v): v is string => !!v)));
}

function agruparPorMovimiento(entradas: EntradaFila[]): GrupoEntrada[] {
  const grupos = new Map<string, EntradaFila[]>();
  for (const e of entradas) {
    const lista = grupos.get(e.grupo_id) ?? [];
    lista.push(e);
    grupos.set(e.grupo_id, lista);
  }

  return Array.from(grupos.values()).map((lineas) => {
    const primera = lineas[0];
    return {
      id: primera.id,
      fecha: primera.fecha,
      clientes: unicos(lineas.map((l) => l.clientes?.nombre)).join(", ") || "—",
      productos:
        lineas.length === 1
          ? (primera.productos?.nombre ?? "—")
          : `${lineas.length} productos`,
      lotesTexto:
        lineas.length === 1
          ? (primera.lotes?.codigo_lote ?? "—")
          : `${lineas.length} lotes`,
      cantidad_piezas: lineas.reduce((s, l) => s + l.cantidad_piezas, 0),
      cantidad_tarimas: lineas.reduce((s, l) => s + l.cantidad_tarimas, 0),
      ubicaciones: unicos(lineas.map((l) => l.ubicaciones?.codigo)).join(", ") || "—",
      numProductos: lineas.length,
    };
  });
}

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
      "id, grupo_id, fecha, cantidad_piezas, cantidad_tarimas, clientes(nombre), productos(nombre), lotes(codigo_lote), ubicaciones(codigo)"
    )
    .order("fecha", { ascending: false });
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  if (!filtrado) query = query.limit(200);
  const { data } = await query;
  const entradas = (data ?? []) as unknown as EntradaFila[];
  const movimientos = agruparPorMovimiento(entradas).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Entradas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {filtrado
              ? `Mostrando entradas ${desde ? `desde ${formatearFecha(desde)}` : ""}${hasta ? ` hasta ${formatearFecha(hasta)}` : ""} · `
              : "Últimos movimientos"}
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
        <table className="w-full min-w-[760px] text-sm">
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
            {movimientos.map((m) => (
              <tr key={m.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                <td className="px-4 py-3 text-ink-soft">{formatearFechaHora(m.fecha)}</td>
                <td className="px-4 py-3 text-ink">{m.clientes}</td>
                <td className="px-4 py-3 text-ink-soft">
                  <span className="inline-flex items-center gap-2">
                    {m.productos}
                    {m.numProductos > 1 && <Badge tone="info">consolidado</Badge>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`/comprobantes/entrada/${m.id}`}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {m.lotesTexto}
                  </a>
                </td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {m.cantidad_piezas} pz · {m.cantidad_tarimas} tar
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.ubicaciones}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
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
