import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generarPdfMovimiento } from "@/lib/reportes/pdfMovimiento";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tipo: string; id: string }> }
) {
  const { tipo, id } = await params;
  if (tipo !== "entrada" && tipo !== "salida") {
    return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
  }

  const supabase = await createClient();
  const resultado = await generarPdfMovimiento(supabase, tipo, id);

  if ("error" in resultado) {
    return NextResponse.json({ error: resultado.error }, { status: resultado.status });
  }

  return new NextResponse(new Uint8Array(resultado.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${resultado.filename}"`,
    },
  });
}
