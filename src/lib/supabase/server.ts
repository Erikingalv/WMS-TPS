import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types/database";

// Cliente para Server Components / Server Actions / Route Handlers.
// `setAll` puede fallar cuando se llama desde un Server Component puro (no
// puede escribir cookies); se ignora porque `proxy.ts` ya se encarga de
// refrescar la sesión en cada request.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
