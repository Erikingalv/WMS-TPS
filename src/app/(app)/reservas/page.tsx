import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_CLIENTES, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink, Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatearFechaHora } from "@/lib/utils/dates";
import { liberarReserva } from "@/app/(app)/reservas/actions";
import type { Cliente, Lote, Producto, Ubicacion, Usuario } from "@/lib/types/database";

type ReservaFila = {
  id: string;
  cantidad_piezas: number;
  cantidad_tarimas: number;
  fecha_reserva: string;
  estado: "activa" | "liberada" | "consumida";
  observaciones: string | null;
  lotes: (Pick<Lote, "codigo_lote"> & {
    productos: (Pick<Producto, "nombre"> & { clientes: Pick<Cliente, "nombre"> | null }) | null;
  }) | null;
  ubicaciones: Pick<Ubicacion, "codigo"> | null;
  usuarios: Pick<Usuario, "nombre"> | null;
};

export default async function ReservasPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeCrear = usuario ? tienePermiso(usuario.rol, PUEDE_EDITAR_CLIENTES) : false;

  const { data } = await supabase
    .from("reservas")
    .select(
      "id, cantidad_piezas, cantidad_tarimas, fecha_reserva, estado, observaciones, lotes(codigo_lote, productos(nombre, clientes(nombre))), ubicaciones(codigo), usuarios(nombre)"
    )
    .order("fecha_reserva", { ascending: false })
    .limit(100);
  const reservas = (data ?? []) as unknown as ReservaFila[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reservas</h1>
          <p className="mt-1 text-sm text-ink-soft">Inventario apartado para clientes</p>
        </div>
        {puedeCrear && (
          <ButtonLink href="/reservas/nueva">
            <Plus size={17} /> Nueva reserva
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Lote</th>
              <th className="px-4 py-3">Cliente / Producto</th>
              <th className="px-4 py-3">Ubicación</th>
              <th className="px-4 py-3">Cantidad</th>
              <th className="px-4 py-3">Reservó</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {reservas.map((r) => {
              const liberarConId = async () => {
                "use server";
                await liberarReserva(r.id);
              };
              return (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                  <td className="px-4 py-3">
                    <a
                      href={r.lotes ? `/lotes/${r.lotes.codigo_lote}` : undefined}
                      className="font-mono text-xs text-accent hover:underline"
                    >
                      {r.lotes?.codigo_lote ?? "—"}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {r.lotes?.productos?.clientes?.nombre ?? "—"}
                    <span className="block text-xs text-ink-faint">{r.lotes?.productos?.nombre}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                    {r.ubicaciones?.codigo ?? "—"}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-ink-soft">
                    {r.cantidad_piezas} pz · {r.cantidad_tarimas} tar
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {r.usuarios?.nombre ?? "—"}
                    <span className="block text-xs text-ink-faint">{formatearFechaHora(r.fecha_reserva)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={r.estado === "activa" ? "info" : "neutral"}>{r.estado}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    {r.estado === "activa" && puedeCrear && (
                      <form action={liberarConId}>
                        <Button type="submit" variant="secondary" size="sm">
                          Liberar
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {reservas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay reservas registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
