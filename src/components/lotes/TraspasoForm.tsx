"use client";

import { useState } from "react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink } from "@/components/ui/Button";
import { formatearNumero } from "@/lib/utils/numeros";

type Existencia = { ubicacion_id: string; codigo: string; piezas: number; tarimas: number };

export function TraspasoForm({
  action,
  volverHref,
  clientes,
  clienteActualId,
  ubicaciones,
  existencias,
  piezasPorTarima,
  rangoLote,
  hoy,
  error,
}: {
  action: (formData: FormData) => void;
  volverHref: string;
  clientes: { id: string; nombre: string; conTarifa: boolean }[];
  clienteActualId: string;
  ubicaciones: { id: string; codigo: string }[];
  existencias: Existencia[];
  piezasPorTarima: number | null;
  rangoLote: string | null;
  hoy: string;
  error?: string;
}) {
  const [origenId, setOrigenId] = useState(existencias.length === 1 ? existencias[0].ubicacion_id : "");
  const origen = existencias.find((e) => e.ubicacion_id === origenId) ?? null;
  const [clienteId, setClienteId] = useState(clienteActualId);
  const [tarimas, setTarimas] = useState<string>(origen ? String(origen.tarimas) : "");
  const [piezas, setPiezas] = useState<string>(origen ? String(origen.piezas) : "");
  const [piezasEditadas, setPiezasEditadas] = useState(false);

  // Las piezas se sugieren según las tarimas (tarimas × piezas por tarima,
  // o todo si pasan todas); se pueden corregir a mano.
  function sugerirPiezas(t: number, o: Existencia | null) {
    if (!o || !t) return "";
    if (t >= o.tarimas) return String(o.piezas);
    if (piezasPorTarima) return String(Math.min(o.piezas, t * piezasPorTarima));
    return String(Math.round((o.piezas * t) / o.tarimas));
  }

  function elegirOrigen(id: string) {
    setOrigenId(id);
    const o = existencias.find((e) => e.ubicacion_id === id) ?? null;
    setTarimas(o ? String(o.tarimas) : "");
    setPiezas(o ? String(o.piezas) : "");
    setPiezasEditadas(false);
  }

  function cambiarTarimas(valor: string) {
    setTarimas(valor);
    if (!piezasEditadas) setPiezas(sugerirPiezas(Number(valor), origen));
  }

  const cambiaCliente = clienteId !== clienteActualId;
  const t = Number(tarimas);
  const pasaTodoDeEsaUbicacion = origen != null && t === origen.tarimas && Number(piezas) === origen.piezas;

  return (
    <form action={action} className="flex max-w-2xl flex-col gap-5">
      {error && <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>}

      <Select
        label="Ubicación actual (de dónde sale)"
        name="ubicacion_origen_id"
        required
        value={origenId}
        onChange={(e) => elegirOrigen(e.target.value)}
      >
        <option value="" disabled>
          Selecciona la ubicación
        </option>
        {existencias.map((e) => (
          <option key={e.ubicacion_id} value={e.ubicacion_id}>
            {e.codigo} · hay {formatearNumero(e.piezas)} pz / {formatearNumero(e.tarimas)} tar
          </option>
        ))}
      </Select>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Tarimas que pasan"
          name="cantidad_tarimas"
          type="number"
          min="1"
          max={origen?.tarimas}
          required
          value={tarimas}
          onChange={(e) => cambiarTarimas(e.target.value)}
          hint={origen ? `Máximo ${formatearNumero(origen.tarimas)}` : undefined}
        />
        <Input
          label="Piezas que pasan"
          name="cantidad_piezas"
          type="number"
          min="1"
          max={origen?.piezas}
          required
          value={piezas}
          onChange={(e) => {
            setPiezas(e.target.value);
            setPiezasEditadas(true);
          }}
          hint={
            piezasPorTarima
              ? `Una tarima completa = ${formatearNumero(piezasPorTarima)} piezas; ajústalo si alguna no va completa`
              : "Ajusta las piezas si no pasan las tarimas completas"
          }
        />
      </div>

      <Input
        label="Identificador de las tarimas que pasan (opcional)"
        name="tarima_numeros_texto"
        hint={
          rangoLote
            ? `Rango del lote: ${rangoLote} · números sueltos y/o rangos, ej. "1,5,15-17"`
            : 'Números sueltos y/o rangos, ej. "1,5,15-17"'
        }
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <Select
          label="Cliente nuevo"
          name="cliente_destino_id"
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          hint="Déjalo igual si solo cambias de ubicación"
        >
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.id === clienteActualId ? " (actual)" : ""}
              {!c.conTarifa ? " — sin tarifa configurada" : ""}
            </option>
          ))}
        </Select>
        <Select
          label={cambiaCliente ? "Ubicación nueva (opcional)" : "Ubicación nueva"}
          name="ubicacion_destino_id"
          required={!cambiaCliente}
          defaultValue=""
          hint={cambiaCliente ? "Si no eliges, se queda en la misma ubicación" : undefined}
        >
          <option value="">{cambiaCliente ? "La misma ubicación" : "Selecciona la ubicación"}</option>
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.codigo}
            </option>
          ))}
        </Select>
      </div>

      {cambiaCliente && (
        <Input
          label="Fecha del traspaso"
          name="fecha"
          type="date"
          max={hoy}
          defaultValue={hoy}
          hint="Desde este día se le cobra al cliente nuevo; al anterior, hasta el día anterior"
        />
      )}

      <Textarea label="Motivo (opcional)" name="motivo" rows={2} />

      {cambiaCliente && origen && (
        <p className="rounded-lg bg-accent-soft px-3.5 py-2.5 text-sm text-ink">
          {pasaTodoDeEsaUbicacion && existencias.length === 1
            ? "Pasa el lote completo al cliente nuevo."
            : `Pasan ${formatearNumero(t || 0)} tarima(s) al cliente nuevo y el resto se queda con el cliente actual: saldrá del lote actual y entrará a un lote nuevo del cliente nuevo.`}
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton pendingLabel="Guardando…">Guardar traspaso</SubmitButton>
        <ButtonLink href={volverHref} variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
