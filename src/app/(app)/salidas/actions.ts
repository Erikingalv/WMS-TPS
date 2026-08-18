"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirArchivos, subirDataUrl } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { textoONulo } from "@/lib/utils/forms";
import { parsearTarimas } from "@/lib/utils/tarimas";
import type { LineaSalida } from "@/components/salidas/SalidaLineaCard";

type ResultadoLinea =
  | { ok: true; salidaId: string; loteId: string; codigoLote: string; indice: number }
  | { ok: false; indice: number; mensaje: string };

export async function crearSalida(formData: FormData) {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const fecha_movimiento = String(formData.get("fecha") ?? "");
  const hora_carga_descarga = String(formData.get("hora_carga_descarga") ?? "");
  const destino = textoONulo(formData.get("destino"));
  const transportista = textoONulo(formData.get("transportista"));
  const placas = textoONulo(formData.get("placas"));
  const operador = textoONulo(formData.get("operador"));
  const autorizo_usuario_id = textoONulo(formData.get("autorizo_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const firmaDataUrl = textoONulo(formData.get("firma_digital_dataurl"));

  let lineas: LineaSalida[];
  try {
    lineas = JSON.parse(String(formData.get("lineas_json") ?? "[]"));
  } catch {
    lineas = [];
  }

  if (lineas.length === 0) {
    redirect(`/salidas/nueva?error=${encodeURIComponent("Agrega al menos un producto.")}`);
  }

  let firma_digital_url: string | null = null;
  if (firmaDataUrl) {
    try {
      firma_digital_url = await subirDataUrl(
        supabase,
        "documentos",
        `salidas/${randomUUID()}.png`,
        firmaDataUrl
      );
    } catch {
      // Continuamos sin firma si la subida falla; no bloquea la salida.
    }
  }

  const resultados: ResultadoLinea[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];

    if (!l.lote_id || !l.ubicacion_id || !l.cantidad_piezas || !l.cantidad_tarimas) {
      resultados.push({
        ok: false,
        indice: i,
        mensaje: `Producto ${i + 1}: selecciona un lote válido y captura piezas/tarimas.`,
      });
      continue;
    }

    let tarima_numeros: number[] | null = null;
    if (l.tarima_numeros_texto?.trim()) {
      tarima_numeros = parsearTarimas(l.tarima_numeros_texto.trim());
      if (!tarima_numeros) {
        resultados.push({
          ok: false,
          indice: i,
          mensaje: `Producto ${i + 1}: no entendí el identificador de tarimas "${l.tarima_numeros_texto}".`,
        });
        continue;
      }
    }

    const { data: salida, error } = await supabase.rpc("registrar_salida", {
      p_lote_id: l.lote_id,
      p_ubicacion_id: l.ubicacion_id,
      p_cantidad_piezas: l.cantidad_piezas,
      p_cantidad_tarimas: l.cantidad_tarimas,
      p_fecha_movimiento: fecha_movimiento,
      p_hora_carga_descarga: hora_carga_descarga,
      p_destino: destino,
      p_transportista: transportista,
      p_placas: placas,
      p_operador: operador,
      p_autorizo_usuario_id: autorizo_usuario_id,
      p_observaciones: observaciones,
      p_firma_digital_url: firma_digital_url,
      p_cajas_por_pallet: l.cajas_por_pallet,
      p_cantidad_por_caja: l.cantidad_por_caja,
      p_categoria_producto: l.categoria_producto || null,
      p_lote_1: l.lote_1 || null,
      p_lote_2: l.lote_2 || null,
      p_numero_contenedor: l.numero_contenedor || null,
      p_numero_bl: l.numero_bl || null,
      p_presentacion: l.presentacion || null,
      p_tarima_numeros: tarima_numeros,
      p_piezas_tarima_parcial: l.piezas_tarima_parcial,
      p_numero_tarima_parcial: l.numero_tarima_parcial,
    });

    if (error || !salida) {
      resultados.push({
        ok: false,
        indice: i,
        mensaje: `Producto ${i + 1}: ${error?.message ?? "no se pudo registrar"}`,
      });
      continue;
    }

    resultados.push({ ok: true, salidaId: salida.id, loteId: l.lote_id, codigoLote: "", indice: i });
  }

  const exitosas = resultados.filter((r): r is Extract<ResultadoLinea, { ok: true }> => r.ok);

  if (exitosas.length > 0) {
    const { data: lotes } = await supabase
      .from("lotes")
      .select("id, codigo_lote")
      .in(
        "id",
        exitosas.map((r) => r.loteId)
      );
    const mapaCodigos = new Map((lotes ?? []).map((l) => [l.id, l.codigo_lote]));
    exitosas.forEach((r) => {
      r.codigoLote = mapaCodigos.get(r.loteId) ?? r.loteId;
    });

    try {
      const fotos = formData.getAll("fotos");
      const carpeta = `salidas/${exitosas[0].salidaId}`;
      const subidas = await subirArchivos(supabase, "documentos", carpeta, fotos);
      if (subidas.length > 0) {
        const filas = exitosas.flatMap((r) =>
          subidas.map((f) => ({
            entidad_tipo: "salida" as const,
            entidad_id: r.salidaId,
            tipo_documento: "foto" as const,
            storage_path: f.path,
            nombre_archivo: f.nombre,
            subido_por: usuario?.id ?? null,
          }))
        );
        await supabase.from("archivos_adjuntos").insert(filas);
      }
    } catch {
      // Las salidas ya quedaron registradas aunque falle la subida de evidencia.
    }
  }

  revalidatePath("/salidas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");

  const fallos = resultados.filter((r): r is Extract<ResultadoLinea, { ok: false }> => !r.ok);

  if (lineas.length === 1 && exitosas.length === 1 && fallos.length === 0) {
    redirect(`/lotes/${exitosas[0].codigoLote}?comprobante=salida:${exitosas[0].salidaId}`);
  }

  const params = new URLSearchParams();
  if (exitosas.length > 0) {
    params.set("ok", exitosas.map((r) => `${r.salidaId}:${r.codigoLote}`).join(","));
  }
  if (fallos.length > 0) {
    params.set("error", fallos.map((f) => f.mensaje).join(" | "));
  }
  redirect(`/salidas/registro-multiple?${params.toString()}`);
}
