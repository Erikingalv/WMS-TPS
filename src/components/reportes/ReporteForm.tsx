"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";
import { Select } from "@/components/ui/Field";
import type { Cliente } from "@/lib/types/database";

const TIPOS = [
  { value: "inventario", label: "Inventario / existencias" },
  { value: "entradas", label: "Entradas" },
  { value: "salidas", label: "Salidas" },
  { value: "movimientos", label: "Movimientos internos" },
  { value: "ocupacion", label: "Ocupación de la bodega" },
  { value: "cargos", label: "Cargos por periodo (almacenaje + maniobras)" },
] as const;

type Tipo = (typeof TIPOS)[number]["value"];

export function ReporteForm({
  clientes,
  columnasEntradas,
  columnasSalidas,
}: {
  clientes: Pick<Cliente, "id" | "nombre">[];
  columnasEntradas: [string, string][];
  columnasSalidas: [string, string][];
}) {
  const [tipo, setTipo] = useState<Tipo>("inventario");
  const [colsEntradas, setColsEntradas] = useState<string[]>(
    ["fecha", "hora", "cliente", "producto", "lote", "piezas", "tarimas", "ubicacion"]
  );
  const [colsSalidas, setColsSalidas] = useState<string[]>(
    ["fecha", "hora", "cliente", "producto", "lote", "piezas", "tarimas", "destino"]
  );

  const mostrarColumnasEntradas = tipo === "entradas";
  const mostrarColumnasSalidas = tipo === "salidas";
  const mostrarFechas = tipo === "entradas" || tipo === "salidas" || tipo === "movimientos" || tipo === "cargos";
  const fechasObligatorias = tipo === "cargos";
  const colsActuales = mostrarColumnasEntradas ? colsEntradas : colsSalidas;
  const setColsActuales = mostrarColumnasEntradas ? setColsEntradas : setColsSalidas;

  function toggleCol(key: string) {
    setColsActuales((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  return (
    <form
      action="/api/reportes"
      method="get"
      className="flex max-w-2xl flex-col gap-5 rounded-xl border border-line bg-paper-raised p-5"
    >
      <Select
        label="Tipo de reporte"
        name="tipo"
        value={tipo}
        onChange={(e) => setTipo(e.target.value as Tipo)}
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </Select>

      <div className="grid gap-5 sm:grid-cols-3">
        <Select label="Cliente" name="cliente_id" defaultValue="">
          <option value="">Todos</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </Select>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-soft" htmlFor="desde">
            Desde {fechasObligatorias && <span className="text-crit">*</span>}
          </label>
          <input
            id="desde"
            name="desde"
            type="date"
            required={fechasObligatorias}
            disabled={!mostrarFechas}
            className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-40"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink-soft" htmlFor="hasta">
            Hasta {fechasObligatorias && <span className="text-crit">*</span>}
          </label>
          <input
            id="hasta"
            name="hasta"
            type="date"
            required={fechasObligatorias}
            disabled={!mostrarFechas}
            className="h-11 w-full rounded-lg border border-line bg-paper-raised px-3.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft disabled:opacity-40"
          />
        </div>
      </div>

      {tipo === "cargos" && (
        <p className="text-xs text-ink-faint">
          Calcula, para cada lote con existencia en el rango, los días de almacenaje (con los
          escalones de su tarifa vigente) más el cobro de maniobra por cada tarima que entró o
          salió dentro de esas fechas. Sirve para generar la factura del periodo.
        </p>
      )}

      {(mostrarColumnasEntradas || mostrarColumnasSalidas) && (
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-soft">
            Datos a incluir en el reporte
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {(mostrarColumnasEntradas ? columnasEntradas : columnasSalidas).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  name="cols"
                  value={key}
                  checked={colsActuales.includes(key)}
                  onChange={() => toggleCol(key)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-ink-faint">
        El filtro de fechas aplica a Entradas, Salidas, Movimientos y Cargos por periodo.
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          name="formato"
          value="pdf"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-paper transition-colors hover:bg-accent-hover"
        >
          <FileDown size={16} /> Descargar PDF
        </button>
        <button
          type="submit"
          name="formato"
          value="excel"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-paper-raised px-5 text-sm font-medium text-ink transition-colors hover:bg-accent-soft"
        >
          <FileDown size={16} /> Descargar Excel
        </button>
      </div>
    </form>
  );
}
