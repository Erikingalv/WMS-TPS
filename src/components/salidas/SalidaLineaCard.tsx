"use client";

import { useMemo } from "react";
import { Trash2 } from "lucide-react";
import { Input, Select } from "@/components/ui/Field";
import { diasDesde } from "@/lib/utils/dates";
import type { ExistenciaDisponible } from "@/lib/inventario";
import type { Cliente, Producto } from "@/lib/types/database";

export type LineaSalida = {
  cliente_id: string;
  producto_id: string;
  combo: string;
  lote_id: string;
  ubicacion_id: string;
  cantidad_piezas: number | null;
  cantidad_tarimas: number | null;
  tarima_numeros_texto: string;
  piezas_tarima_parcial: number | null;
  numero_tarima_parcial: number | null;
  cajas_por_pallet: number | null;
  cantidad_por_caja: number | null;
  categoria_producto: string;
  presentacion: string;
  lote_1: string;
  lote_2: string;
  numero_contenedor: string;
  numero_bl: string;
};

export function lineaSalidaVacia(): LineaSalida {
  return {
    cliente_id: "",
    producto_id: "",
    combo: "",
    lote_id: "",
    ubicacion_id: "",
    cantidad_piezas: null,
    cantidad_tarimas: null,
    tarima_numeros_texto: "",
    piezas_tarima_parcial: null,
    numero_tarima_parcial: null,
    cajas_por_pallet: null,
    cantidad_por_caja: null,
    categoria_producto: "",
    presentacion: "",
    lote_1: "",
    lote_2: "",
    numero_contenedor: "",
    numero_bl: "",
  };
}

export function SalidaLineaCard({
  indice,
  linea,
  clientes,
  productos,
  existencias,
  onChange,
  onQuitar,
  puedeQuitar,
}: {
  indice: number;
  linea: LineaSalida;
  clientes: Cliente[];
  productos: Producto[];
  existencias: ExistenciaDisponible[];
  onChange: (cambios: Partial<LineaSalida>) => void;
  onQuitar: () => void;
  puedeQuitar: boolean;
}) {
  const productosDelCliente = useMemo(
    () => productos.filter((p) => p.cliente_id === linea.cliente_id),
    [productos, linea.cliente_id]
  );

  const existenciasDelProducto = useMemo(
    () =>
      existencias
        .filter((e) => e.producto_id === linea.producto_id)
        .sort((a, b) => new Date(a.fecha_ingreso).getTime() - new Date(b.fecha_ingreso).getTime()),
    [existencias, linea.producto_id]
  );

  const seleccionada = existenciasDelProducto.find((e) => `${e.lote_id}:${e.ubicacion_id}` === linea.combo);

  function elegirCombo(nuevoCombo: string) {
    const e = existenciasDelProducto.find((x) => `${x.lote_id}:${x.ubicacion_id}` === nuevoCombo);
    onChange({
      combo: nuevoCombo,
      lote_id: e?.lote_id ?? "",
      ubicacion_id: e?.ubicacion_id ?? "",
      cajas_por_pallet: e?.cajas_por_pallet ?? null,
      cantidad_por_caja: e?.cantidad_por_caja ?? null,
      categoria_producto: e?.categoria_producto ?? "",
      presentacion: e?.presentacion ?? "",
      lote_1: e?.lote_1 ?? "",
      lote_2: e?.lote_2 ?? "",
      numero_contenedor: e?.numero_contenedor ?? "",
      numero_bl: e?.numero_bl ?? "",
    });
  }

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
          onChange={(e) => onChange({ cliente_id: e.target.value, producto_id: "", combo: "", lote_id: "", ubicacion_id: "" })}
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
          label="Producto"
          required
          disabled={!linea.cliente_id}
          value={linea.producto_id}
          onChange={(e) => onChange({ producto_id: e.target.value, combo: "", lote_id: "", ubicacion_id: "" })}
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

      <Select
        id={`lote-${indice}`}
        label="Lote a surtir"
        required
        disabled={!linea.producto_id}
        value={linea.combo}
        onChange={(e) => elegirCombo(e.target.value)}
        hint="Se sugiere el lote más antiguo primero (FIFO); puedes elegir otro si lo justificas en observaciones."
      >
        <option value="" disabled>
          {linea.producto_id ? "Selecciona un lote" : "Primero elige un producto"}
        </option>
        {existenciasDelProducto.map((e, i) => (
          <option key={`${e.lote_id}:${e.ubicacion_id}`} value={`${e.lote_id}:${e.ubicacion_id}`}>
            {i === 0 ? "★ " : ""}
            {e.codigo_lote} · {e.ubicacion_codigo}
            {e.tarima_desde != null ? ` · tarimas ${e.tarima_desde}-${e.tarima_hasta}` : ""} · disp.{" "}
            {e.cantidad_piezas} pz / {e.cantidad_tarimas} tar · {diasDesde(e.fecha_ingreso)} días
          </option>
        ))}
      </Select>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id={`piezas-${indice}`}
          label="Piezas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_piezas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_piezas}` : undefined}
          value={linea.cantidad_piezas ?? ""}
          onChange={(e) => onChange({ cantidad_piezas: e.target.value === "" ? null : Number(e.target.value) })}
        />
        <Input
          id={`tarimas-${indice}`}
          label="Tarimas"
          type="number"
          min="1"
          max={seleccionada?.cantidad_tarimas}
          required
          hint={seleccionada ? `Disponible: ${seleccionada.cantidad_tarimas}` : undefined}
          value={linea.cantidad_tarimas ?? ""}
          onChange={(e) => onChange({ cantidad_tarimas: e.target.value === "" ? null : Number(e.target.value) })}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <div>
          <p className="text-sm font-semibold text-ink">Datos logísticos (opcional)</p>
          <p className="text-xs text-ink-faint">
            Se precargan con lo capturado en la entrada del lote elegido; puedes cambiarlos si es
            necesario.
          </p>
        </div>
        <Input
          id={`tarima-numeros-${indice}`}
          label="Identificador de tarimas que salen"
          value={linea.tarima_numeros_texto}
          onChange={(e) => onChange({ tarima_numeros_texto: e.target.value })}
          hint={
            seleccionada?.tarima_desde != null
              ? `Rango del lote: ${seleccionada.tarima_desde}-${seleccionada.tarima_hasta} · admite números sueltos y/o rangos, ej. "1,5,15-17"`
              : `Admite números sueltos y/o rangos mezclados, ej. "1,5,15-17"`
          }
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`piezas-parcial-${indice}`}
            label="Piezas de tarima parcial"
            type="number"
            min="1"
            hint="Solo si una de las tarimas que salen no viene completa"
            value={linea.piezas_tarima_parcial ?? ""}
            onChange={(e) => onChange({ piezas_tarima_parcial: e.target.value === "" ? null : Number(e.target.value) })}
          />
          <Input
            id={`numero-parcial-${indice}`}
            label="Número de esa tarima (si aplica)"
            type="number"
            min="1"
            value={linea.numero_tarima_parcial ?? ""}
            onChange={(e) => onChange({ numero_tarima_parcial: e.target.value === "" ? null : Number(e.target.value) })}
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
        <div className="grid gap-5 sm:grid-cols-2">
          <Input
            id={`contenedor-${indice}`}
            label="Número de contenedor"
            value={linea.numero_contenedor}
            onChange={(e) => onChange({ numero_contenedor: e.target.value })}
          />
          <Input
            id={`bl-${indice}`}
            label="Número de BL"
            value={linea.numero_bl}
            onChange={(e) => onChange({ numero_bl: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
