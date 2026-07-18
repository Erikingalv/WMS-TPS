import { NextResponse } from "next/server";

// Ruta de diagnóstico TEMPORAL — no expone secretos, solo metadata de
// caracteres inválidos en las env vars usadas por el cliente Supabase.
// Borrar en cuanto se resuelva el bug de login en producción.
function inspeccionar(valor: string | undefined) {
  if (!valor) return { presente: false };
  const malos: { index: number; code: number }[] = [];
  for (let i = 0; i < valor.length; i++) {
    const code = valor.charCodeAt(i);
    if (code > 255) malos.push({ index: i, code });
  }
  return {
    presente: true,
    longitud: valor.length,
    primerCaracter: valor.slice(0, 3),
    ultimoCaracter: valor.slice(-3),
    caracteresInvalidos: malos,
  };
}

export async function GET() {
  return NextResponse.json({
    url: inspeccionar(process.env.NEXT_PUBLIC_SUPABASE_URL),
    anonKey: inspeccionar(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    serviceRoleKey: inspeccionar(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}
