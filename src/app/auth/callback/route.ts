import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Intercambia el código que Supabase manda por correo (recuperación de
// contraseña, invitación) por una sesión real, luego redirige a `next`.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("El enlace ya no es válido, solicita uno nuevo.")}`
  );
}
