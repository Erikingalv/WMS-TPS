import { requireUsuario } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/AppShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const usuario = await requireUsuario();
  return <AppShell usuario={usuario}>{children}</AppShell>;
}
