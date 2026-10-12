import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import type { FiltrosMovimientos as Filtros } from "@/lib/filtrosMovimientos";
import type { Cliente, Producto, Ubicacion } from "@/lib/types/database";

// Mismos filtros que la página de Inventario, para Entradas y Salidas.
export function FiltrosMovimientos({
  rutaLimpiar,
  filtros,
  clientes,
  productos,
  ubicaciones,
  etiquetaUbicacion,
}: {
  rutaLimpiar: string;
  filtros: Filtros;
  clientes: Pick<Cliente, "id" | "nombre">[];
  productos: Pick<Producto, "id" | "nombre">[];
  ubicaciones: Pick<Ubicacion, "id" | "codigo">[];
  etiquetaUbicacion: string;
}) {
  return (
    <form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <Select label="Cliente" name="cliente_id" defaultValue={filtros.cliente_id ?? ""}>
        <option value="">Todos</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nombre}
          </option>
        ))}
      </Select>
      <Select label="Producto" name="producto_id" defaultValue={filtros.producto_id ?? ""}>
        <option value="">Todos</option>
        {productos.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nombre}
          </option>
        ))}
      </Select>
      <Select label={etiquetaUbicacion} name="ubicacion_id" defaultValue={filtros.ubicacion_id ?? ""}>
        <option value="">Todas</option>
        {ubicaciones.map((u) => (
          <option key={u.id} value={u.id}>
            {u.codigo}
          </option>
        ))}
      </Select>
      <Input label="Lote" name="lote" defaultValue={filtros.lote ?? ""} placeholder="L-260718…" />
      <Input label="BL" name="bl" defaultValue={filtros.bl ?? ""} placeholder="4910…" />
      <Input label="Desde" name="desde" type="date" defaultValue={filtros.desde ?? ""} />
      <Input label="Hasta" name="hasta" type="date" defaultValue={filtros.hasta ?? ""} />
      <div className="flex gap-2">
        <Button type="submit">Filtrar</Button>
        <Button type="submit" variant="secondary" formAction={rutaLimpiar}>
          Limpiar
        </Button>
      </div>
    </form>
  );
}
