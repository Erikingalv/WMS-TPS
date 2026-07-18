import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import type { Database } from "@/lib/types/database";

// Los headers HTTP solo aceptan ByteString (0–255): un user-agent o
// x-forwarded-for real con algún carácter fuera de ese rango (visto en
// producción: un "•" de un teclado/autocompletado de iOS) tronaba el fetch
// completo a Supabase con "Cannot convert argument to a ByteString" —
// tumbando hasta el login. Se recorta a ASCII imprimible antes de reenviar.
function sanearHeader(valor: string): string {
  return valor.replace(/[^\x20-\x7E]/g, "").slice(0, 200);
}

// Cliente para Server Components / Server Actions / Route Handlers.
// `setAll` puede fallar cuando se llama desde un Server Component puro (no
// puede escribir cookies); se ignora porque `proxy.ts` ya se encarga de
// refrescar la sesión en cada request.
export async function createClient() {
  const cookieStore = await cookies();
  const headerStore = await headers();

  // Reenvía la IP y el user-agent reales de quien hizo la acción. Sin esto,
  // la bitácora de auditoría (historial_movimientos, vía registrar_historial)
  // quedaría con la IP/UA de nuestro propio servidor: todas las llamadas a
  // Supabase pasan por aquí, no hay navegador → Supabase directo.
  const ipReenviada = sanearHeader(
    headerStore.get("x-forwarded-for") ?? headerStore.get("x-real-ip") ?? ""
  );
  const userAgentReenviado = sanearHeader(headerStore.get("user-agent") ?? "");

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          "x-forwarded-for": ipReenviada,
          "user-agent": userAgentReenviado,
        },
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component: no-op, ver comentario arriba.
          }
        },
      },
    }
  );
}
