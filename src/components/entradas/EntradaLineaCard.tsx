"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { TarimasParcialesEditor } from "@/components/entradas/TarimasParcialesEditor";
import type { Cliente, Producto, TarimaParcial, Ubicacion } from "@/lib/types/database";

export type LineaEntrada = {
  cliente_id: string;
  producto_id: string;
  cantidad_piezas: number | null;
  cantidad_tarimas: number | null;
  ubicacion_id: string;
  peso_kg: number | null;
  fecha_caducidad: string;
  tarima_desde: number | null;
  tarima_hasta: number | null;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
  categoria_producto: string;
  presentacion: string;
  lote_1: string;
  lote_2: string;
  tarimas_parciales: TarimaParcial[];
};

export function lineaEntradaVacia(): LineaEntrada {
  return {
    cliente_id: "",
    producto_id: "",
    cantidad_piezas: null,
    cantidad_tarimas: null,
    ubicacion_id: "",
    peso_kg: null,
    fecha_caducidad: "",
    tarima_desde: null,
    tarima_hasta: null,
    cajas_por_pallet: null,
    cantidad_por_caja: null,
    categoria_producto: "",
    presentacion: "",
    lote_1: "",
    lote_2: "",
    tarimas_parciales: [],
  };
}

export function EntradaLineaCard({
  indice,
  linea,
  clientes,
  productos,
  ubicaciones,
  onChange,
  onQuitar,
  puedeQuitar,
}: {
  indice: number;
  linea: LineaEntrada;
  clientes: Cliente[];
  productos: Producto[];
  ubicaciones: Ubicacion[];
  onChange: (cambios: Partial<LineaEntrada>) => void;
  onQuitar: () => void;
  puedeQuitar: boolean;
}) {
  const productosDelCliente = useMemo(
    () => productos.filter((p) => p.cliente_id === linea.cliente_id),
    [productos, linea.cliente_id]
  );

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Producto {indice + 1}</p>
        {puedeQuitar && (
          <button
            type="button"
            onClick={onQuitar}
            className="flex size-8 items-center justify-center rounded-md text-ink-faint hover:bg-crit-soft hover:text-crit"
            aria-label="Quitar este producto"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          id={`cliente-${indice}`}
          label="Cliente"
          required
          value={linea.cliente_id}
          onChange={(e) => onChange({ cliente_id: e.target.value, producto_id: "" })}
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
          id={`producto-${indice}`}
          key={linea.cliente_id}
          label="Producto"
          required
          disabled={!linea.cliente_id}
          value={linea.producto_id}
          onChange={(e) => onChange({ producto_id: e.target.value })}
        >
          <option value="" disabled>
            {linea.cliente_id ? "Selecciona un producto" : "Primero elige un cliente"}
          </option>
          {productosDelCliente.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.sku})
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <Input
          id={`piezas-${indice}`}
          label="Piezas"
          type="number"
          min="1"
          required
          value={linea.cantidad_piezas ?? ""}
          onChange={(e) => onChange({ cantidad_piezas: e.target.value === "" ? null : Number(e.target.value) })}
        />
        <Input
          id={`tarimas-${indice}`}
          label="Tarimas"
          type="number"
          min="1"
          required
          value={linea.cantidad_tarimas ?? ""}
          onChange={(e) => onChange({ cantidad_tarimas: e.target.value === "" ? null : Number(e.target.value) })}
        />
        <Input
          id={`peso-${indice}`}
          label="Peso (kg)"
          type="number"
          step="0.001"
          min="0"
          value={linea.peso_kg ?? ""}
          onChange={(e) => onChange({ peso_kg: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          id={`ubicacion-${indice}`}
          label="Ubicación"
          required
          value={linea.ubicacion_id}
          onChange={(e) => onChange({ ubicacion_id: e.target.value })}
        >
          <option value="" disabled>
            Selecciona una ubicación
          </option>
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo} {u.zona ? `· ${u.zona}` : ""}
            </option>
          ))}
        </Select>
        <Input
          id={`caducidad-${indice}`}
          label="Fecha de caducidad"
          type="date"
          hint="Opcional — solo para productos perecederos (FEFO)"
          value={linea.fecha_caducidad}
          onChange={(e) => onChange({ fecha_caducidad: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-ink">Datos logísticos (opcional)</p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`tarima-desde-${indice}`}
            label="Tarima desde"
            type="number"
            min="1"
            hint="Identificador físico, ej. tarimas 1-20"
            value={linea.tarima_desde ?? ""}
            onChange={(e) => onChange({ tarima_desde: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <Input
            id={`tarima-hasta-${indice}`}
            label="Tarima hasta"
            type="number"
            min="1"
            value={linea.tarima_hasta ?? ""}
            onChange={(e) => onChange({ tarima_hasta: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`cajas-pallet-${indice}`}
            label="Cajas por pallet"
            type="number"
            min="1"
            value={linea.cajas_por_pallet ?? ""}
            onChange={(e) => onChange({ cajas_por_pallet: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <Input
            id={`cant-caja-${indice}`}
            label="Cantidad por caja"
            type="number"
            min="1"
            value={linea.cantidad_por_caja ?? ""}
            onChange={(e) => onChange({ cantidad_por_caja: e.target.value === "" ? null : Number(e.target.value) })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`categoria-${indice}`}
            label="Categoría de producto"
            value={linea.categoria_producto}
            onChange={(e) => onChange({ categoria_producto: e.target.value })}
          />
          <Input
            id={`presentacion-${indice}`}
            label="Presentación"
            hint="Ej. cajas, atados, bultos…"
            value={linea.presentacion}
            onChange={(e) => onChange({ presentacion: e.target.value })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`lote1-${indice}`}
            label="Lote 1"
            value={linea.lote_1}
            onChange={(e) => onChange({ lote_1: e.target.value })}
          />
          <Input
            id={`lote2-${indice}`}
            label="Lote 2"
            value={linea.lote_2}
            onChange={(e) => onChange({ lote_2: e.target.value })}
          />
        </div>
      </div>

      <TarimasParcialesEditor
        value={linea.tarimas_parciales}
        onChange={(tarimas_parciales) => onChange({ tarimas_parciales })}
      />
    </div>
  );
}
