"use client";

import { useMemo, useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { SignaturePad } from "@/components/salidas/SignaturePad";
import { diasDesde } from "@/lib/utils/dates";
import type { ExistenciaDisponible } from "@/lib/inventario";
import type { Cliente, Producto, Usuario } from "@/lib/types/database";

export type { ExistenciaDisponible };

export function SalidaForm({
  action,
  clientes,
  productos,
  existencias,
  usuarios,
  fechaHoy,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  clientes: Cliente[];
  productos: Producto[];
  existencias: ExistenciaDisponible[];
  usuarios: Usuario[];
  fechaHoy: string;
  error?: string;
}) {
  const [clienteId, setClienteId] = useState("");
  const [productoId, setProductoId] = useState("");
  const [combo, setCombo] = useState("");

  const productosDelCliente = useMemo(
    () => productos.filter((p) => p.cliente_id === clienteId),
    [productos, clienteId]
  );

  const existenciasDelProducto = useMemo(
    () =>
      existencias
        .filter((e) => e.producto_id === productoId)
        .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime()),
    [existencias, productoId]
  );

  const seleccionada = existenciasDelProducto.find(
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
        label="Lote a surtir"
        name="combo"
        required
        disabled={!productoId}
        value={combo}
        onChange={(e) => setCombo(e.target.value)}
        hint="Se sugiere el lote más antiguo primero (FIFO); puedes elegir otro si lo justificas en observaciones."
      >
        <option value="" disabled>
          {productoId ? "Selecciona un lote" : "Primero elige un producto"}
        </option>
        {existenciasDelProducto.map((e, i) => (
          <option key={`${e.lote_id}:${e.ubicacion_id}`} value={`${e.lote_id}:${e.ubicacion_id}`}>
            {i === 0 ? "★ " : ""}
            {e.codigo_lote} · {e.ubicacion_codigo} · disp. {e.cantidad_piezas} pz / {e.cantidad_tarimas} tar ·{" "}
            {diasDesde(e.fecha_ingreso)} días
          </option>
        ))}
      </Select>

      <input type="hidden" name="lote_id" value={seleccionada?.lote_id ?? ""} />
      <input type="hidden" name="ubicacion_id" value={seleccionada?.ubicacion_id ?? ""} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Piezas"
          name="cantidad_piezas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_piezas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_piezas}` : undefined}
        />
        <Input
          label="Tarimas"
          name="cantidad_tarimas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_tarimas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_tarimas}` : undefined}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Fecha de salida" name="fecha" type="date" required defaultValue={fechaHoy} />
        <Input label="Hora de carga o descarga" name="hora_carga_descarga" type="time" required />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Destino" name="destino" />
        <Input label="Transportista" name="transportista" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input label="Placas" name="placas" />
        <Input label="Operador" name="operador" />
      </div>

      <Select label="Autorizó" name="autorizo_usuario_id" defaultValue="">
        <option value="">Sin especificar</option>
        {usuarios.map((u) => (
          <option key={u.id} value={u.id}>
            {u.nombre}
          </option>
        ))}
      </Select>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-ink">Datos logísticos (opcional)</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Cajas por pallet" name="cajas_por_pallet" type="number" min="1" />
          <Input label="Cantidad por caja" name="cantidad_por_caja" type="number" min="1" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Categoría de producto" name="categoria_producto" />
          <Input
            label="Presentación"
            name="presentacion"
            hint="Ej. cajas, atados, bultos…"
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Lote 1" name="lote_1" />
          <Input label="Lote 2" name="lote_2" />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Número de contenedor" name="numero_contenedor" />
          <Input label="Número de BL" name="numero_bl" />
        </div>
      </div>

      <Textarea label="Observaciones" name="observaciones" />

      <SignaturePad name="firma_digital_dataurl" />

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Registrando…">Registrar salida</SubmitButton>
        <ButtonLink href="/salidas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
