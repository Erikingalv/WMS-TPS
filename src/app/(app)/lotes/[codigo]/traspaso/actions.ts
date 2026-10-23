"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { textoONulo } from "@/lib/utils/forms";
import { parsearTarimas } from "@/lib/utils/tarimas";

function volverConError(codigo: string, mensaje: string): never {
  redirect(`/lotes/${codigo}/traspaso?error=${encodeURIComponent(mensaje)}`);
}

// Pasa material de un lote a otro cliente y/u otra ubicación:
//  - mismo cliente, otra ubicación → movimiento interno (cualquier cantidad);
//  - otro cliente y se pasa TODO el lote → cambia el cliente del lote;
//  - otro cliente y se pasa solo una parte → se divide: sale del lote
//    original y entra a un lote nuevo del cliente destino.
export async function traspasarLoteAction(codigo: string, loteId: string, formData: FormData) {
  const supabase = await createClient();

  const clienteDestinoId = textoONulo(formData.get("cliente_destino_id"));
  const ubicacionDestinoId = textoONulo(formData.get("ubicacion_destino_id"));
  const fecha = textoONulo(formData.get("fecha"));
  const motivo = textoONulo(formData.get("motivo"));
  const cantidadTarimas = Number(formData.get("cantidad_tarimas") ?? 0);
  const cantidadPiezas = Number(formData.get("cantidad_piezas") ?? 0);
  let ubicacionOrigenId = textoONulo(formData.get("ubicacion_origen_id"));

  const numerosTexto = String(formData.get("tarima_numeros_texto") ?? "").trim();
  let tarimaNumeros: number[] | null = null;
  if (numerosTexto) {
    tarimaNumeros = parsearTarimas(numerosTexto);
    if (!tarimaNumeros) {
      volverConError(codigo, `No entendí el identificador de tarimas "${numerosTexto}". Usa números separados por coma y/o rangos, ej. "1,5,15-17".`);
    }
  }

  const [{ data: lote }, { data: existencias }] = await Promise.all([
    supabase.from("lotes").select("id, productos(cliente_id)").eq("id", loteId).single(),
    supabase
      .from("inventario_lote_ubicacion")
      .select("ubicacion_id, cantidad_piezas, cantidad_tarimas")
      .eq("lote_id", loteId)
      .or("cantidad_piezas.gt.0,cantidad_tarimas.gt.0"),
  ]);
  const clienteActualId = (lote as unknown as { productos: { cliente_id: string } | null } | null)?.productos?.cliente_id;
  const filas = existencias ?? [];

  if (!ubicacionOrigenId && filas.length === 1) ubicacionOrigenId = filas[0].ubicacion_id;
  if (!ubicacionOrigenId) volverConError(codigo, "Elige de qué ubicación sale el material.");
  const origen = filas.find((f) => f.ubicacion_id === ubicacionOrigenId);
  if (!origen) volverConError(codigo, "Ese lote no tiene existencia en la ubicación de origen.");
  if (!cantidadPiezas || cantidadPiezas < 1) volverConError(codigo, "Indica cuántas piezas pasan.");

  const cambiaCliente = Boolean(clienteDestinoId && clienteDestinoId !== clienteActualId);

  let codigoDestino = codigo;

  if (!cambiaCliente) {
    // Solo cambia de ubicación (se puede mover una parte).
    if (!ubicacionDestinoId) volverConError(codigo, "Elige otro cliente y/o la ubicación nueva.");
    const { error } = await supabase.rpc("registrar_movimiento_interno", {
      p_lote_id: loteId,
      p_ubicacion_origen_id: ubicacionOrigenId,
      p_ubicacion_destino_id: ubicacionDestinoId,
      p_cantidad_piezas: cantidadPiezas,
      p_cantidad_tarimas: cantidadTarimas,
      p_motivo: motivo,
    });
    if (error) volverConError(codigo, error.message);
  } else {
    const pasaTodo =
      filas.length === 1 &&
      cantidadTarimas === origen.cantidad_tarimas &&
      cantidadPiezas === origen.cantidad_piezas;

    if (pasaTodo) {
      const { error } = await supabase.rpc("traspasar_lote", {
        p_lote_id: loteId,
        p_cliente_destino_id: clienteDestinoId,
        p_fecha: fecha,
        p_ubicacion_origen_id: ubicacionDestinoId && ubicacionDestinoId !== ubicacionOrigenId ? ubicacionOrigenId : null,
        p_ubicacion_destino_id: ubicacionDestinoId && ubicacionDestinoId !== ubicacionOrigenId ? ubicacionDestinoId : null,
        p_motivo: motivo,
      });
      if (error) volverConError(codigo, error.message);
    } else {
      const { data, error } = await supabase.rpc("traspasar_parcial", {
        p_lote_id: loteId,
        p_cliente_destino_id: clienteDestinoId!,
        p_ubicacion_origen_id: ubicacionOrigenId,
        p_ubicacion_destino_id: ubicacionDestinoId,
        p_cantidad_tarimas: cantidadTarimas,
        p_cantidad_piezas: cantidadPiezas,
        p_fecha: fecha,
        p_tarima_numeros: tarimaNumeros,
        p_motivo: motivo,
      });
      if (error || !data) volverConError(codigo, error?.message ?? "No se pudo registrar el traspaso.");
      codigoDestino = data.codigo_lote_nuevo;
    }
  }

  revalidatePath(`/lotes/${codigo}`);
  revalidatePath("/inventario");
  revalidatePath("/movimientos");
  revalidatePath("/entradas");
  revalidatePath("/salidas");
  revalidatePath("/dashboard");
  revalidatePath("/reportes");
  redirect(`/lotes/${codigoDestino}?traspaso=1`);
}
