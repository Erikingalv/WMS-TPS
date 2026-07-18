import Image from "next/image";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { Cliente, Producto } from "@/lib/types/database";

export function ProductoForm({
  action,
  producto,
  clientes,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  producto?: Producto;
  clientes: Cliente[];
  error?: string;
}) {
  return (
    <form
      action={action}
      encType="multipart/form-data"
      className="flex max-w-2xl flex-col gap-5"
    >
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">
          {error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Cliente"
          name="cliente_id"
          required
          defaultValue={producto?.cliente_id ?? ""}
        >
          <option value="" disabled>
            Selecciona un cliente
          </option>
          {clientes.map((cliente) => (
            <option key={cliente.id} value={cliente.id}>
              {cliente.nombre}
            </option>
          ))}
        </Select>
        <Input
          label="SKU"
          name="sku"
          required
          defaultValue={producto?.sku}
          placeholder="Único por cliente"
        />
      </div>

      <Input
        label="Nombre"
        name="nombre"
        required
        defaultValue={producto?.nombre}
      />

      <Textarea
        label="Descripción"
        name="descripcion"
        defaultValue={producto?.descripcion ?? ""}
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Unidad"
          name="unidad"
          defaultValue={producto?.unidad ?? "pieza"}
          placeholder="pieza, caja, kg…"
        />
        <Input
          label="Código de barras"
          name="codigo_barras"
          defaultValue={producto?.codigo_barras ?? ""}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-4">
        <Input
          label="Peso (kg)"
          name="peso_kg"
          type="number"
          step="0.001"
          min="0"
          defaultValue={producto?.peso_kg ?? ""}
        />
        <Input
          label="Largo (cm)"
          name="largo_cm"
          type="number"
          step="0.01"
          min="0"
          defaultValue={producto?.largo_cm ?? ""}
        />
        <Input
          label="Ancho (cm)"
          name="ancho_cm"
          type="number"
          step="0.01"
          min="0"
          defaultValue={producto?.ancho_cm ?? ""}
        />
        <Input
          label="Alto (cm)"
          name="alto_cm"
          type="number"
          step="0.01"
          min="0"
          defaultValue={producto?.alto_cm ?? ""}
        />
      </div>

      <div className="flex items-end gap-4">
        {producto?.foto_url && (
          <Image
            src={producto.foto_url}
            alt=""
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-lg border border-line object-cover"
          />
        )}
        <div className="flex-1">
          <Input
            label={producto?.foto_url ? "Reemplazar fotografía" : "Fotografía"}
            name="foto"
            type="file"
            accept="image/*"
            capture="environment"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Subiendo…">
          {producto ? "Guardar cambios" : "Crear producto"}
        </SubmitButton>
        <ButtonLink href="/productos" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
