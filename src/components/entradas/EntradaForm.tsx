"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { SubmitButton, ButtonLink, Button } from "@/components/ui/Button";
import { EvidenciaFotos } from "@/components/ui/EvidenciaFotos";
import { EntradaLineaCard, lineaEntradaVacia, type LineaEntrada } from "@/components/entradas/EntradaLineaCard";
import type { Cliente, Producto, Ubicacion, Usuario } from "@/lib/types/database";

// Una sola entrada puede traer varios productos y hasta varios clientes a
// la vez (embarque consolidado) — los datos del embarque (fecha, hora,
// contenedor, BL, quién recibió) se capturan una vez, y cada producto se
// agrega como su propia línea con su cliente, cantidades, ubicación y
// datos logísticos. Al guardar, cada línea se registra como su propia
// entrada (su propio lote), pero se captura todo junto.
export function EntradaForm({
  action,
  clientes,
  productos,
  ubicaciones,
  usuarios,
  usuarioActualId,
  fechaHoy,
  error,
}: {
  action: (formData: FormData) => Promise<void>;
  clientes: Cliente[];
  productos: Producto[];
  ubicaciones: Ubicacion[];
  usuarios: Usuario[];
  usuarioActualId?: string;
  fechaHoy: string;
  error?: string;
}) {
  const [lineas, setLineas] = useState<LineaEntrada[]>([lineaEntradaVacia()]);

  function actualizarLinea(i: number, cambios: Partial<LineaEntrada>) {
    setLineas((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...cambios } : l)));
  }

  function agregarLinea() {
    setLineas((prev) => [...prev, lineaEntradaVacia()]);
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
        <p className="text-sm font-semibold text-ink">Datos del embarque</p>
        <p className="text-xs text-ink-faint">
          Si llegan varios productos o clientes en el mismo embarque (consolidado), esto se
          captura una sola vez para todos.
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Fecha de ingreso" name="fecha" type="date" required defaultValue={fechaHoy} />
          <Input label="Hora de carga o descarga" name="hora_carga_descarga" type="time" required />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Input label="Número de contenedor" name="numero_contenedor" />
          <Input label="Número de BL" name="numero_bl" />
        </div>
        <Select label="Recibió" name="recibio_usuario_id" defaultValue={usuarioActualId ?? ""}>
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
          <EntradaLineaCard
            key={i}
            indice={i}
            linea={linea}
            clientes={clientes}
            productos={productos}
            ubicaciones={ubicaciones}
            onChange={(cambios) => actualizarLinea(i, cambios)}
            onQuitar={() => quitarLinea(i)}
            puedeQuitar={lineas.length > 1}
          />
        ))}
        <Button type="button" variant="secondary" onClick={agregarLinea} className="w-fit">
          <Plus size={16} /> Agregar otro producto/cliente
        </Button>
      </div>

      <Textarea label="Observaciones" name="observaciones" hint="Aplica a todo el embarque" />

      <EvidenciaFotos name="fotos" label="Fotografías de evidencia" />

      <Input
        label="Documentos"
        name="documentos"
        type="file"
        accept="image/*,application/pdf"
        multiple
        hint="Factura, carta porte, packing list, orden de compra…"
      />

      <input type="hidden" name="lineas_json" value={JSON.stringify(lineas)} />

      <div className="flex gap-3 pt-2">
        <SubmitButton pendingLabel="Registrando…">
          {lineas.length > 1 ? `Registrar ${lineas.length} entradas` : "Registrar entrada"}
        </SubmitButton>
        <ButtonLink href="/entradas" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
