import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth/session";
import { EntradaForm } from "@/components/entradas/EntradaForm";
import { crearEntrada } from "@/app/(app)/entradas/actions";

export default async function NuevaEntradaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const [{ data: clientes }, { data: productos }, { data: ubicaciones }, { data: usuarios }] =
    await Promise.all([
      supabase.from("clientes").select("*").eq("activo", true).order("nombre"),
      supabase.from("productos").select("*").eq("activo", true).order("nombre"),
      supabase.from("ubicaciones").select("*").eq("activo", true).order("codigo"),
      supabase.from("usuarios").select("*").eq("activo", true).order("nombre"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Nueva entrada</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Se crea un lote nuevo y el inventario se actualiza automáticamente.
        </p>
      </div>
      <EntradaForm
        action={crearEntrada}
        clientes={clientes ?? []}
        productos={productos ?? []}
        ubicaciones={ubicaciones ?? []}
        usuarios={usuarios ?? []}
        usuarioActualId={usuario?.id}
        error={params.error}
      />
    </div>
  );
}
