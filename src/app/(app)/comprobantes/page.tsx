import Link from "next/link";
import { FileSignature, PenLine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { formatearFechaHora } from "@/lib/utils/dates";
import { formatearNumero } from "@/lib/utils/numeros";
import type { Cliente, Lote, Producto } from "@/lib/types/database";

type FilaRaw = {
  tipo: "entrada" | "salida";
  id: string;
  grupo_id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  firmado: boolean;
  cliente: string;
  producto: string;
  codigo_lote: string;
  numero_bl: string | null;
};

type FilaComprobante = {
  tipo: "entrada" | "salida";
  id: string;
  fecha: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  firmado: boolean;
  cliente: string;
  producto: string;
  codigo_lote: string;
  blTexto: string;
  numProductos: number;
};

function unicos(valores: (string | null | undefined)[]): string[] {
  return Array.from(new Set(valores.filter((v): v is string => !!v)));
}

function agruparPorMovimiento(filas: FilaRaw[]): FilaComprobante[] {
  const grupos = new Map<string, FilaRaw[]>();
  for (const f of filas) {
    const clave = `${f.tipo}:${f.grupo_id}`;
    const lista = grupos.get(clave) ?? [];
    lista.push(f);
    grupos.set(clave, lista);
  }

  return Array.from(grupos.values()).map((lineas) => {
    const primera = lineas[0];
    return {
      tipo: primera.tipo,
      id: primera.id,
      fecha: primera.fecha,
      cantidad_piezas: lineas.reduce((s, l) => s + l.cantidad_piezas, 0),
      cantidad_tarimas: lineas.reduce((s, l) => s + l.cantidad_tarimas, 0),
      firmado: primera.firmado,
      cliente: unicos(lineas.map((l) => l.cliente)).join(", ") || "—",
      producto: lineas.length === 1 ? primera.producto : `${lineas.length} productos`,
      codigo_lote: lineas.length === 1 ? primera.codigo_lote : `${lineas.length} lotes`,
      blTexto: unicos(lineas.map((l) => l.numero_bl)).join(", ") || "—",
      numProductos: lineas.length,
    };
  });
}

export default async function ComprobantesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; firma?: string }>;
}) {
  const { tipo, firma } = await searchParams;
  const supabase = await createClient();

  type Raw = {
    id: string;
    grupo_id: string;
    fecha: string;
    cantidad_piezas: number;
    cantidad_tarimas: number;
    firma_digital_url: string | null;
    numero_bl: string | null;
    clientes: Pick<Cliente, "nombre"> | null;
    productos: Pick<Producto, "nombre"> | null;
    lotes: Pick<Lote, "codigo_lote"> | null;
  };

  const [{ data: entradas }, { data: salidas }] = await Promise.all([
    tipo === "salidas"
      ? Promise.resolve({ data: [] as Raw[] })
      : supabase
          .from("entradas")
          .select(
            "id, grupo_id, fecha, cantidad_piezas, cantidad_tarimas, firma_digital_url, numero_bl, clientes(nombre), productos(nombre), lotes(codigo_lote)"
          )
          .order("fecha", { ascending: false })
          .limit(300),
    tipo === "entradas"
      ? Promise.resolve({ data: [] as Raw[] })
      : supabase
          .from("salidas")
          .select(
            "id, grupo_id, fecha, cantidad_piezas, cantidad_tarimas, firma_digital_url, numero_bl, clientes(nombre), productos(nombre), lotes(codigo_lote)"
          )
          .order("fecha", { ascending: false })
          .limit(300),
  ]);

  const filasRaw: FilaRaw[] = [
    ...((entradas ?? []) as unknown as Raw[]).map((e) => ({
      tipo: "entrada" as const,
      id: e.id,
      grupo_id: e.grupo_id,
      fecha: e.fecha,
      cantidad_piezas: e.cantidad_piezas,
      cantidad_tarimas: e.cantidad_tarimas,
      firmado: e.firma_digital_url != null,
      cliente: e.clientes?.nombre ?? "—",
      producto: e.productos?.nombre ?? "—",
      codigo_lote: e.lotes?.codigo_lote ?? "—",
      numero_bl: e.numero_bl,
    })),
    ...((salidas ?? []) as unknown as Raw[]).map((s) => ({
      tipo: "salida" as const,
      id: s.id,
      grupo_id: s.grupo_id,
      fecha: s.fecha,
      cantidad_piezas: s.cantidad_piezas,
      cantidad_tarimas: s.cantidad_tarimas,
      firmado: s.firma_digital_url != null,
      cliente: s.clientes?.nombre ?? "—",
      producto: s.productos?.nombre ?? "—",
      codigo_lote: s.lotes?.codigo_lote ?? "—",
      numero_bl: s.numero_bl,
    })),
  ];

  let filas = agruparPorMovimiento(filasRaw).sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  if (firma === "pendientes") filas = filas.filter((f) => !f.firmado);
  if (firma === "firmados") filas = filas.filter((f) => f.firmado);

  function filtroUrl(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const actual = { tipo, firma, ...cambios };
    if (actual.tipo) params.set("tipo", actual.tipo);
    if (actual.firma) params.set("firma", actual.firma);
    const qs = params.toString();
    return `/comprobantes${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Comprobantes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Consulta y firma digitalmente los comprobantes de entrada y salida desde cualquier
          dispositivo.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { label: "Todos", key: "tipo", value: undefined },
          { label: "Entradas", key: "tipo", value: "entradas" },
          { label: "Salidas", key: "tipo", value: "salidas" },
        ].map((f) => (
          <Link
            key={f.label}
            href={filtroUrl({ tipo: f.value })}
            className={`rounded-lg px-3 py-1.5 ${
              tipo === f.value || (!tipo && !f.value)
                ? "bg-accent-soft text-accent"
                : "text-ink-soft hover:bg-accent-soft"
            }`}
          >
            {f.label}
          </Link>
        ))}
        <span className="mx-1 text-ink-faint">·</span>
        {[
          { label: "Todos", value: undefined },
          { label: "Pendientes de firma", value: "pendientes" },
          { label: "Firmados", value: "firmados" },
        ].map((f) => (
          <Link
            key={f.label}
            href={filtroUrl({ firma: f.value })}
            className={`rounded-lg px-3 py-1.5 ${
              firma === f.value || (!firma && !f.value)
                ? "bg-accent-soft text-accent"
                : "text-ink-soft hover:bg-accent-soft"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {filas.map((f) => (
          <Link
            key={`${f.tipo}:${f.id}`}
            href={`/comprobantes/${f.tipo}/${f.id}`}
            className="flex items-center gap-3 rounded-lg border border-line bg-paper-raised px-4 py-3 transition-colors hover:border-accent"
          >
            <Badge tone={f.tipo === "entrada" ? "ok" : "crit"}>{f.tipo}</Badge>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink">
                {f.cliente} · {f.producto} ·{" "}
                <span className="font-mono text-xs text-ink-soft">{f.codigo_lote}</span> ·{" "}
                <span className="font-mono text-xs text-ink-soft">BL {f.blTexto}</span>
                {f.numProductos > 1 && (
                  <>
                    {" "}
                    <Badge tone="info">consolidado</Badge>
                  </>
                )}
              </p>
              <p className="text-xs text-ink-faint">
                {formatearFechaHora(f.fecha)} · {formatearNumero(f.cantidad_piezas)} pz / {formatearNumero(f.cantidad_tarimas)} tar
              </p>
            </div>
            {f.firmado ? (
              <Badge tone="ok">
                <span className="inline-flex items-center gap-1">
                  <FileSignature size={12} /> Firmado
                </span>
              </Badge>
            ) : (
              <Badge tone="warn">
                <span className="inline-flex items-center gap-1">
                  <PenLine size={12} /> Pendiente
                </span>
              </Badge>
            )}
          </Link>
        ))}
        {filas.length === 0 && (
          <p className="rounded-xl border border-line bg-paper-raised px-4 py-10 text-center text-ink-faint">
            No hay comprobantes que coincidan con el filtro.
          </p>
        )}
      </div>
    </div>
  );
}
