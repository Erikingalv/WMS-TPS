"use client";

import { useMemo, useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import type { Cliente, Producto, Ubicacion, Usuario } from "@/lib/types/database";

export function EntradaForm({
  action,
  clientes,
  productos,
  ubicaciones,
  usuarios,
  usuarioActualId,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  clientes: Cliente[];
  productos: Producto[];
  ubicaciones: Ubicacion[];
  usuarios: Usuario[];
  usuarioActualId?: string;
  error?: string;
}) {
  const [clienteId, setClienteId] = useState("");

  const productosDelCliente = useMemo(
    () => productos.filter((p) => p.cliente_id === clienteId),
    [productos, clienteId]
  );

  return (
    <form action={action} encType="multipart/form-data" className="flex max-w-2xl flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Cliente"
          name="cliente_id"
          required
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
        >
          <option value="" disabled>
            Selecciona un cliente
          </option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>

        <Select
          key={clienteId}
          label="Producto"
          name="producto_id"
          required
          disabled={!clienteId}
          defaultValue=""
        >
          <option value="" disabled>
            {clienteId ? "Selecciona un producto" : "Primero elige un cliente"}
          </option>
          {productosDelCliente.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Input label="Piezas" name="cantidad_piezas" type="number" min="1" required />
        <Input label="Tarimas" name="cantidad_tarimas" type="number" min="1" required />
        <Input label="Peso (kg)" name="peso_kg" type="number" step="0.001" min="0" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select label="Ubicación" name="ubicacion_id" required defaultValue="">
          <option value="" disabled>
            Selecciona una ubicación
          </option>
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo} {u.zona ? `· ${u.zona}` : ""}
            </option>
          ))}
        </Select>

        <Select label="Recibió" name="recibio_usuario_id" defaultValue={usuarioActualId ?? ""}>
          <option value="">Sin especificar</option>
          {usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </Select>
      </div>

      <Input
        label="Fecha de caducidad"
        name="fecha_caducidad"
        type="date"
        hint="Opcional — solo para productos perecederos (FEFO)"
      />

      <Textarea label="Observaciones" name="observaciones" />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Fotografías" name="fotos" type="file" accept="image/*" capture="environment" multiple />
        <Input
          label="Documentos"
          name="documentos"
          type="file"
          accept="image/*,application/pdf"
          multiple
          hint="Factura, carta porte, packing list, orden de compra…"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Registrando…">Registrar entrada</SubmitButton>
        <ButtonLink href="/entradas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
