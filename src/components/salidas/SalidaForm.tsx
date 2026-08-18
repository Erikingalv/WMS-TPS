"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink, Button } from "@/components/ui/Button";
import { SignaturePad } from "@/components/salidas/SignaturePad";
import { EvidenciaFotos } from "@/components/ui/EvidenciaFotos";
import { SalidaLineaCard, lineaSalidaVacia, type LineaSalida } from "@/components/salidas/SalidaLineaCard";
import type { ExistenciaDisponible } from "@/lib/inventario";
import type { Cliente, Producto, Usuario } from "@/lib/types/database";

export type { ExistenciaDisponible };

// Una sola salida puede llevar varios productos y hasta varios clientes en
// el mismo viaje (consolidado) — los datos del transporte (fecha, hora,
// destino, transportista, firma) se capturan una vez, y cada producto se
// agrega como su propia línea con su cliente, lote a surtir y datos
// logísticos. Al guardar, cada línea se registra como su propia salida.
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
  const [lineas, setLineas] = useState<LineaSalida[]>([lineaSalidaVacia()]);

  function actualizarLinea(i: number, cambios: Partial<LineaSalida>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaSalidaVacia()]);
  }

  function quitarLinea(i: number) {
    setLineas((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <form action={action} encType="multipart/form-data" className="flex max-w-2xl flex-col gap-5">
      {error && (
        <p className="rounded-lg bg-crit-soft px-3.5 py-2.5 text-sm text-crit">{error}</p>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-line p-4">
        <p className="text-sm font-semibold text-ink">Datos del transporte</p>
        <p className="text-xs text-ink-faint">
          Si en el mismo viaje sale mercancía de varios productos o clientes (consolidado), esto
          se captura una sola vez para todos.
        </p>
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
      </div>

      <div className="flex flex-col gap-4">
        {lineas.map((linea, i) => (
          <SalidaLineaCard
            key={i}
            indice={i}
            linea={linea}
            clientes={clientes}
            productos={productos}
            existencias={existencias}
            onChange={(cambios) => actualizarLinea(i, cambios)}
            onQuitar={() => quitarLinea(i)}
            puedeQuitar={lineas.length > 1}
          />
        ))}
        <Button type="button" variant="secondary" onClick={agregarLinea} className="w-fit">
          <Plus size={16} /> Agregar otro producto/cliente
        </Button>
      </div>

      <Textarea label="Observaciones" name="observaciones" hint="Aplica a todo el viaje" />

      <EvidenciaFotos name="fotos" label="Fotografías de evidencia" />

      <SignaturePad name="firma_digital_dataurl" />

      <input type="hidden" name="lineas_json" value={JSON.stringify(lineas)} />

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Registrando…">
          {lineas.length > 1 ? `Registrar ${lineas.length} salidas` : "Registrar salida"}
        </SubmitButton>
        <ButtonLink href="/salidas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
