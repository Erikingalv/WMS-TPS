import { Plus } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { formatearFechaHora } from "@/lib/utils/dates";
import { formatearNumero } from "@/lib/utils/numeros";
import { FiltrosMovimientos } from "@/components/ui/FiltrosMovimientos";
import { filtrarPorMovimiento, hayFiltros, type FiltrosMovimientos as Filtros } from "@/lib/filtrosMovimientos";
import type { Cliente, Producto, Lote } from "@/lib/types/database";

type SalidaFila = {
  id: string;
  grupo_id: string;
  cliente_id: string;
  producto_id: string;
  ubicacion_id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  destino: string | null;
  numero_bl: string | null;
  clientes: Pick<Cliente, "nombre"> | null;
  productos: Pick<Producto, "nombre" | "sku"> | null;
  lotes: Pick<Lote, "codigo_lote"> | null;
};

type GrupoSalida = {
  id: string;
  fecha: string;
  clientes: string;
  productos: string;
  skuTexto: string;
  lotesTexto: string;
  blTexto: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  destino: string;
  numProductos: number;
};

function unicos(valores: (string | undefined | null)[]): string[] {
  return Array.from(new Set(valores.filter((v): v is string => !!v)));
}

function agruparPorMovimiento(salidas: SalidaFila[]): GrupoSalida[] {
  const grupos = new Map<string, SalidaFila[]>();
  for (const s of salidas) {
    const lista = grupos.get(s.grupo_id) ?? [];
    lista.push(s);
    grupos.set(s.grupo_id, lista);
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
      skuTexto: lineas.length === 1 ? (primera.productos?.sku ?? "—") : unicos(lineas.map((l) => l.productos?.sku)).join(", ") || "—",
      lotesTexto:
        lineas.length === 1
          ? (primera.lotes?.codigo_lote ?? "—")
          : `${lineas.length} lotes`,
      blTexto: unicos(lineas.map((l) => l.numero_bl)).join(", ") || "—",
      cantidad_piezas: lineas.reduce((s, l) => s + l.cantidad_piezas, 0),
      cantidad_tarimas: lineas.reduce((s, l) => s + l.cantidad_tarimas, 0),
      destino: unicos(lineas.map((l) => l.destino)).join(", ") || "—",
      numProductos: lineas.length,
    };
  });
}

export default async function SalidasPage({
  searchParams,
}: {
  searchParams: Promise<Filtros>;
}) {
  const filtros = await searchParams;
  const { desde, hasta } = filtros;
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeCrear = usuario ? tienePermiso(usuario.rol, PUEDE_EDITAR_CLIENTES) : false;
  const filtrado = hayFiltros(filtros);

  let query = supabase
    .from("salidas")
    .select(
      "id, grupo_id, cliente_id, producto_id, ubicacion_id, fecha, cantidad_piezas, cantidad_tarimas, destino, numero_bl, clientes(nombre), productos(nombre, sku), lotes(codigo_lote)"
    )
    .eq("es_traspaso", false) // los cambios de cliente no son movimientos reales
    .order("fecha", { ascending: false });
  if (desde) query = query.gte("fecha", desde);
  if (hasta) query = query.lte("fecha", `${hasta}T23:59:59`);
  query = query.limit(filtrado ? 1000 : 200);

  const [{ data }, { data: clientes }, { data: productos }, { data: ubicaciones }] = await Promise.all([
    query,
    supabase.from("clientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("productos").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("ubicaciones").select("id, codigo").eq("activo", true).order("codigo"),
  ]);
  const salidas = filtrarPorMovimiento((data ?? []) as unknown as SalidaFila[], filtros);
  const movimientos = agruparPorMovimiento(salidas).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Salidas</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {filtrado ? "Mostrando resultados filtrados · " : "Últimos movimientos"}
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

      <FiltrosMovimientos
        rutaLimpiar="/salidas"
        filtros={filtros}
        clientes={clientes ?? []}
        productos={productos ?? []}
        ubicaciones={ubicaciones ?? []}
        etiquetaUbicacion="Ubicación de origen"
      />

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">BL</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Destino</th>
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
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.skuTexto}</td>
                <td className="px-4 py-3">
                  <a
                    href={`/comprobantes/salida/${m.id}`}
                    className="font-mono text-xs text-accent hover:underline"
                  >
                    {m.lotesTexto}
                  </a>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">{m.blTexto}</td>
                <td className="px-4 py-3 tabular-nums text-ink-soft">
                  {formatearNumero(m.cantidad_piezas)} pz · {formatearNumero(m.cantidad_tarimas)} tar
                </td>
                <td className="px-4 py-3 text-ink-soft">{m.destino}</td>
              </tr>
            ))}
            {movimientos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-ink-faint">
                  {filtrado ? "Sin salidas que coincidan con el filtro." : "Aún no hay salidas registradas."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
