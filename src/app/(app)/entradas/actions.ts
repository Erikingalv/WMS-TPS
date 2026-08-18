"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { subirArchivos } from "@/lib/supabase/storage";
import { getUsuarioActual } from "@/lib/auth/session";
import { textoONulo } from "@/lib/utils/forms";
import type { LineaEntrada } from "@/components/entradas/EntradaLineaCard";

type ResultadoLinea =
  | { ok: true; entradaId: string; loteId: string; codigoLote: string; indice: number }
  | { ok: false; indice: number; mensaje: string };

export async function crearEntrada(formData: FormData) {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const fecha_movimiento = String(formData.get("fecha") ?? "");
  const hora_carga_descarga = String(formData.get("hora_carga_descarga") ?? "");
  const recibio_usuario_id = textoONulo(formData.get("recibio_usuario_id"));
  const observaciones = textoONulo(formData.get("observaciones"));
  const numero_contenedor = textoONulo(formData.get("numero_contenedor"));
  const numero_bl = textoONulo(formData.get("numero_bl"));

  let lineas: LineaEntrada[];
  try {
    lineas = JSON.parse(String(formData.get("lineas_json") ?? "[]"));
  } catch {
    lineas = [];
  }

  if (lineas.length === 0) {
    redirect(`/entradas/nueva?error=${encodeURIComponent("Agrega al menos un producto.")}`);
  }

  const resultados: ResultadoLinea[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i];
    if (!l.cliente_id || !l.producto_id || !l.ubicacion_id || !l.cantidad_piezas || !l.cantidad_tarimas) {
      resultados.push({
        ok: false,
        indice: i,
        mensaje: `Producto ${i + 1}: faltan datos obligatorios (cliente, producto, ubicación, piezas o tarimas).`,
      });
      continue;
    }

    const { data: entrada, error } = await supabase.rpc("registrar_entrada", {
      p_cliente_id: l.cliente_id,
      p_producto_id: l.producto_id,
      p_ubicacion_id: l.ubicacion_id,
      p_cantidad_piezas: l.cantidad_piezas,
      p_cantidad_tarimas: l.cantidad_tarimas,
      p_fecha_movimiento: fecha_movimiento,
      p_hora_carga_descarga: hora_carga_descarga,
      p_peso_kg: l.peso_kg,
      p_recibio_usuario_id: recibio_usuario_id,
      p_observaciones: observaciones,
      p_fecha_caducidad: l.fecha_caducidad || null,
      p_cajas_por_pallet: l.cajas_por_pallet,
      p_cantidad_por_caja: l.cantidad_por_caja,
      p_categoria_producto: l.categoria_producto || null,
      p_lote_1: l.lote_1 || null,
      p_lote_2: l.lote_2 || null,
      p_numero_contenedor: numero_contenedor,
      p_numero_bl: numero_bl,
      p_presentacion: l.presentacion || null,
      p_tarima_desde: l.tarima_desde,
      p_tarima_hasta: l.tarima_hasta,
      p_tarimas_parciales: l.tarimas_parciales ?? [],
    });

    if (error || !entrada) {
      resultados.push({
        ok: false,
        indice: i,
        mensaje: `Producto ${i + 1}: ${error?.message ?? "no se pudo registrar"}`,
      });
      continue;
    }

    resultados.push({ ok: true, entradaId: entrada.id, loteId: entrada.lote_id, codigoLote: "", indice: i });
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
      const documentos = formData.getAll("documentos");
      const carpeta = `entradas/${exitosas[0].entradaId}`;
      const subidasFotos = await subirArchivos(supabase, "documentos", carpeta, fotos);
      const subidasDocs = await subirArchivos(supabase, "documentos", carpeta, documentos);

      const filas = exitosas.flatMap((r) => [
        ...subidasFotos.map((f) => ({
          entidad_tipo: "entrada" as const,
          entidad_id: r.entradaId,
          tipo_documento: "foto" as const,
          storage_path: f.path,
          nombre_archivo: f.nombre,
          subido_por: usuario?.id ?? null,
        })),
        ...subidasDocs.map((f) => ({
          entidad_tipo: "entrada" as const,
          entidad_id: r.entradaId,
          tipo_documento: "otro" as const,
          storage_path: f.path,
          nombre_archivo: f.nombre,
          subido_por: usuario?.id ?? null,
        })),
      ]);

      if (filas.length > 0) {
        await supabase.from("archivos_adjuntos").insert(filas);
      }
    } catch {
      // Las entradas ya quedaron registradas aunque falle la subida de
      // adjuntos; no revertimos los movimientos por un problema de archivos.
    }
  }

  revalidatePath("/entradas");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");

  const fallos = resultados.filter((r): r is Extract<ResultadoLinea, { ok: false }> => !r.ok);

  // Caso más común: un solo producto y todo salió bien — mismo destino de
  // siempre (abre el comprobante directo en la página del lote).
  if (lineas.length === 1 && exitosas.length === 1 && fallos.length === 0) {
    redirect(`/lotes/${exitosas[0].codigoLote}?comprobante=entrada:${exitosas[0].entradaId}`);
  }

  const params = new URLSearchParams();
  if (exitosas.length > 0) {
    params.set("ok", exitosas.map((r) => `${r.entradaId}:${r.codigoLote}`).join(","));
  }
  if (fallos.length > 0) {
    params.set("error", fallos.map((f) => f.mensaje).join(" | "));
  }
  redirect(`/entradas/registro-multiple?${params.toString()}`);
}
