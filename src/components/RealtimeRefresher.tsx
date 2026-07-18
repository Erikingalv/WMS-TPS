"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Vuelve a pedir los datos del Server Component cuando cualquier usuario
// conectado registra un cambio en alguna de las tablas indicadas — así el
// dashboard (o cualquier vista) se mantiene en vivo sin polling.
export function RealtimeRefresher({ tables }: { tables: string[] }) {
  const router = useRouter();
  const tablesKey = tables.join(",");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`wms-realtime-${tablesKey}`);

    tablesKey.split(",").forEach((table) => {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      );
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, tablesKey]);

  return null;
}
