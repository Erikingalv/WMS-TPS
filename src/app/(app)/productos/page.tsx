import Image from "next/image";
import { Plus, Package } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { PUEDE_EDITAR_PRODUCTOS, tienePermiso } from "@/lib/auth/permisos";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import type { Producto } from "@/lib/types/database";

type ProductoConCliente = Producto & { clientes: { nombre: string } | null };

export default async function ProductosPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const puedeEditar = usuario
    ? tienePermiso(usuario.rol, PUEDE_EDITAR_PRODUCTOS)
    : false;

  const { data } = await supabase
    .from("productos")
    .select("*, clientes(nombre)")
    .order("nombre");
  const productos = (data ?? []) as unknown as ProductoConCliente[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Productos</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {productos.length} registrados
          </p>
        </div>
        {puedeEditar && (
          <ButtonLink href="/productos/nuevo">
            <Plus size={17} /> Nuevo producto
          </ButtonLink>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-paper-raised">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs font-semibold uppercase tracking-wide text-ink-faint">
              <th className="px-4 py-3">Producto</th>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {productos.map((producto) => (
              <tr
                key={producto.id}
                className="border-b border-line last:border-0 hover:bg-accent-soft/40"
              >
                <td className="px-4 py-3">
                  <a
                    href={puedeEditar ? `/productos/${producto.id}` : undefined}
                    className="flex items-center gap-3"
                  >
                    {producto.foto_url ? (
                      <Image
                        src={producto.foto_url}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 rounded-md border border-line object-cover"
                      />
                    ) : (
                      <span className="flex size-9 items-center justify-center rounded-md border border-dashed border-line text-ink-faint">
                        <Package size={16} />
                      </span>
                    )}
                    <span
                      className={
                        puedeEditar
                          ? "font-medium text-ink hover:text-accent"
                          : "font-medium text-ink"
                      }
                    >
                      {producto.nombre}
                    </span>
                  </a>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink-soft">
                  {producto.sku}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {producto.clientes?.nombre ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={producto.activo ? "ok" : "neutral"}>
                    {producto.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </td>
              </tr>
            ))}
            {productos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-ink-faint">
                  Aún no hay productos registrados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
