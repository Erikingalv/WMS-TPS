"use client";

import { useMemo, useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { diasDesde } from "@/lib/utils/dates";
import type { Cliente, Producto } from "@/lib/types/database";
import type { ExistenciaDisponible } from "@/components/salidas/SalidaForm";

export function ReservaForm({
  action,
  clientes,
  productos,
  disponibles,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  clientes: Cliente[];
  productos: Producto[];
  disponibles: ExistenciaDisponible[];
  error?: string;
}) {
  const [clienteId, setClienteId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [combo, setCombo] = useState("");

  const productosDelCliente = useMemo(
    () => productos.filter((p) => p.cliente_id === clienteId),
    [productos, clienteId]
  );

  const disponiblesDelProducto = useMemo(
    () => disponibles.filter((e) => e.producto_id === productoId),
    [disponibles, productoId]
  );

  const seleccionada = disponiblesDelProducto.find(
    (e) => `${e.lote_id}:${e.ubicacion_id}` === combo
  );

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Cliente"
          required
          value={clienteId}
          onChange={(e) => {
            setClienteId(e.target.value);
            setProductoId("");
            setCombo("");
          }}
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
          label="Producto"
          required
          disabled={!clienteId}
          value={productoId}
          onChange={(e) => {
            setProductoId(e.target.value);
            setCombo("");
          }}
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

      <Select
        label="Lote y ubicación a reservar"
        required
        disabled={!productoId}
        value={combo}
        onChange={(e) => setCombo(e.target.value)}
        hint="Solo se muestra lo que aún no está reservado por alguien más."
      >
        <option value="" disabled>
          {productoId ? "Selecciona un lote" : "Primero elige un producto"}
        </option>
        {disponiblesDelProducto.map((e) => (
          <option key={`${e.lote_id}:${e.ubicacion_id}`} value={`${e.lote_id}:${e.ubicacion_id}`}>
            {e.codigo_lote} · {e.ubicacion_codigo} · disponible {e.cantidad_piezas} pz / {e.cantidad_tarimas} tar ·{" "}
            {diasDesde(e.fecha_ingreso)} días
          </option>
        ))}
      </Select>

      <input type="hidden" name="lote_id" value={seleccionada?.lote_id ?? ""} />
      <input type="hidden" name="ubicacion_id" value={seleccionada?.ubicacion_id ?? ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Piezas a reservar"
          name="cantidad_piezas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_piezas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_piezas}` : undefined}
        />
        <Input
          label="Tarimas a reservar"
          name="cantidad_tarimas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_tarimas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_tarimas}` : undefined}
        />
      </div>

      <Textarea label="Observaciones" name="observaciones" placeholder="Para qué cliente/pedido es la reserva…" />

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Reservando…">Registrar reserva</SubmitButton>
        <ButtonLink href="/reservas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
